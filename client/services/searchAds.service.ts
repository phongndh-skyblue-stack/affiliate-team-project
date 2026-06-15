import axiosInstance from "@/lib/axios";
import type {
  SearchAdsHistoryResponse,
  SearchAdsCompetitorCreate,
  SearchAdsCompetitorItem,
  SearchAdsCompetitorResponse,
  SearchAdsRequest,
  SearchAdsResponse,
  SearchAdsScheduleCreate,
  SearchAdsScheduleResponse,
} from "@/types/searchAds.types";

export interface SearchLocationOption {
  value: string;
  label: string;
  gl: string;
  region: string;
}
export interface SearchLanguageOption {
  value: string;
  label: string;
}
export interface SearchOptionsResponse {
  locations: SearchLocationOption[];
  languages: SearchLanguageOption[];
}

export const searchAdsService = {
  getOptions: async (): Promise<SearchOptionsResponse> => {
    const response = await axiosInstance.get<SearchOptionsResponse>(
      "/search-ads/options"
    );
    return response.data;
  },

  run: async (data: SearchAdsRequest): Promise<SearchAdsResponse> => {
    const response = await axiosInstance.post<SearchAdsResponse>(
      "/search-ads/run",
      data
    );
    return response.data;
  },

  getHistory: async (
    source: "all" | "scheduled" | "manual" = "all"
  ): Promise<SearchAdsHistoryResponse> => {
    const response = await axiosInstance.get<SearchAdsHistoryResponse>(
      "/search-ads/history",
      { params: { source } }
    );
    return response.data;
  },

  getScheduledResults: async (): Promise<SearchAdsHistoryResponse> => {
    const response = await axiosInstance.get<SearchAdsHistoryResponse>(
      "/search-ads/scheduled-results"
    );
    return response.data;
  },

  createSchedules: async (
    data: SearchAdsScheduleCreate
  ): Promise<SearchAdsScheduleResponse> => {
    const response = await axiosInstance.post<SearchAdsScheduleResponse>(
      "/search-ads/schedules",
      data
    );
    return response.data;
  },

  getSchedules: async (): Promise<SearchAdsScheduleResponse> => {
    const response = await axiosInstance.get<SearchAdsScheduleResponse>(
      "/search-ads/schedules"
    );
    return response.data;
  },

  cancelSchedule: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/search-ads/schedules/${id}`);
  },

  deleteVideo: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/search-ads/history/${id}/video`);
  },

  deleteHistory: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/search-ads/history/${id}`);
  },

  addCompetitor: async (
    data: SearchAdsCompetitorCreate
  ): Promise<SearchAdsCompetitorItem> => {
    const response = await axiosInstance.post<SearchAdsCompetitorItem>(
      "/search-ads/competitors",
      data
    );
    return response.data;
  },

  getCompetitors: async (): Promise<SearchAdsCompetitorResponse> => {
    const response = await axiosInstance.get<SearchAdsCompetitorResponse>(
      "/search-ads/competitors"
    );
    return response.data;
  },

  deleteCompetitor: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/search-ads/competitors/${id}`);
  },
};
