import axiosInstance from "@/lib/axios";
import type {
  AdsStrategyRequest,
  AdsStrategyResponse,
} from "@/types/adsStrategy.types";

export const adsStrategyService = {
  buildBrief: async (payload: AdsStrategyRequest): Promise<AdsStrategyResponse> => {
    const response = await axiosInstance.post<AdsStrategyResponse>(
      "/ads-strategy/brief",
      payload
    );
    return response.data;
  },
};
