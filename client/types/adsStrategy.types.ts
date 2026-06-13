export interface AdsStrategyApiKey {
  id: string;
  displayName: string;
  provider: string;
  modelName: string;
  apiKeyLast4: string;
  isActive: boolean;
  lastError: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdsStrategyApiKeyListResponse {
  total: number;
  items: AdsStrategyApiKey[];
}

export interface AdsStrategyPrompt {
  id: string;
  name: string;
  promptTemplate: string;
  inputFields: Array<Record<string, unknown>>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdsStrategyPromptListResponse {
  total: number;
  items: AdsStrategyPrompt[];
}

export interface AdsStrategyGenerateRequest {
  apiKeyId: string;
  promptId?: string | null;
  promptTemplate?: string | null;
  inputValues: Record<string, unknown>;
  modelName?: string | null;
}

export interface AdsStrategyGenerateResponse {
  promptText: string;
  responseText: string;
  modelName: string;
  apiKeyId: string;
  promptId: string | null;
  inputValues: Record<string, unknown>;
  rawResponse: Record<string, unknown> | null;
  promptTokens: number | null;
  responseTokens: number | null;
  totalTokens: number | null;
}

export interface AdsStrategyResult {
  id: string;
  title: string;
  promptId: string | null;
  apiKeyId: string | null;
  websiteUrl: string;
  market: string;
  budget: string;
  notes: string;
  modelName: string;
  promptText: string;
  responseText: string;
  rawResponse: Record<string, unknown> | null;
  inputValues: Record<string, unknown>;
  promptTokens: number | null;
  responseTokens: number | null;
  totalTokens: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdsStrategyResultListResponse {
  total: number;
  items: AdsStrategyResult[];
}
