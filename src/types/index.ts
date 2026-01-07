// User types
export interface User {
  id: string;
  email: string;
  name: string | null;
  subscriptionTier: SubscriptionTier;
  createdAt: Date;
}

export type SubscriptionTier = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';

// Contract types
export interface ContractLead {
  id: string;
  title: string;
  agency: string;
  subAgency?: string | null;
  description?: string | null;
  solicitationNumber?: string | null;
  noticeType?: string | null;
  contractType?: string | null;
  estimatedValue?: number | null;
  awardAmount?: number | null;
  naicsCodes: string[];
  pscCode?: string | null;
  setAsideType?: string | null;
  placeOfPerformance?: string | null;
  postedDate?: Date | null;
  responseDeadline?: Date | null;
  archiveDate?: Date | null;
  sourceUrl?: string | null;
  sourceId?: string | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

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

// Search types
export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  filters: ContractSearchFilters;
  createdAt: Date;
  updatedAt: Date;
}

// Alert types
export interface Alert {
  id: string;
  userId: string;
  savedSearchId: string;
  frequency: AlertFrequency;
  isActive: boolean;
  lastSentAt: Date | null;
  lastMatchCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type AlertFrequency = 'REALTIME' | 'DAILY' | 'WEEKLY';

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

export interface ApiError {
  message: string;
  code?: string;
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

export type SetAsideTypeCode = (typeof SET_ASIDE_TYPES)[number];
export type SetAsideType = SetAsideTypeCode;

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

// COMMBUYS (Massachusetts) types
export interface CommbuysOpportunity {
  bidId: string;
  title: string;
  description: string | null;
  agency: string;
  category: string | null;
  postedDate: string | null;
  dueDate: string | null;
  status: string | null;
  url: string | null;
}
