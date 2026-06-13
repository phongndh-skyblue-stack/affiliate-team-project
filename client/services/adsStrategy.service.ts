import axiosInstance from "@/lib/axios";
import type {
  AdsStrategyApiKey,
  AdsStrategyApiKeyListResponse,
  AdsStrategyGenerateRequest,
  AdsStrategyGenerateResponse,
  AdsStrategyPrompt,
  AdsStrategyPromptListResponse,
  AdsStrategyResult,
  AdsStrategyResultListResponse,
} from "@/types/adsStrategy.types";

export const adsStrategyService = {
  listApiKeys: async (): Promise<AdsStrategyApiKeyListResponse> => {
    const response = await axiosInstance.get<AdsStrategyApiKeyListResponse>(
      "/ads-strategy/api-keys"
    );
    return response.data;
  },

  createApiKey: async (data: {
    displayName: string;
    apiKey: string;
    modelName: string;
  }): Promise<AdsStrategyApiKey> => {
    const response = await axiosInstance.post<AdsStrategyApiKey>(
      "/ads-strategy/api-keys",
      data
    );
    return response.data;
  },

  deleteApiKey: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/ads-strategy/api-keys/${id}`);
  },

  listPrompts: async (): Promise<AdsStrategyPromptListResponse> => {
    const response = await axiosInstance.get<AdsStrategyPromptListResponse>(
      "/ads-strategy/prompts"
    );
    return response.data;
  },

  createPrompt: async (data: {
    name: string;
    promptTemplate: string;
    inputFields: Array<Record<string, unknown>>;
    isDefault: boolean;
  }): Promise<AdsStrategyPrompt> => {
    const response = await axiosInstance.post<AdsStrategyPrompt>(
      "/ads-strategy/prompts",
      data
    );
    return response.data;
  },

  updatePrompt: async (
    id: string,
    data: {
      name: string;
      promptTemplate: string;
      inputFields: Array<Record<string, unknown>>;
      isDefault: boolean;
    }
  ): Promise<AdsStrategyPrompt> => {
    const response = await axiosInstance.put<AdsStrategyPrompt>(
      `/ads-strategy/prompts/${id}`,
      data
    );
    return response.data;
  },

  deletePrompt: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/ads-strategy/prompts/${id}`);
  },

  generate: async (
    data: AdsStrategyGenerateRequest
  ): Promise<AdsStrategyGenerateResponse> => {
    const response = await axiosInstance.post<AdsStrategyGenerateResponse>(
      "/ads-strategy/generate",
      data
    );
    return response.data;
  },

  listResults: async (): Promise<AdsStrategyResultListResponse> => {
    const response = await axiosInstance.get<AdsStrategyResultListResponse>(
      "/ads-strategy/results"
    );
    return response.data;
  },

  saveResult: async (data: Omit<AdsStrategyResult, "id" | "createdAt" | "updatedAt">): Promise<AdsStrategyResult> => {
    const response = await axiosInstance.post<AdsStrategyResult>(
      "/ads-strategy/results",
      data
    );
    return response.data;
  },

  deleteResult: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/ads-strategy/results/${id}`);
  },
};
