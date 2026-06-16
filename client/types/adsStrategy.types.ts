export interface AdsStrategyRequest {
  affiliateLinkId: string;
  budget?: number;
  durationDays?: number;
  currency?: string;
}

export interface StrategyKeyword {
  keyword: string;
  source: string;
  intent: string;
  matchType: "Exact" | "Phrase" | "Broad";
  avgMonthlySearches: number | null;
  competition: string | null;
  lowTopPageBid: number | null;
  highTopPageBid: number | null;
  last3MonthSearches: number[];
  note: string;
}

export interface CustomerSegment {
  name: string;
  demographics: string;
  painPoints: string[];
  needs: string[];
  messagingAngle: string;
}

export interface AdGroupPlan {
  name: string;
  objective: string;
  keywords: StrategyKeyword[];
  rationale: string;
}

export interface Sitelink {
  title: string;
  description1: string;
  description2: string;
  url: string;
}

export interface RsaCopy {
  headlines: string[];
  descriptions: string[];
  callouts: string[];
  sitelinks: Sitelink[];
}

export interface BudgetAllocation {
  label: string;
  percent: number;
  amount: number;
  rationale: string;
}

export interface BudgetPlan {
  totalBudget: number;
  durationDays: number;
  dailyBudget: number;
  currency: string;
  recommendation: string;
  allocations: BudgetAllocation[];
}

export interface PolicyWarning {
  level: "info" | "warning" | "critical";
  title: string;
  detail: string;
}

export interface AdsStrategyResponse {
  affiliateLinkId: string;
  website: string;
  domain: string;
  generatedAt: string;
  productSummary: string;
  marketStage: string;
  geoRecommendation: string;
  dataConfidence: "low" | "medium" | "high";
  dataNotes: string[];
  policyWarnings: PolicyWarning[];
  keywordTable: StrategyKeyword[];
  customerSegments: CustomerSegment[];
  adGroups: AdGroupPlan[];
  rsa: RsaCopy;
  budgetPlan: BudgetPlan;
}
