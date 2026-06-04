// ─── Requests ────────────────────────────────────────────────────────────────

export interface ScanByKeywordsRequest {
  adsId: string;
  keywords: string[];
  pageUrl?: string;
  languageId?: number;
  locationIds?: number[];
  resultLimit?: number;
}

export interface ScanByUrlRequest {
  adsId: string;
  pageUrl: string;
  useEntireSite?: boolean;
  languageId?: number;
  locationIds?: number[];
  resultLimit?: number;
}

// ─── Responses ───────────────────────────────────────────────────────────────

export interface MonthlySearchVolumeItem {
  year: number;
  month: number;
  searches: number;
}

export interface KeywordIdeaItem {
  id: string;
  keyword: string;
  avgMonthlySearches: number;
  competition: string;
  competitionIndex: number | null;
  lowTopPageBid: number | null;
  highTopPageBid: number | null;
  monthlySearches: MonthlySearchVolumeItem[];
}

export interface JobResponse {
  id: string;
  adsId: string | null;
  inputType: "keywords" | "url";
  keywords: string[] | null;
  pageUrl: string | null;
  useEntireSite: boolean;
  languageId: number;
  locationIds: number[] | null;
  resultLimit: number;
  status: "pending" | "done" | "error";
  errorMessage: string | null;
  resultCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobResultsResponse {
  job: JobResponse;
  results: KeywordIdeaItem[];
}

export interface JobListResponse {
  items: JobResponse[];
  total: number;
}

export interface AdsAccountResponse {
  id: string;
  mailId: string;
  adsId: string;
  adsName: string;
  adsStatus: string | null;
  accountType: string | null;
  managerAccountAdsId: string | null;
  currencyCode: string | null;
  timezone: string | null;
  createdAt: string;
}

export interface AdsAccountListResponse {
  total: number;
  items: AdsAccountResponse[];
}
