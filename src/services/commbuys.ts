import FirecrawlApp from '@mendable/firecrawl-js';
import { CommbuysOpportunity } from '@/types';

const COMMBUYS_BASE_URL = 'https://www.commbuys.com';
const COMMBUYS_BIDS_URL = `${COMMBUYS_BASE_URL}/bso/external/publicBids.sdo`;

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
 * Parse opportunity data from scraped markdown/HTML content
 */
function parseOpportunitiesFromContent(content: string): CommbuysOpportunity[] {
  const opportunities: CommbuysOpportunity[] = [];

  // COMMBUYS typically displays bids in a table format
  // We'll parse the content to extract bid information
  // The exact parsing depends on the page structure

  // Look for bid patterns - COMMBUYS uses bid IDs like "BD-XX-XXXX-XXXXX"
  const bidIdPattern = /BD-\d{2}-\d{4}-[A-Z0-9]+/g;
  const bidIds = content.match(bidIdPattern) || [];

  // Extract unique bid IDs
  const uniqueBidIds = [...new Set(bidIds)];

  // Parse the content line by line to extract structured data
  const lines = content.split('\n');
  let currentOpportunity: Partial<CommbuysOpportunity> | null = null;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check if this line contains a bid ID
    const bidIdMatch = trimmedLine.match(/BD-\d{2}-\d{4}-[A-Z0-9]+/);
    if (bidIdMatch) {
      // Save previous opportunity if exists
      if (currentOpportunity && currentOpportunity.bidId) {
        opportunities.push({
          bidId: currentOpportunity.bidId,
          title: currentOpportunity.title || 'Untitled',
          description: currentOpportunity.description || null,
          agency: currentOpportunity.agency || 'Commonwealth of Massachusetts',
          category: currentOpportunity.category || null,
          postedDate: currentOpportunity.postedDate || null,
          dueDate: currentOpportunity.dueDate || null,
          status: currentOpportunity.status || null,
          url: currentOpportunity.url || `${COMMBUYS_BASE_URL}/bso/external/bidDetail.sdo?bidId=${currentOpportunity.bidId}`,
        });
      }

      currentOpportunity = {
        bidId: bidIdMatch[0],
        agency: 'Commonwealth of Massachusetts',
      };

      // The title often follows the bid ID on the same line or nearby
      const afterBidId = trimmedLine.substring(trimmedLine.indexOf(bidIdMatch[0]) + bidIdMatch[0].length).trim();
      if (afterBidId && afterBidId.length > 3) {
        currentOpportunity.title = afterBidId.replace(/^[-|:]\s*/, '');
      }
    }

    // Look for date patterns (MM/DD/YYYY or YYYY-MM-DD)
    if (currentOpportunity) {
      const datePattern = /(\d{1,2}\/\d{1,2}\/\d{4})|(\d{4}-\d{2}-\d{2})/g;
      const dates = trimmedLine.match(datePattern);

      if (dates && dates.length > 0) {
        // First date is usually posted date, second is due date
        if (!currentOpportunity.postedDate && dates[0]) {
          currentOpportunity.postedDate = dates[0];
        }
        if (!currentOpportunity.dueDate && dates[1]) {
          currentOpportunity.dueDate = dates[1];
        } else if (!currentOpportunity.dueDate && dates[0] && trimmedLine.toLowerCase().includes('due')) {
          currentOpportunity.dueDate = dates[0];
        }
      }

      // Look for agency names
      if (trimmedLine.includes('Department') || trimmedLine.includes('Office of') || trimmedLine.includes('Division')) {
        if (!currentOpportunity.agency || currentOpportunity.agency === 'Commonwealth of Massachusetts') {
          currentOpportunity.agency = trimmedLine.substring(0, 100); // Limit length
        }
      }

      // Look for status
      const statusPatterns = ['Open', 'Closed', 'Active', 'Awarded', 'Pending'];
      for (const status of statusPatterns) {
        if (trimmedLine.includes(status)) {
          currentOpportunity.status = status;
          break;
        }
      }
    }
  }

  // Don't forget the last opportunity
  if (currentOpportunity && currentOpportunity.bidId) {
    opportunities.push({
      bidId: currentOpportunity.bidId,
      title: currentOpportunity.title || 'Untitled',
      description: currentOpportunity.description || null,
      agency: currentOpportunity.agency || 'Commonwealth of Massachusetts',
      category: currentOpportunity.category || null,
      postedDate: currentOpportunity.postedDate || null,
      dueDate: currentOpportunity.dueDate || null,
      status: currentOpportunity.status || null,
      url: currentOpportunity.url || `${COMMBUYS_BASE_URL}/bso/external/bidDetail.sdo?bidId=${currentOpportunity.bidId}`,
    });
  }

  // If we couldn't parse structured data, create entries from unique bid IDs
  if (opportunities.length === 0 && uniqueBidIds.length > 0) {
    for (const bidId of uniqueBidIds) {
      opportunities.push({
        bidId,
        title: 'Untitled Opportunity',
        description: null,
        agency: 'Commonwealth of Massachusetts',
        category: null,
        postedDate: null,
        dueDate: null,
        status: null,
        url: `${COMMBUYS_BASE_URL}/bso/external/bidDetail.sdo?bidId=${bidId}`,
      });
    }
  }

  return opportunities;
}

/**
 * Fetch raw opportunities from COMMBUYS using Firecrawl
 */
async function fetchRawCommbuysOpportunities(
  limit: number = 25
): Promise<CommbuysOpportunity[]> {
  const client = getFirecrawl();

  try {
    const result = await client.scrapeUrl(COMMBUYS_BIDS_URL, {
      formats: ['markdown', 'html'],
    });

    if (!result.success) {
      throw new CommbuysApiError(
        'Failed to scrape COMMBUYS',
        undefined,
        result
      );
    }

    // Parse opportunities from the scraped content
    const content = result.markdown || result.html || '';
    const opportunities = parseOpportunitiesFromContent(content);

    // Return limited results
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
    placeOfPerformance: 'Massachusetts',
    postedDate: parseDate(opportunity.postedDate),
    responseDeadline: parseDate(opportunity.dueDate),
    archiveDate: null,
    sourceUrl: opportunity.url,
    sourceId: opportunity.bidId,
    source: 'COMMBUYS' as const,
    awardAmount: null,
  };
}

