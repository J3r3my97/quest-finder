// User types
export interface User {
  id: string;
  email: string;
  name: string | null;
  subscriptionTier: SubscriptionTier;
  createdAt: Date;
}

export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

// Contract types
export interface ContractLead {
  id: string;
  title: string;
  agency: string;
  value: number | null;
  deadline: Date | null;
  naicsCodes: string[];
  setAsideType: SetAsideType | null;
  description: string;
  sourceUrl: string;
  postedDate: Date;
}

export type SetAsideType =
  | 'small_business'
  | 'woman_owned'
  | 'veteran_owned'
  | 'hubzone'
  | '8a'
  | 'sdvosb'
  | 'none';

// Search types
export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  filters: SearchFilters;
  createdAt: Date;
}

export interface SearchFilters {
  keyword?: string;
  naicsCodes?: string[];
  agency?: string;
  setAsideTypes?: SetAsideType[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  valueRange?: {
    min: number;
    max: number;
  };
}

// Alert types
export interface Alert {
  id: string;
  userId: string;
  savedSearchId: string;
  frequency: AlertFrequency;
  lastSent: Date | null;
  enabled: boolean;
}

export type AlertFrequency = 'daily' | 'weekly' | 'instant';

// API response types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

export interface ApiError {
  message: string;
  code: string;
}
