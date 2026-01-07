import FirecrawlApp from '@mendable/firecrawl-js';
import { CommbuysOpportunity } from '@/types';

// Using City of Boston bids (easier to scrape than COMMBUYS)
const BOSTON_BIDS_URL = 'https://www.boston.gov/bid-listings';
const BOSTON_BASE_URL = 'https://www.boston.gov';

// Lazy initialization for Firecrawl client
let firecrawlInstance: FirecrawlApp | null = null;

function getFirecrawl(): FirecrawlApp {
  if (!firecrawlInstance) {
    if (!process.env.FIRECRAWL_API_KEY) {
      throw new CommbuysApiError('FIRECRAWL_API_KEY is not set');
    }
    firecrawlInstance = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  }
  return firecrawlInstance;
}

// Proxy for backwards compatibility (same pattern as Stripe)
export const firecrawl = new Proxy({} as FirecrawlApp, {
  get(_, prop) {
    return Reflect.get(getFirecrawl(), prop);
  },
});

export class CommbuysApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'CommbuysApiError';
  }
}

/**
 * Parse opportunity data from Boston.gov bid listings markdown
 * Format: Title (optional ID), Posted date, Deadline, Department, Contact
 */
function parseOpportunitiesFromContent(content: string): CommbuysOpportunity[] {
  const opportunities: CommbuysOpportunity[] = [];
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Look for bid titles - they're usually followed by Posted/Deadline info
    // Boston format: "**Title** (EV00016951)" or just "**Title**"
    const titleMatch = line.match(/\*\*(.+?)\*\*(?:\s*\(([A-Z0-9]+)\))?/);

    if (titleMatch) {
      const title = titleMatch[1].trim();
      const bidId = titleMatch[2] || `BOSTON-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      let postedDate: string | null = null;
      let dueDate: string | null = null;
      let agency: string = 'City of Boston';
      let contact: string | null = null;
      let url: string | null = null;

      // Look at next few lines for metadata
      for (let j = 1; j <= 6 && i + j < lines.length; j++) {
        const nextLine = lines[i + j];

        // Posted date
        const postedMatch = nextLine.match(/Posted[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i);
        if (postedMatch) postedDate = postedMatch[1];

        // Deadline
        const deadlineMatch = nextLine.match(/Deadline[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i);
        if (deadlineMatch) dueDate = deadlineMatch[1];

        // Department
        const deptMatch = nextLine.match(/Department[:\s]*(.+)/i);
        if (deptMatch) agency = `City of Boston - ${deptMatch[1].trim()}`;

        // Contact
        const contactMatch = nextLine.match(/Contact[:\s]*(.+)/i);
        if (contactMatch) contact = contactMatch[1].trim();

        // URL - look for links
        const urlMatch = nextLine.match(/\[.*?\]\((https?:\/\/[^\)]+)\)/);
        if (urlMatch) url = urlMatch[1];

        // Stop if we hit another title
        if (nextLine.match(/\*\*(.+?)\*\*/)) break;
      }

      opportunities.push({
        bidId,
        title,
        description: contact ? `Contact: ${contact}` : null,
        agency,
        category: null,
        postedDate,
        dueDate,
        status: 'Open',
        url: url || `${BOSTON_BASE_URL}/bid-listings`,
      });
    }

    i++;
  }

  return opportunities;
}

/**
 * Fetch raw opportunities from Boston.gov using Firecrawl
 */
async function fetchRawCommbuysOpportunities(
  limit: number = 25
): Promise<CommbuysOpportunity[]> {
  const client = getFirecrawl();

  try {
    const result = await client.scrapeUrl(BOSTON_BIDS_URL, {
      formats: ['markdown'],
    });

    if (!result.success) {
      throw new CommbuysApiError(
        'Failed to scrape Boston.gov bids',
        undefined,
        result
      );
    }

    // Parse opportunities from the scraped content
    const content = result.markdown || '';
    const opportunities = parseOpportunitiesFromContent(content);

    // Return limited results
    return opportunities.slice(0, limit);
  } catch (error) {
    if (error instanceof CommbuysApiError) {
      throw error;
    }
    throw new CommbuysApiError(
      `Failed to fetch from Boston.gov: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Fetch opportunities from COMMBUYS and return normalized data
 * Returns data in the same format as SAM.gov normalizeOpportunity for database storage
 */
export async function fetchCommbuysOpportunities(
  limit: number = 25
): Promise<ReturnType<typeof normalizeCommbuysOpportunity>[]> {
  const rawOpportunities = await fetchRawCommbuysOpportunities(limit);
  return rawOpportunities.map(normalizeCommbuysOpportunity);
}

/**
 * Normalize COMMBUYS opportunity to ContractLead format for database storage
 * Matches the same output shape as SAM.gov normalizeOpportunity
 */
export function normalizeCommbuysOpportunity(opportunity: CommbuysOpportunity) {
  const parseDate = (dateStr: string | null): Date | null => {
    if (!dateStr) return null;

    // Handle MM/DD/YYYY format
    if (dateStr.includes('/')) {
      const [month, day, year] = dateStr.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      return isNaN(date.getTime()) ? null : date;
    }

    // Handle YYYY-MM-DD format
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

  return {
    title: opportunity.title,
    description: opportunity.description,
    agency: opportunity.agency,
    subAgency: null,
    solicitationNumber: opportunity.bidId,
    noticeType: opportunity.status || null,
    naicsCodes: [] as string[],
    pscCode: null,
    placeOfPerformance: 'Boston, Massachusetts',
    postedDate: parseDate(opportunity.postedDate),
    responseDeadline: parseDate(opportunity.dueDate),
    archiveDate: null,
    sourceUrl: opportunity.url,
    sourceId: opportunity.bidId,
    source: 'BOSTON_GOV' as const,
    awardAmount: null,
  };
}

