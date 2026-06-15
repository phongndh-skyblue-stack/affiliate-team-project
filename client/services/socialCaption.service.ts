import axiosInstance from "@/lib/axios";
import type {
  CaptionGenerateRequest,
  CaptionGenerateResponse,
  SocialCaptionOptions,
} from "@/types/socialCaption.types";

export const socialCaptionService = {
  getOptions: async (): Promise<SocialCaptionOptions> => {
    const response = await axiosInstance.get<SocialCaptionOptions>(
      "/social-caption/options"
    );
    return response.data;
  },

  generate: async (
    data: CaptionGenerateRequest
  ): Promise<CaptionGenerateResponse> => {
    const response = await axiosInstance.post<CaptionGenerateResponse>(
      "/social-caption/generate",
      data
    );
    return response.data;
  },
};

export default socialCaptionService;
