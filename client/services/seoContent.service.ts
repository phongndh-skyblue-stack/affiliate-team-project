import axiosInstance from "@/lib/axios";
import type {
  SeoContentCreate,
  SeoContentUpdate,
  SeoContentResponse,
  SeoContentListResponse,
  SeoScoreRequest,
  SeoScoreResponse,
  SeoResearchRequest,
  SeoResearchResponse,
} from "@/types/seoContent.types";

export const seoContentService = {
  getScore: async (data: SeoScoreRequest): Promise<SeoScoreResponse> => {
    const response = await axiosInstance.post<SeoScoreResponse>(
      "/seo-content/score",
      data
    );
    return response.data;
  },

  list: async (): Promise<SeoContentListResponse> => {
    const response = await axiosInstance.get<SeoContentListResponse>(
      "/seo-content"
    );
    return response.data;
  },

  getDetail: async (id: string): Promise<SeoContentResponse> => {
    const response = await axiosInstance.get<SeoContentResponse>(
      `/seo-content/${id}`
    );
    return response.data;
  },

  create: async (data: SeoContentCreate): Promise<SeoContentResponse> => {
    const response = await axiosInstance.post<SeoContentResponse>(
      "/seo-content",
      data
    );
    return response.data;
  },

  update: async (
    id: string,
    data: SeoContentUpdate
  ): Promise<SeoContentResponse> => {
    const response = await axiosInstance.put<SeoContentResponse>(
      `/seo-content/${id}`,
      data
    );
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/seo-content/${id}`);
  },

  research: async (data: SeoResearchRequest): Promise<SeoResearchResponse> => {
    const response = await axiosInstance.post<SeoResearchResponse>(
      "/seo-content/research",
      data
    );
    return response.data;
  },
};
export default seoContentService;
