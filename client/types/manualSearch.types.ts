export interface ManualCompetitorSearchRequest {
  keyword: string;
  location?: string;
  hl?: string;
  gl?: string;
  num?: number;
  noCache?: boolean;
  enrichAdvertisers?: boolean;
}

export interface CompetitorSitelinkItem {
  title: string;
  link: string;
  trackingLink?: string;
  snippet?: string;
}

export interface AdvertiserCandidate {
  advertiserId: string;
  paidForBy: string;
  creativeId: string;
  format?: string;
  targetDomain?: string;
  firstShown?: number;
  lastShown?: number;
  totalDaysShown?: number;
  detailsLink?: string;
  advertiserAdsLink?: string;
  displayRegion?: string;
}

export interface CompetitorAdItem {
  position: string;
  advertiser: string;
  title: string;
  snippet: string;
  link: string;
  sitelinks: string[];
  type: string;
  displayedLink?: string;
  trackingLink?: string;
  source?: string;
  destinationDomain?: string;
  destinationPath?: string;
  refParameters?: Record<string, string>;
  sitelinkItems?: CompetitorSitelinkItem[];
  advertiserCandidates?: AdvertiserCandidate[];
  advertiserLookupStatus?: "matched" | "not_found" | "failed" | "missing_domain" | "not_requested";
}

export interface ManualCompetitorSearchResponse {
  keyword: string;
  googleUrl: string;
  totalAdsFound: number;
  topAdsCount: number;
  bottomAdsCount: number;
  ads: CompetitorAdItem[];
}

export interface ManualCompetitorSearchHistoryItem {
  id: string;
  userId?: string;
  keyword: string;
  googleUrl: string;
  location: string;
  hl: string;
  gl: string;
  num: number;
  noCache: boolean;
  totalAdsFound: number;
  topAdsCount: number;
  bottomAdsCount: number;
  ads: CompetitorAdItem[];
  rawData?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManualCompetitorSearchHistoryResponse {
  total: number;
  items: ManualCompetitorSearchHistoryItem[];
}

export interface ManualKeywordGroup {
  keyword: string;
  searches: ManualCompetitorSearchHistoryItem[];
  totalAdsFound: number;
  latestSearchedAt: string;
}
