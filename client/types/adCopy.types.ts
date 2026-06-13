export interface AdCopyGenerateRequest {
  landingPageUrl: string;
  keyword: string;
  language: "vi" | "en";
}

export interface SitelinkItem {
  text: string;
  description1: string;
  description2: string;
  finalUrl: string | null;
}

export interface AdCopyGenerateResponse {
  landingPageTitle: string | null;
  landingPageSummary: string;
  keywordHeadlines: string[];
  headlines: string[];
  descriptions: string[];
  sitelinks: SitelinkItem[];
  callouts: string[];
  structuredSnippets: string[];
  wordsToAvoid: string[];
  saferContentDirections: string[];
  sensitiveContentNote: string;
}
