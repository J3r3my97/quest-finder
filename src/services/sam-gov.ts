import {
  ContractSearchFilters,
  SamGovOpportunity,
  SamGovSearchResponse,
} from '@/types';

const SAM_GOV_API_URL =
  process.env.SAM_GOV_API_URL || 'https://api.sam.gov/opportunities/v2/search';
const SAM_GOV_API_KEY = process.env.SAM_GOV_API_KEY || '';

// Rate limiting: SAM.gov allows 10 requests per second
const RATE_LIMIT_DELAY_MS = 100;
let lastRequestTime = 0;

async function rateLimitedFetch(url: string, options: RequestInit): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_DELAY_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, RATE_LIMIT_DELAY_MS - timeSinceLastRequest)
    );
  }

  lastRequestTime = Date.now();
  return fetch(url, options);
}

export class SamGovApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'SamGovApiError';
  }
}

interface SamGovSearchParams {
  filters: ContractSearchFilters;
  limit?: number;
  offset?: number;
}

/**
 * Build query parameters for SAM.gov API from our filter format
 */
function buildQueryParams(params: SamGovSearchParams): URLSearchParams {
  const { filters, limit = 25, offset = 0 } = params;
  const queryParams = new URLSearchParams();

  queryParams.set('api_key', SAM_GOV_API_KEY);
  queryParams.set('limit', limit.toString());
  queryParams.set('offset', offset.toString());

  // Keyword search
  if (filters.keyword) {
    queryParams.set('q', filters.keyword);
  }

  // NAICS codes
  if (filters.naicsCodes && filters.naicsCodes.length > 0) {
    queryParams.set('naics', filters.naicsCodes.join(','));
  }

  // Posted date range
  if (filters.postedDateFrom) {
    queryParams.set('postedFrom', filters.postedDateFrom);
  }
  if (filters.postedDateTo) {
    queryParams.set('postedTo', filters.postedDateTo);
  }

  // Response deadline range
  if (filters.responseDeadlineFrom) {
    queryParams.set('rdlfrom', filters.responseDeadlineFrom);
  }
  if (filters.responseDeadlineTo) {
    queryParams.set('rdlto', filters.responseDeadlineTo);
  }

  // Set-aside type
  if (filters.setAsideType) {
    queryParams.set('typeOfSetAside', filters.setAsideType);
  }

  // Notice type
  if (filters.noticeType) {
    queryParams.set('ptype', filters.noticeType);
  }

  // Place of performance (state code)
  if (filters.placeOfPerformance) {
    queryParams.set('state', filters.placeOfPerformance);
  }

  return queryParams;
}

/**
 * Search for contract opportunities on SAM.gov
 */
export async function searchOpportunities(
  params: SamGovSearchParams
): Promise<SamGovSearchResponse> {
  if (!SAM_GOV_API_KEY) {
    throw new SamGovApiError('SAM.gov API key is not configured');
  }

  const queryParams = buildQueryParams(params);
  const url = `${SAM_GOV_API_URL}?${queryParams.toString()}`;

  try {
    const response = await rateLimitedFetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new SamGovApiError(
        `SAM.gov API error: ${response.statusText}`,
        response.status,
        errorBody
      );
    }

    const data = await response.json();
    return data as SamGovSearchResponse;
  } catch (error) {
    if (error instanceof SamGovApiError) {
      throw error;
    }
    throw new SamGovApiError(
      `Failed to fetch from SAM.gov: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a single opportunity by notice ID
 */
export async function getOpportunityById(
  noticeId: string
): Promise<SamGovOpportunity | null> {
  if (!SAM_GOV_API_KEY) {
    throw new SamGovApiError('SAM.gov API key is not configured');
  }

  const url = `https://api.sam.gov/opportunities/v2/search?api_key=${SAM_GOV_API_KEY}&noticeId=${noticeId}`;

  try {
    const response = await rateLimitedFetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const errorBody = await response.text();
      throw new SamGovApiError(
        `SAM.gov API error: ${response.statusText}`,
        response.status,
        errorBody
      );
    }

    const data: SamGovSearchResponse = await response.json();
    return data.opportunitiesData?.[0] || null;
  } catch (error) {
    if (error instanceof SamGovApiError) {
      throw error;
    }
    throw new SamGovApiError(
      `Failed to fetch from SAM.gov: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Normalize SAM.gov opportunity to our ContractLead format for database storage
 */
export function normalizeOpportunity(opportunity: SamGovOpportunity) {
  const parseDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

  const extractAgency = (fullParentPathName?: string): { agency: string; subAgency?: string } => {
    if (!fullParentPathName) {
      return { agency: 'Unknown' };
    }
    const parts = fullParentPathName.split('.');
    return {
      agency: parts[0] || 'Unknown',
      subAgency: parts.slice(1).join('.') || undefined,
    };
  };

  const formatPlaceOfPerformance = (pop?: SamGovOpportunity['placeOfPerformance']): string | null => {
    if (!pop) return null;
    const parts = [pop.city?.name, pop.state?.name, pop.country?.name].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const { agency, subAgency } = extractAgency(opportunity.fullParentPathName);

  return {
    title: opportunity.title,
    description: opportunity.description || null,
    agency,
    subAgency,
    solicitationNumber: opportunity.solicitationNumber || null,
    noticeType: opportunity.type || null,
    naicsCodes: opportunity.naicsCode ? [opportunity.naicsCode] : [],
    pscCode: opportunity.classificationCode || null,
    placeOfPerformance: formatPlaceOfPerformance(opportunity.placeOfPerformance),
    postedDate: parseDate(opportunity.postedDate),
    responseDeadline: parseDate(opportunity.responseDeadLine),
    archiveDate: parseDate(opportunity.archiveDate),
    sourceUrl: opportunity.links?.find((l) => l.rel === 'self')?.href || null,
    sourceId: opportunity.noticeId,
    source: 'SAM.gov',
    awardAmount: opportunity.award?.amount ? parseFloat(opportunity.award.amount) : null,
  };
}

/**
 * Fetch and normalize multiple pages of opportunities
 */
export async function fetchAllOpportunities(
  filters: ContractSearchFilters,
  maxResults = 1000
): Promise<ReturnType<typeof normalizeOpportunity>[]> {
  const results: ReturnType<typeof normalizeOpportunity>[] = [];
  const pageSize = 100;
  let offset = 0;

  while (results.length < maxResults) {
    const response = await searchOpportunities({
      filters,
      limit: pageSize,
      offset,
    });

    if (!response.opportunitiesData || response.opportunitiesData.length === 0) {
      break;
    }

    const normalized = response.opportunitiesData.map(normalizeOpportunity);
    results.push(...normalized);

    if (response.opportunitiesData.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return results.slice(0, maxResults);
}
