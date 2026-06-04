import axiosInstance from "@/lib/axios";
import type {
  SearchAdsHistoryResponse,
  SearchAdsRequest,
  SearchAdsResponse,
  SearchAdsScheduleCreate,
  SearchAdsScheduleResponse,
} from "@/types/searchAds.types";

export const searchAdsService = {
  run: async (data: SearchAdsRequest): Promise<SearchAdsResponse> => {
    const response = await axiosInstance.post<SearchAdsResponse>(
      "/search-ads/run",
      data
    );
    return response.data;
  },

  getHistory: async (): Promise<SearchAdsHistoryResponse> => {
    const response = await axiosInstance.get<SearchAdsHistoryResponse>(
      "/search-ads/history"
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
};
