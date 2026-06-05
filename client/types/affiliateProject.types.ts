export interface TrafficGlobalItem {
  period_month: string;
  total_visits_monthly: number;
  avg_visits_monthly: number;
  unique_visits_monthly: number;
  repeat_visits_monthly: number;
  pages_per_visit: number;
  avg_visit_duration: number;
  bounce_rate_percentage: number;
}

export interface TrafficCountryItem {
  country_code: string;
  country_name: string;
  traffic_share_percentage: number;
  total_visits_monthly: number | null;
  pages_per_visit: number;
  avg_visit_duration: number;
  bounce_rate_percentage: number;
}

export interface TrafficSourceItem {
  period_month: string;
  organic_search: number;
  social: number;
  email: number;
  display_ads: number;
  direct: number;
  referrals: number;
  paid_search: number;
}

export interface TrafficSocialItem {
  platform_name: string;
  share_percentage: number | null;
}

export interface TrafficDetails {
  global: TrafficGlobalItem[];
  country?: TrafficCountryItem[];
  source?: TrafficSourceItem;
  social?: TrafficSocialItem[];
}

export interface ScanTrafficRequest {
  affiliate_link_id: string;
  months?: number;
  start_period?: string | null;
}

export interface ScanTrafficResponse {
  domain: string;
  url: string;
  found: boolean;
  monthly_visits: number;
  period_month: string;
  traffic_details?: TrafficDetails | null;
}

export interface TopCountryInsight {
  country: string;
  signal_score: number;
  signals: string[];
}

export interface ScanAffiliateProjectRequest {
  affiliate_link_id: string;
  max_results?: number;
  search_depth?: "basic" | "advanced";
  include_raw_content?: boolean;
}

export interface ScanAffiliateProjectResponse {
  website: string;
  domain: string;
  query: string;
  project_name?: string | null;
  project_link?: string | null;
  event_content?: string | null;
  sale_content?: string | null;
  top_countries: TopCountryInsight[];
  answer?: string | null;
  results: Array<Record<string, unknown>>;
}

export interface AffiliateLinkCreateRequest {
  website: string;
}

export interface AffiliateLinkModel {
  id: string;
  user_id?: string | null;
  affiliate_url: string;
  domain: string;
  raw_data?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AffiliateLinkTrafficModel {
  id: string;
  affiliate_link_id: string;
  found: boolean;
  monthly_visits: number;
  period_month: string;
  traffic_details?: TrafficDetails | null;
  raw_data?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AffiliateLinkProjectDataModel {
  id: string;
  affiliate_link_id: string;
  query: string;
  project_name?: string | null;
  project_link?: string | null;
  event_content?: string | null;
  sale_content?: string | null;
  top_countries: TopCountryInsight[];
  answer?: string | null;
  results: Array<Record<string, unknown>>;
  raw_data?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AffiliateLinkDetailResponse {
  affiliate_link: AffiliateLinkModel;
  traffic_scans: AffiliateLinkTrafficModel[];
  project_data_scans: AffiliateLinkProjectDataModel[];
}
