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
 * Format: [TITLE](https://www.boston.gov/bid-listings/ID "Title")
 * Followed by:
 *   - Posted:
 *   01/05/2026 - 9:00am
 *   - Due:01/21/2026 - 12:00pm
 */
function parseOpportunitiesFromContent(content: string): CommbuysOpportunity[] {
  const opportunities: CommbuysOpportunity[] = [];
  const lines = content.split('\n');

  let currentBid: Partial<CommbuysOpportunity> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match bid title links with full URL:
    // [Speed Radar Feedback Signs](https://www.boston.gov/bid-listings/ev00016951 "Speed Radar Feedback Signs ")
    const titleMatch = line.match(/^\[([^\]]+)\]\(https:\/\/www\.boston\.gov\/bid-listings\/([^\s\)"]+)/);

    if (titleMatch) {
      const title = titleMatch[1].trim();

      // Skip email links (contact info also links to bid page)
      if (title.includes('@')) {
        continue;
      }
      // Save previous bid if exists
      if (currentBid && currentBid.bidId) {
        opportunities.push(currentBid as CommbuysOpportunity);
      }

      const urlSlug = titleMatch[2].trim();

      // Extract EV number from URL slug (e.g., ev00016951)
      const bidId = urlSlug.toUpperCase().startsWith('EV')
        ? urlSlug.toUpperCase()
        : `BOSTON-${urlSlug}`;

      currentBid = {
        bidId,
        title,
        description: null,
        agency: 'City of Boston',
        category: null,
        postedDate: null,
        dueDate: null,
        status: 'Open',
        url: `${BOSTON_BASE_URL}/bid-listings/${urlSlug}`,
      };
    }

    if (currentBid) {
      // Check if this line is "- Posted:" and next line has the date
      if (line.match(/^-?\s*Posted:?\s*$/i)) {
        const nextLine = lines[i + 1]?.trim();
        const dateMatch = nextLine?.match(/^(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (dateMatch) {
          currentBid.postedDate = dateMatch[1];
        }
      }

      // Check if this line is "- Due:" with date on same line or next line
      // Format: "- Due:01/21/2026 - 12:00pm"
      const dueInlineMatch = line.match(/^-?\s*Due:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (dueInlineMatch) {
        currentBid.dueDate = dueInlineMatch[1];
      } else if (line.match(/^-?\s*Due:?\s*$/i)) {
        const nextLine = lines[i + 1]?.trim();
        const dateMatch = nextLine?.match(/^(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (dateMatch) {
          currentBid.dueDate = dateMatch[1];
        }
      }

      // Also check for date on the current line (standalone date line after Posted:)
      if (!currentBid.postedDate && lines[i - 1]?.trim().match(/^-?\s*Posted:?\s*$/i)) {
        const dateMatch = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (dateMatch) {
          currentBid.postedDate = dateMatch[1];
        }
      }
    }
  }

  // Don't forget the last bid
  if (currentBid && currentBid.bidId) {
    opportunities.push(currentBid as CommbuysOpportunity);
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

