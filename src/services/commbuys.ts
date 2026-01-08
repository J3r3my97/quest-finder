import FirecrawlApp from '@mendable/firecrawl-js';
import { CommbuysOpportunity } from '@/types';

// City of Boston bids
const BOSTON_BIDS_URL = 'https://www.boston.gov/bid-listings';
const BOSTON_BASE_URL = 'https://www.boston.gov';

// City of Worcester bids
const WORCESTER_BIDS_URL = 'https://www.worcesterma.gov/finance/purchasing-bids/bids/open-bids';
const WORCESTER_BASE_URL = 'https://www.worcesterma.gov';

// City of Springfield bids
const SPRINGFIELD_BIDS_URL = 'https://www.springfield-ma.gov/finance/procurement-bids/';
const SPRINGFIELD_BASE_URL = 'https://www.springfield-ma.gov';

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
 * Parse Worcester bid listings from markdown
 * Format: | Bid Number | Title | Due Date | Department |
 */
function parseWorcesterOpportunities(content: string): CommbuysOpportunity[] {
  const opportunities: CommbuysOpportunity[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Match table rows: | 8614-M6 | South Freight Elevator Repairs... | 01/12/2026 - 4:00 PM | Facilities |
    if (!line.startsWith('|') || line.includes('---')) continue;

    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 3) continue;

    // Skip header row
    if (cells[0].toLowerCase() === 'bid number') continue;

    const bidId = cells[0];
    const title = cells[1];
    const dueDateRaw = cells[2];

    // Skip if doesn't look like a bid number
    if (!bidId.match(/^[\w-]+$/)) continue;

    // Extract date from "01/12/2026 - 4:00 PM"
    const dateMatch = dueDateRaw.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    const dueDate = dateMatch ? dateMatch[1] : null;

    // Extract department if available
    const department = cells.length >= 4 ? cells[3] : null;

    opportunities.push({
      bidId: `WORC-${bidId}`,
      title,
      description: department ? `Department: ${department}` : null,
      agency: 'City of Worcester',
      category: department,
      postedDate: null,
      dueDate,
      status: 'Open',
      url: `${WORCESTER_BASE_URL}/finance/purchasing-bids/bids/${bidId.toLowerCase()}`,
    });
  }

  return opportunities;
}

/**
 * Fetch opportunities from Worcester, MA
 */
