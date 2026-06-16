// ---- Request types ----

export interface AdsTransparencySearchRequest {
  text?: string;
  advertiserId?: string;
  platform?: "PLAY" | "MAPS" | "SEARCH" | "SHOPPING" | "YOUTUBE";
  creativeFormat?: "TEXT" | "IMAGE" | "VIDEO";
  startDate?: string; // YYYY-MM-DD
  endDate?: string;
  region?: string;
  num?: number;
  nextPageToken?: string;
  projectId?: string | null;
}

export interface AdDetailsRequest {
  advertiserId: string;
  creativeId: string;
  region?: string;
  adCreativeId?: string;
}

// ---- Raw API response (search) ----

export interface AdCreativeRaw {
  advertiserId: string;
  advertiser: string;
  adCreativeId: string;
  format: string;
  targetDomain?: string;
  image?: string;
  link?: string;
  width?: number;
  height?: number;
  totalDaysShown?: number;
  firstShown?: number;
  lastShown?: number;
  detailsLink?: string;
  serpapiDetailsLink?: string;
}

export interface AdsTransparencySearchResponse {
  data: {
    searchMetadata?: Record<string, unknown>;
    searchInformation?: { totalResults?: number };
    adCreatives?: AdCreativeRaw[];
    serpapiPagination?: { nextPageToken?: string };
  };
}

export interface AdDetailsResponse {
  data: Record<string, unknown>;
}

// ---- History response (GET /history) ----

export interface AdCreativeDetailHistoryItem {
  id: string;
  adCreativeId?: string;
  advertiserId: string;
  googleCreativeId: string;
  format?: string;
  lastShown?: number;
  regionName?: string;
  moreAdsByAdvertiser?: string;
  regions?: unknown[];
  adCreatives?: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface AdCreativeHistoryItem {
  id: string;
  searchId: string;
  advertiserId: string;
  advertiser: string;
  adCreativeId: string;
  format: string;
  targetDomain?: string;
  image?: string;
  link?: string;
  width?: number;
  height?: number;
  totalDaysShown?: number;
  firstShown?: number;
  lastShown?: number;
  detailsLink?: string;
  serpapiDetailsLink?: string;
  createdAt: string;
  updatedAt: string;
  details: AdCreativeDetailHistoryItem[];
}

export interface AdSearchHistoryItem {
  id: string;
  userId?: string;
  text?: string;
  advertiserIdQuery?: string;
  platform?: string;
  creativeFormat?: string;
  startDate?: string;
  endDate?: string;
  region?: string;
  politicalAds: boolean;
  num: number;
  nextPageTokenInput?: string;
  projectId?: string | null;
  projectName?: string | null;
  totalResults?: number;
  nextPageTokenOutput?: string;
  createdAt: string;
  updatedAt: string;
  creatives: AdCreativeHistoryItem[];
}

export interface AdSearchHistoryResponse {
  total: number;
  items: AdSearchHistoryItem[];
}

// ---- Derived: competitor grouped view ----

export interface CompetitorGroup {
  advertiserId: string;
  advertiser: string;
  creatives: AdCreativeHistoryItem[];
  firstSeen: string;
  lastSeen: string;
}

export interface CompetitorListResponse {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  items: CompetitorGroup[];
}
