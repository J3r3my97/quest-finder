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
 * Format: [TITLE](/bid-listings/ID) followed by * Posted: and * Due: lines
 */
function parseOpportunitiesFromContent(content: string): CommbuysOpportunity[] {
  const opportunities: CommbuysOpportunity[] = [];
  const lines = content.split('\n');

  let currentBid: Partial<CommbuysOpportunity> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match bid title links: [Title](/bid-listings/ID "Title") or [Title](/departments/...)
    // Format: [PROJECT TITLE](/bid-listings/family-overdose-support-fund-0 "PROJECT TITLE")
    const titleMatch = line.match(/^\[([^\]]+)\]\(\/bid-listings\/([^\s\)]+)/);

    if (titleMatch) {
      // Save previous bid if exists
      if (currentBid && currentBid.bidId) {
        opportunities.push(currentBid as CommbuysOpportunity);
      }

      const title = titleMatch[1].trim();
      const urlSlug = titleMatch[2].replace(/["'].*$/, '').trim();

      // Extract EV number if present in title or nearby
      const evMatch = line.match(/\(?(EV\d+)\)?/);
      const bidId = evMatch ? evMatch[1] : `BOSTON-${urlSlug}`;

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

    // Parse Posted date: "* Posted: 01/07/2026" or "Posted: 01/07/2026"
    if (currentBid) {
      const postedMatch = line.match(/Posted[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (postedMatch) {
        currentBid.postedDate = postedMatch[1];
      }

      // Parse Due date: "* Due: 01/22/2026" or "Due: 01/22/2026"
      const dueMatch = line.match(/Due[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (dueMatch) {
        currentBid.dueDate = dueMatch[1];
      }

      // Parse Contact name (usually appears after "Contact:")
      if (line.match(/^Contact/i) || (lines[i-1] && lines[i-1].match(/Contact/i))) {
        // Next non-empty line might be contact name
        const nextLine = lines[i + 1]?.trim();
        if (nextLine && !nextLine.startsWith('*') && !nextLine.startsWith('[') && nextLine.length > 2) {
          currentBid.description = `Contact: ${nextLine}`;
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