async function fetchWorcesterOpportunities(limit: number = 25): Promise<CommbuysOpportunity[]> {
  const client = getFirecrawl();

  try {
    const result = await client.scrapeUrl(WORCESTER_BIDS_URL, {
      formats: ['markdown'],
    });

    if (!result.success) {
      throw new CommbuysApiError('Failed to scrape Worcester bids', undefined, result);
    }

    const content = result.markdown || '';
    const opportunities = parseWorcesterOpportunities(content);

    return opportunities.slice(0, limit);
  } catch (error) {
    if (error instanceof CommbuysApiError) throw error;
    throw new CommbuysApiError(
      `Failed to fetch from Worcester: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Parse Springfield bid listings from markdown
 * Format: 26-089 | "Title" | Tuesday, January 13, 2026 at 2 p.m.
 */
function parseSpringfieldOpportunities(content: string): CommbuysOpportunity[] {
  const opportunities: CommbuysOpportunity[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Match table rows: | 26-089 | "Title" | Tuesday, January 13, 2026 at 2 p.m. |
    if (!line.startsWith('|') || line.includes('---')) continue;

    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 3) continue;

    // Skip header row
    if (cells[0].toLowerCase() === 'bid number') continue;

    const bidId = cells[0];
    // Remove quotes from title
    const title = cells[1].replace(/^["']|["']$/g, '');
    const dueDateRaw = cells[2];

    // Skip if doesn't look like a Springfield bid number (XX-XXX format)
    if (!bidId.match(/^\d+-\d+$/)) continue;

    // Parse date like "Tuesday, January 13, 2026 at 2 p.m."
    const dateMatch = dueDateRaw.match(/(\w+),?\s+(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
    let dueDate: string | null = null;
    if (dateMatch) {
      const monthNames: Record<string, number> = {
        january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
      };
      const month = monthNames[dateMatch[2].toLowerCase()];
      if (month) {
        dueDate = `${month}/${dateMatch[3]}/${dateMatch[4]}`;
      }
    }

    opportunities.push({
      bidId: `SPFLD-${bidId}`,
      title,
      description: null,
      agency: 'City of Springfield',
      category: null,
      postedDate: null,
      dueDate,
      status: 'Open',
      url: `${SPRINGFIELD_BASE_URL}/finance/procurement-bids/bid_detail.php?bid=${bidId.replace('-', '')}`,
    });
  }

  return opportunities;
}

/**
 * Fetch opportunities from Springfield, MA
 */
async function fetchSpringfieldOpportunities(limit: number = 25): Promise<CommbuysOpportunity[]> {
  const client = getFirecrawl();

  try {
    const result = await client.scrapeUrl(SPRINGFIELD_BIDS_URL, {
      formats: ['markdown'],
    });

    if (!result.success) {
      throw new CommbuysApiError('Failed to scrape Springfield bids', undefined, result);
    }

    const content = result.markdown || '';
    const opportunities = parseSpringfieldOpportunities(content);

    return opportunities.slice(0, limit);
  } catch (error) {
    if (error instanceof CommbuysApiError) throw error;
    throw new CommbuysApiError(
      `Failed to fetch from Springfield: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Common type for normalized opportunities from any MA source
interface NormalizedOpportunity {
  title: string;
  description: string | null;
  agency: string;
  subAgency: string | null;
  solicitationNumber: string | null;
  noticeType: string | null;
  naicsCodes: string[];
  pscCode: string | null;
  placeOfPerformance: string | null;
  postedDate: Date | null;
  responseDeadline: Date | null;
  archiveDate: Date | null;
  sourceUrl: string | null;
  sourceId: string;
  source: string;
  awardAmount: number | null;
}

/**
 * Normalize Worcester/Springfield opportunity to ContractLead format
 */
function normalizeCityOpportunity(opportunity: CommbuysOpportunity, source: string): NormalizedOpportunity {
  const parseDate = (dateStr: string | null): Date | null => {
    if (!dateStr) return null;

    if (dateStr.includes('/')) {
      const parts = dateStr.split('/').map(Number);
      if (parts.length === 3) {
        let [month, day, year] = parts;
        if (year < 100) year += year > 50 ? 1900 : 2000;
        const date = new Date(year, month - 1, day);
        return isNaN(date.getTime()) ? null : date;
      }
    }

    return null;
  };

  return {
    title: opportunity.title,
    description: opportunity.description,
    agency: opportunity.agency,
    subAgency: opportunity.category || null,
    solicitationNumber: opportunity.bidId,
    noticeType: 'Open',
    naicsCodes: [] as string[],
    pscCode: null,
    placeOfPerformance: `${opportunity.agency?.replace('City of ', '')}, Massachusetts`,
    postedDate: parseDate(opportunity.postedDate),
    responseDeadline: parseDate(opportunity.dueDate),
    archiveDate: null,
    sourceUrl: opportunity.url,
    sourceId: opportunity.bidId,
    source,
    awardAmount: null,
  };
}

/**
 * Fetch all MA opportunities (Boston + Worcester + Springfield)
 * COMMBUYS.com blocks web scraping, so we fetch from city sites instead
 */
export async function fetchAllMassachusettsOpportunities(
  bostonLimit: number = 25,
  worcesterLimit: number = 25,
  springfieldLimit: number = 25
): Promise<NormalizedOpportunity[]> {
  const results: NormalizedOpportunity[] = [];

  // Fetch from Boston.gov
  try {
    const bostonOpportunities = await fetchRawCommbuysOpportunities(bostonLimit);
    results.push(...bostonOpportunities.map(normalizeCommbuysOpportunity));
    console.log(`Fetched ${bostonOpportunities.length} opportunities from Boston`);
  } catch (error) {
    console.error('Failed to fetch Boston.gov opportunities:', error);
  }

  // Fetch from Worcester
  try {
    const worcesterOpportunities = await fetchWorcesterOpportunities(worcesterLimit);
    results.push(...worcesterOpportunities.map(o => normalizeCityOpportunity(o, 'WORCESTER_GOV')));
    console.log(`Fetched ${worcesterOpportunities.length} opportunities from Worcester`);
  } catch (error) {
    console.error('Failed to fetch Worcester opportunities:', error);
  }

  // Fetch from Springfield
  try {
    const springfieldOpportunities = await fetchSpringfieldOpportunities(springfieldLimit);
    results.push(...springfieldOpportunities.map(o => normalizeCityOpportunity(o, 'SPRINGFIELD_GOV')));
    console.log(`Fetched ${springfieldOpportunities.length} opportunities from Springfield`);
  } catch (error) {
    console.error('Failed to fetch Springfield opportunities:', error);
  }

  return results;
}

/**
 * Normalize Boston.gov opportunity to ContractLead format for database storage
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

