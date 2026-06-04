export interface SearchAdsRequest {
  keyword: string;
  location?: string;
  language?: string;
  device?: string;
  noProxy?: boolean;
  headful?: boolean;
  proxyId?: string | null;
}

export interface LandingPageInfo {
  originalUrl?: string | null;
  finalUrl?: string | null;
  domain?: string | null;
  redirectChain: string[];
  status?: string | null;
  error?: string | null;
  finalStatusCode?: number | null;
}

export interface SearchAdItem {
  position: number;
  title?: string | null;
  snippet?: string | null;
  displayUrl?: string | null;
  targetUrl?: string | null;
  advertiserName?: string | null;
  advertiserDomain?: string | null;
  advertiserLocation?: string | null;
  confidence: number;
  source?: string | null;
  landingPage?: LandingPageInfo | null;
}

export interface OrganicLinkItem {
  title?: string | null;
  url?: string | null;
}

export interface SearchAdsResponse {
  id?: string | null;
  keyword: string;
  searchUrl?: string | null;
  status: string;
  totalAdsFound: number;
  ads: SearchAdItem[];
  errors: string[];
  organicLinks: OrganicLinkItem[];
  finalSummary?: string | null;
  videoUrl?: string | null;
  videoStatus?: string;
}

export interface SearchAdsHistoryItem {
  id: string;
  userId?: string | null;
  keyword: string;
  location: string;
  language: string;
  device: string;
  searchUrl?: string | null;
  status: string;
  totalAdsFound: number;
  errors: string[];
  ads: SearchAdItem[];
  organicLinks: OrganicLinkItem[];
  finalSummary?: string | null;
  proxyName?: string | null;
  isScheduled?: boolean;
  videoUrl?: string | null;
  videoStatus?: string;
  createdAt: string;
}

export interface SearchAdsHistoryResponse {
  total: number;
  items: SearchAdsHistoryItem[];
}

export interface SearchAdsScheduleCreate {
  keyword: string;
  location?: string;
  language?: string;
  device?: string;
  noProxy?: boolean;
  headful?: boolean;
  proxyId?: string | null;
  runAt: string[];
}

export interface SearchAdsScheduleItem {
  id: string;
  userId?: string | null;
  keyword: string;
  location: string;
  language: string;
  device: string;
  noProxy: boolean;
  headful: boolean;
  proxyId?: string | null;
  proxyName?: string | null;
  batchId?: string | null;
  runAt: string;
  status: string;
  arqJobId?: string | null;
  searchId?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SearchAdsScheduleResponse {
  total: number;
  items: SearchAdsScheduleItem[];
}
