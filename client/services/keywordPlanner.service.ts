import axiosInstance from "@/lib/axios";
import type {
  AdsAccountListResponse,
  CandidateCreateRequest,
  CandidateListResponse,
  CandidateProject,
  CandidateStatus,
  CandidateUpdateRequest,
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

  createCandidate: async (data: CandidateCreateRequest): Promise<CandidateProject> => {
    const response = await axiosInstance.post<CandidateProject>(
      "/keyword-planner/candidates",
      data
    );
    return response.data;
  },

  listCandidates: async (
    status?: CandidateStatus,
    skip = 0,
    limit = 100
  ): Promise<CandidateListResponse> => {
    const response = await axiosInstance.get<CandidateListResponse>(
      "/keyword-planner/candidates",
      { params: { status, skip, limit } }
    );
    return response.data;
  },

  getCandidate: async (candidateId: string): Promise<CandidateProject> => {
    const response = await axiosInstance.get<CandidateProject>(
      `/keyword-planner/candidates/${candidateId}`
    );
    return response.data;
  },

  updateCandidate: async (
    candidateId: string,
    data: CandidateUpdateRequest
  ): Promise<CandidateProject> => {
    const response = await axiosInstance.patch<CandidateProject>(
      `/keyword-planner/candidates/${candidateId}`,
      data
    );
    return response.data;
  },

  deleteCandidate: async (candidateId: string): Promise<void> => {
    await axiosInstance.delete(`/keyword-planner/candidates/${candidateId}`);
  },

  promoteCandidate: async (
    candidateId: string,
    websiteUrl: string
  ): Promise<CandidateProject> => {
    const response = await axiosInstance.post<CandidateProject>(
      `/keyword-planner/candidates/${candidateId}/promote`,
      { websiteUrl }
    );
    return response.data;
  },
};
