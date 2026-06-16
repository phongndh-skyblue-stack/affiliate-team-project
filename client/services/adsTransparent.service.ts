import axiosInstance from "@/lib/axios";
import type {
  AdsTransparencySearchRequest,
  AdsTransparencySearchResponse,
  AdDetailsRequest,
  AdDetailsResponse,
  AdSearchHistoryResponse,
  CompetitorListResponse,
} from "@/types/adsTransparent.types";

export const adsTransparentService = {
  search: async (
    data: AdsTransparencySearchRequest
  ): Promise<AdsTransparencySearchResponse> => {
    const response = await axiosInstance.post<AdsTransparencySearchResponse>(
      "/ads-transparent/search",
      data
    );
    return response.data;
  },

  getDetails: async (data: AdDetailsRequest): Promise<AdDetailsResponse> => {
    const response = await axiosInstance.post<AdDetailsResponse>(
      "/ads-transparent/details",
      data
    );
    return response.data;
  },

  getHistory: async (
    page = 1,
    pageSize = 10
  ): Promise<AdSearchHistoryResponse> => {
    const response = await axiosInstance.get<AdSearchHistoryResponse>(
      "/ads-transparent/history",
      { params: { page, page_size: pageSize } }
    );
    return response.data;
  },

  getCompetitors: async (
    page = 1,
    pageSize = 10
  ): Promise<CompetitorListResponse> => {
    const response = await axiosInstance.get<CompetitorListResponse>(
      "/ads-transparent/competitors",
      { params: { page, page_size: pageSize } }
    );
    return response.data;
  },

  deleteHistory: async (searchId: string): Promise<{ success: boolean }> => {
    const response = await axiosInstance.delete<{ success: boolean }>(
      `/ads-transparent/history/${searchId}`
    );
    return response.data;
  },
};
