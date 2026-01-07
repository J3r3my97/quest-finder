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

// Company profile for contract matching
export interface CompanyProfile {
  id: string;
  userId: string;
  companyName: string;
  naicsCodes: string[];
  certifications: string[];
  preferredStates: string[];
  minContractValue: number | null;
  maxContractValue: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// Contract with match scoring
export interface MatchedContract {
  contract: ContractLead;
  matchScore: number; // 0-100
  matchReasons: string[]; // ["NAICS match", "Set-aside eligible", etc.]
}

// Certification types for set-aside matching
export const CERTIFICATION_TYPES = [
  { code: '8A', label: '8(a) Business Development', setAsideCodes: ['8A', '8AN'] },
  { code: 'HZC', label: 'HUBZone', setAsideCodes: ['HZC', 'HZS'] },
  { code: 'SDVOSB', label: 'Service-Disabled Veteran-Owned', setAsideCodes: ['SDVOSBC', 'SDVOSBS'] },
  { code: 'WOSB', label: 'Woman-Owned Small Business', setAsideCodes: ['WOSB', 'WOSBSS'] },
  { code: 'EDWOSB', label: 'Economically Disadvantaged WOSB', setAsideCodes: ['EDWOSB', 'EDWOSBSS'] },
  { code: 'SBA', label: 'Small Business', setAsideCodes: ['SBA', 'SBP'] },
] as const;

export type CertificationType = (typeof CERTIFICATION_TYPES)[number]['code'];

// US States for geographic filtering
export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
] as const;
