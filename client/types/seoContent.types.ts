export interface SeoContentCreate {
  projectName?: string | null;
  finalUrl?: string | null;
  displayPath?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  headlines: string[];
  descriptions: string[];
  keywords: string[];
  bodyContent?: string | null;
  userPersona?: string | null;
}

export interface SeoContentUpdate {
  projectName?: string | null;
  finalUrl?: string | null;
  displayPath?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  headlines?: string[];
  descriptions?: string[];
  keywords?: string[];
  bodyContent?: string | null;
  userPersona?: string | null;
}

export interface SeoContentResponse {
  id: string;
  userId: string;
  projectName?: string | null;
  finalUrl?: string | null;
  displayPath?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  headlines: string[];
  descriptions: string[];
  keywords: string[];
  bodyContent?: string | null;
  userPersona?: string | null;
  seoScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface SeoContentListResponse {
  total: number;
  items: SeoContentResponse[];
}

export interface SeoScoreRequest {
  seoTitle?: string | null;
  metaDescription?: string | null;
  headlines: string[];
  descriptions: string[];
  keywords: string[];
  bodyContent?: string | null;
}

export interface KeywordScoreBreakdown {
  keyword: string;
  foundInTitle: boolean;
  foundInDescription: boolean;
  foundInHeadlines: boolean;
  foundInBody: boolean;
  bodyDensity: number;
}

export interface SeoScoreResponse {
  score: number;
  warnings: string[];
  keywordBreakdown: KeywordScoreBreakdown[];
}

export interface SeoResearchRequest {
  projectName: string;
  affiliateUrl: string;
}

export interface SeoResearchResponse {
  keywords: string[];
  seoTitle: string;
  metaDescription: string;
  headlines: string[];
  descriptions: string[];
  displayPath: string;
  bodyContent: string;
  userPersona: string;
}
