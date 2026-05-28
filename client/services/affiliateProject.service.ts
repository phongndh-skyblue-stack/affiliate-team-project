import axiosInstance from "@/lib/axios";
import type {
  AffiliateLinkCreateRequest,
  AffiliateLinkDetailResponse,
  AffiliateLinkModel,
  ScanAffiliateProjectRequest,
  ScanAffiliateProjectResponse,
  ScanTrafficRequest,
  ScanTrafficResponse,
} from "@/types/affiliateProject.types";

export const affiliateProjectService = {
  createAffiliateLink: async (
    payload: AffiliateLinkCreateRequest
  ): Promise<AffiliateLinkModel> => {
    const response = await axiosInstance.post<AffiliateLinkModel>(
      "/affiliate-data/affiliate-link",
      payload
    );
    return response.data;
  },

  getAffiliateLinks: async (): Promise<AffiliateLinkModel[]> => {
    const response = await axiosInstance.get<AffiliateLinkModel[]>(
      "/affiliate-data/affiliate-links"
    );
    return response.data;
  },

  getAffiliateLinkDetail: async (website: string): Promise<AffiliateLinkDetailResponse> => {
    const response = await axiosInstance.get<AffiliateLinkDetailResponse>(
      "/affiliate-data/affiliate-link-detail",
      { params: { website } }
    );
    return response.data;
  },

  scanTraffic: async (payload: ScanTrafficRequest): Promise<ScanTrafficResponse> => {
    const response = await axiosInstance.post<ScanTrafficResponse>(
      "/affiliate-data/scan-traffic",
      payload
    );
    return response.data;
  },

  scanAffiliateProject: async (
    payload: ScanAffiliateProjectRequest
  ): Promise<ScanAffiliateProjectResponse> => {
    const response = await axiosInstance.post<ScanAffiliateProjectResponse>(
      "/affiliate-data/scan-affiliate-project",
      payload
    );
    return response.data;
  },
};
