import FirecrawlApp from '@mendable/firecrawl-js';
import { CommbuysOpportunity } from '@/types';

// City of Boston bids
const BOSTON_BIDS_URL = 'https://www.boston.gov/bid-listings';
const BOSTON_BASE_URL = 'https://www.boston.gov';

// Real COMMBUYS (Massachusetts statewide)
const COMMBUYS_PUBLIC_BIDS_URL = 'https://www.commbuys.com/bso/external/publicBids.sdo';
const COMMBUYS_BASE_URL = 'https://www.commbuys.com';

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
 * Parse opportunity data from real COMMBUYS public bids page
 * The page typically has a table with columns: Bid ID, Title, Organization, Due Date, etc.
 */
function parseCommbuysOpportunitiesFromContent(content: string): CommbuysOpportunity[] {
  const opportunities: CommbuysOpportunity[] = [];
  const lines = content.split('\n');

  // COMMBUYS format typically includes table rows with bid information
  // Looking for patterns like:
  // | Bid ID | Title | Organization | Due Date |
  // or markdown links to bid details

  let currentBid: Partial<CommbuysOpportunity> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) continue;

    // Match bid links: [BD-XX-XXXX-XXXX...](url) or similar patterns
    const bidLinkMatch = line.match(/\[(BD-[\w-]+)\]\(([^)]+)\)/i);
    if (bidLinkMatch) {
      // Save previous bid
      if (currentBid && currentBid.bidId) {
        opportunities.push(currentBid as CommbuysOpportunity);
      }

      const bidId = bidLinkMatch[1];
      const url = bidLinkMatch[2].startsWith('http')
        ? bidLinkMatch[2]
        : `${COMMBUYS_BASE_URL}${bidLinkMatch[2]}`;

      currentBid = {
        bidId,
        title: bidId, // Will be overwritten if title found
        description: null,
        agency: 'Commonwealth of Massachusetts',
        category: null,
        postedDate: null,
        dueDate: null,
        status: 'Open',
        url,
      };
      continue;
    }

    // Match standalone bid IDs (BD-XX-XXXX format)
    const bidIdMatch = line.match(/^(BD-[\w-]+)/i);
    if (bidIdMatch && !currentBid) {
      currentBid = {
        bidId: bidIdMatch[1],
        title: bidIdMatch[1],
        description: null,
        agency: 'Commonwealth of Massachusetts',
        category: null,
        postedDate: null,
        dueDate: null,
        status: 'Open',
        url: `${COMMBUYS_BASE_URL}/bso/external/bidDetail.sdo?bidId=${bidIdMatch[1]}`,
      };
      continue;
    }

    // If we have a current bid, try to extract more info
    if (currentBid) {
      // Look for title (usually follows the bid ID)
      if (currentBid.title === currentBid.bidId && line.length > 10 && !line.startsWith('|') && !line.startsWith('-')) {
        // Likely a title line
        const cleanTitle = line.replace(/^\*+|\*+$/g, '').trim();
        if (cleanTitle && !cleanTitle.match(/^(BD-|Due|Posted|Open|Close)/i)) {
          currentBid.title = cleanTitle;
        }
      }

      // Look for organization/agency
      const orgMatch = line.match(/(?:Organization|Agency|Department):\s*(.+)/i);
      if (orgMatch) {
        currentBid.agency = orgMatch[1].trim();
      }

      // Look for due date patterns
      const dueDateMatch = line.match(/(?:Due|Deadline|Close[sd]?):\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (dueDateMatch) {
        currentBid.dueDate = dueDateMatch[1];
      }

      // Also check for date on same line as "Due Date"
      const dueDateAlt = line.match(/(\d{1,2}\/\d{1,2}\/\d{2,4}).*(?:due|deadline)/i);
      if (dueDateAlt && !currentBid.dueDate) {
        currentBid.dueDate = dueDateAlt[1];
      }

      // Look for posted date
      const postedMatch = line.match(/(?:Posted|Published|Open):\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (postedMatch) {
        currentBid.postedDate = postedMatch[1];
      }

      // Check for table row format: | value | value | value |
      if (line.startsWith('|') && line.includes('|')) {
        const cells = line.split('|').map(c => c.trim()).filter(Boolean);
        // Try to identify what each cell contains
        for (const cell of cells) {
          // Date pattern
          const dateMatch = cell.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})$/);
          if (dateMatch) {
            if (!currentBid.dueDate) {
              currentBid.dueDate = dateMatch[1];
            } else if (!currentBid.postedDate) {
              currentBid.postedDate = dateMatch[1];
            }
          }
        }
      }
    }
  }

  // Don't forget last bid
  if (currentBid && currentBid.bidId) {
    opportunities.push(currentBid as CommbuysOpportunity);
  }

  return opportunities;
}

