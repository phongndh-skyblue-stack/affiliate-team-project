import axiosInstance from "@/lib/axios";
import type {
  ManualCompetitorSearchHistoryResponse,
  ManualCompetitorSearchRequest,
  ManualCompetitorSearchResponse,
} from "@/types/manualSearch.types";

export const manualSearchService = {
  searchCompetitor: async (
    data: ManualCompetitorSearchRequest
  ): Promise<ManualCompetitorSearchResponse> => {
    const response = await axiosInstance.post<ManualCompetitorSearchResponse>(
      "/manual-search/competitor",
      data
    );
    return response.data;
  },

  getHistory: async (): Promise<ManualCompetitorSearchHistoryResponse> => {
    const response = await axiosInstance.get<ManualCompetitorSearchHistoryResponse>(
      "/manual-search/history"
    );
    return response.data;
  },
};