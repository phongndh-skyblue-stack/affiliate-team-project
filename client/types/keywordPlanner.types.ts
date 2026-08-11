// ─── Requests ────────────────────────────────────────────────────────────────

export interface ScanByKeywordsRequest {
  adsId: string;
  keywords: string[];
  pageUrl?: string;
  languageId?: number;
  locationIds?: number[];
  resultLimit?: number;
  projectId?: string;
}

export interface ScanByUrlRequest {
  adsId: string;
  pageUrl: string;
  useEntireSite?: boolean;
  languageId?: number;
  locationIds?: number[];
  resultLimit?: number;
  projectId?: string;
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
  intent?: KeywordIntent;
  opportunityScore?: number;
  opportunityTier?: OpportunityTier;
  trendPercentage?: number;
  scoreExplanation?: string;
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
  projectId: string | null;
  projectName: string | null;
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

export type KeywordIntent =
  | "informational"
  | "commercial"
  | "transactional"
  | "navigational"
  | "unknown";

export type OpportunityTier = "high" | "medium" | "low";
export type CandidateStatus = "new" | "researching" | "promising" | "rejected" | "promoted";

export interface CandidateKeywordInput {
  sourceResultId?: string | null;
  keyword: string;
  avgMonthlySearches: number;
  competition: string;
  competitionIndex: number | null;
  lowTopPageBid: number | null;
  highTopPageBid: number | null;
  monthlySearches: MonthlySearchVolumeItem[];
  inferredIntent: KeywordIntent;
  manualIntent?: KeywordIntent | null;
  opportunityScore: number;
  opportunityTier: OpportunityTier;
  scoreExplanation: string;
  notes?: string | null;
  tags?: string[];
}

export interface CandidateKeyword extends CandidateKeywordInput {
  id: string;
  effectiveIntent: KeywordIntent;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateProject {
  id: string;
  userId: string;
  affiliateProjectId: string | null;
  sourceJobId: string | null;
  sourceAdsId: string | null;
  name: string;
  description: string | null;
  status: CandidateStatus;
  notes: string | null;
  tags: string[];
  languageId: number;
  locationIds: number[];
  websiteUrl: string | null;
  keywords: CandidateKeyword[];
  createdAt: string;
  updatedAt: string;
}

export interface CandidateCreateRequest {
  name: string;
  description?: string;
  status?: CandidateStatus;
  notes?: string;
  tags?: string[];
  languageId?: number;
  locationIds?: number[];
  sourceAdsId?: string;
  sourceJobId?: string;
  websiteUrl?: string;
  keywords: CandidateKeywordInput[];
}

export interface CandidateUpdateRequest {
  name?: string;
  description?: string | null;
  status?: CandidateStatus;
  notes?: string | null;
  tags?: string[];
  languageId?: number;
  locationIds?: number[];
  websiteUrl?: string | null;
  keywords?: CandidateKeywordInput[];
}

export interface CandidateListResponse {
  total: number;
  items: CandidateProject[];
}
