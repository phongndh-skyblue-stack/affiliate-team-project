export interface PolicyChangeEvent {
  id: string;
  sourceUrl: string;
  platform: string;
  title?: string | null;
  summary?: string | null;
  diffExcerpt?: string | null;
  detectedAt: string;
}

export interface PolicyChangeListResponse {
  total: number;
  items: PolicyChangeEvent[];
}

export interface PolicySnapshotStatus {
  sourceUrl: string;
  platform: string;
  title?: string | null;
  fetchedAt: string;
  changedAt?: string | null;
}

export interface PolicyWatchStatusResponse {
  sources: PolicySnapshotStatus[];
}

export interface PolicyCheckResult {
  checked: number;
  changed: number;
  newSources: number;
  errors: string[];
}