/**
 * Fetch opportunities from real COMMBUYS (Massachusetts statewide)
 */
async function fetchRealCommbuysOpportunities(
  limit: number = 50
): Promise<CommbuysOpportunity[]> {
  const client = getFirecrawl();

  try {
    const result = await client.scrapeUrl(COMMBUYS_PUBLIC_BIDS_URL, {
      formats: ['markdown'],
    });

    if (!result.success) {
      throw new CommbuysApiError(
        'Failed to scrape COMMBUYS',
        undefined,
        result
      );
    }

    const content = result.markdown || '';
    const opportunities = parseCommbuysOpportunitiesFromContent(content);

    return opportunities.slice(0, limit);
  } catch (error) {
    if (error instanceof CommbuysApiError) {
      throw error;
    }
    throw new CommbuysApiError(
      `Failed to fetch from COMMBUYS: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Normalize real COMMBUYS opportunity to ContractLead format
 */
function normalizeRealCommbuysOpportunity(opportunity: CommbuysOpportunity) {
  const parseDate = (dateStr: string | null): Date | null => {
    if (!dateStr) return null;

    // Handle MM/DD/YYYY or MM/DD/YY format
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/').map(Number);
      if (parts.length === 3) {
        let [month, day, year] = parts;
        // Handle 2-digit year
        if (year < 100) {
          year += year > 50 ? 1900 : 2000;
        }
        const date = new Date(year, month - 1, day);
        return isNaN(date.getTime()) ? null : date;
      }
    }

    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

  return {
    title: opportunity.title,
    description: opportunity.description,
    agency: opportunity.agency || 'Commonwealth of Massachusetts',
    subAgency: null,
    solicitationNumber: opportunity.bidId,
    noticeType: opportunity.status || 'Open',
    naicsCodes: [] as string[],
    pscCode: null,
    placeOfPerformance: 'Massachusetts',
    postedDate: parseDate(opportunity.postedDate),
    responseDeadline: parseDate(opportunity.dueDate),
    archiveDate: null,
    sourceUrl: opportunity.url,
    sourceId: `COMMBUYS-${opportunity.bidId}`,
    source: 'COMMBUYS' as const,
    awardAmount: null,
  };
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
 * Fetch all MA opportunities (Boston.gov + COMMBUYS)
 */
export async function fetchAllMassachusettsOpportunities(
  bostonLimit: number = 25,
  commbuysLimit: number = 50
): Promise<NormalizedOpportunity[]> {
  const results: NormalizedOpportunity[] = [];

  // Fetch from Boston.gov
  try {
    const bostonOpportunities = await fetchRawCommbuysOpportunities(bostonLimit);
    results.push(...bostonOpportunities.map(normalizeCommbuysOpportunity));
  } catch (error) {
    console.error('Failed to fetch Boston.gov opportunities:', error);
  }

  // Fetch from real COMMBUYS
  try {
    const commbuysOpportunities = await fetchRealCommbuysOpportunities(commbuysLimit);
    results.push(...commbuysOpportunities.map(normalizeRealCommbuysOpportunity));
  } catch (error) {
    console.error('Failed to fetch COMMBUYS opportunities:', error);
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

