import axiosInstance from "@/lib/axios";
import type {
  AdCopyGenerateRequest,
  AdCopyGenerateResponse,
} from "@/types/adCopy.types";

export const adCopyService = {
  generate: async (
    data: AdCopyGenerateRequest
  ): Promise<AdCopyGenerateResponse> => {
    const response = await axiosInstance.post<AdCopyGenerateResponse>(
      "/ad-copy/generate",
      data
    );
    return response.data;
  },
};
