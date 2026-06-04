import axiosInstance from "@/lib/axios";
import type {
  AdsAccountListResponse,
  JobListResponse,
  JobResultsResponse,
  ScanByKeywordsRequest,
  ScanByUrlRequest,
} from "@/types/keywordPlanner.types";

export const keywordPlannerService = {
  scanByKeywords: async (
    data: ScanByKeywordsRequest
  ): Promise<JobResultsResponse> => {
    const response = await axiosInstance.post<JobResultsResponse>(
      "/keyword-planner/scan/keywords",
      data
    );
    return response.data;
  },

  scanByUrl: async (data: ScanByUrlRequest): Promise<JobResultsResponse> => {
    const response = await axiosInstance.post<JobResultsResponse>(
      "/keyword-planner/scan/url",
      data
    );
    return response.data;
  },

  listJobs: async (skip = 0, limit = 50): Promise<JobListResponse> => {
    const response = await axiosInstance.get<JobListResponse>(
      "/keyword-planner/jobs",
      { params: { skip, limit } }
    );
    return response.data;
  },

  listAccounts: async (): Promise<AdsAccountListResponse> => {
    const response = await axiosInstance.get<AdsAccountListResponse>(
      "/keyword-planner/accounts"
    );
    return response.data;
  },

  getJobResults: async (jobId: string): Promise<JobResultsResponse> => {
    const response = await axiosInstance.get<JobResultsResponse>(
      `/keyword-planner/jobs/${jobId}/results`
    );
    return response.data;
  },
};
