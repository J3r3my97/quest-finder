// Search filter types for contracts
export interface ContractSearchFilters {
  keyword?: string;
  naicsCodes?: string[];
  agency?: string;
  setAsideType?: string;
  noticeType?: string;
  postedDateFrom?: string;
  postedDateTo?: string;
  responseDeadlineFrom?: string;
  responseDeadlineTo?: string;
  estimatedValueMin?: number;
  estimatedValueMax?: number;
  placeOfPerformance?: string;
}

// Pagination
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: 'postedDate' | 'responseDeadline' | 'estimatedValue' | 'title';
  sortOrder?: 'asc' | 'desc';
}

// API response types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// SAM.gov API types
export interface SamGovOpportunity {
  noticeId: string;
  title: string;
  solicitationNumber?: string;
  fullParentPathName?: string;
  postedDate?: string;
  type?: string;
  baseType?: string;
  archiveType?: string;
  archiveDate?: string;
  responseDeadLine?: string;
  naicsCode?: string;
  classificationCode?: string;
  active?: string;
  description?: string;
  organizationType?: string;
  officeAddress?: {
    zipcode?: string;
    city?: string;
    countryCode?: string;
    state?: string;
  };
  placeOfPerformance?: {
    city?: {
      name?: string;
    };
    state?: {
      code?: string;
      name?: string;
    };
    country?: {
      code?: string;
      name?: string;
    };
  };
  award?: {
    date?: string;
    number?: string;
    amount?: string;
  };
  pointOfContact?: Array<{
    type?: string;
    fullName?: string;
    email?: string;
    phone?: string;
  }>;
  links?: Array<{
    rel?: string;
    href?: string;
  }>;
  resourceLinks?: string[];
}

export interface SamGovSearchResponse {
  totalRecords: number;
  limit: number;
  offset: number;
  opportunitiesData: SamGovOpportunity[];
}

// Set-aside types
export const SET_ASIDE_TYPES = [
  'SBA',
  'SBP',
  '8A',
  '8AN',
  'HZC',
  'HZS',
  'SDVOSBC',
  'SDVOSBS',
  'WOSB',
  'WOSBSS',
  'EDWOSB',
  'EDWOSBSS',
  'LAS',
  'IEE',
  'ISBEE',
  'BICiv',
  'VSA',
  'VSB',
] as const;

export type SetAsideType = (typeof SET_ASIDE_TYPES)[number];

// Notice types
export const NOTICE_TYPES = [
  'Presolicitation',
  'Combined Synopsis/Solicitation',
  'Sources Sought',
  'Special Notice',
  'Sale of Surplus Property',
  'Award Notice',
  'Intent to Bundle',
  'Justification',
] as const;

export type NoticeType = (typeof NOTICE_TYPES)[number];
