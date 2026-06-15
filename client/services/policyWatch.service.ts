import axiosInstance from "@/lib/axios";
import type {
  PolicyChangeListResponse,
  PolicyWatchStatusResponse,
  PolicyCheckResult,
} from "@/types/policyWatch.types";

export const policyWatchService = {
  listChanges: async (): Promise<PolicyChangeListResponse> => {
    const response = await axiosInstance.get<PolicyChangeListResponse>(
      "/policy-watch/changes"
    );
    return response.data;
  },

  getStatus: async (): Promise<PolicyWatchStatusResponse> => {
    const response = await axiosInstance.get<PolicyWatchStatusResponse>(
      "/policy-watch/status"
    );
    return response.data;
  },

  checkNow: async (): Promise<PolicyCheckResult> => {
    const response = await axiosInstance.post<PolicyCheckResult>(
      "/policy-watch/check"
    );
    return response.data;
  },
};

export default policyWatchService;
