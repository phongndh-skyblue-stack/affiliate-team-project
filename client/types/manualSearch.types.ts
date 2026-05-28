export interface ManualCompetitorSearchRequest {
  keyword: string;
  location?: string;
  hl?: string;
  gl?: string;
  num?: number;
  noCache?: boolean;
}

export interface CompetitorAdItem {
  position: string;
  advertiser: string;
  title: string;
  snippet: string;
  link: string;
  sitelinks: string[];
  type: string;
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