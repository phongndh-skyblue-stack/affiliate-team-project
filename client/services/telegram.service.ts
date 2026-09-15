import axiosInstance from "@/lib/axios";
import type {
  TelegramConfigResponse,
  TelegramSubscription,
  TelegramVerificationCodeResponse,
} from "@/types/telegram.types";

export const telegramService = {
  getConfig: async (): Promise<TelegramConfigResponse> => {
    const response = await axiosInstance.get<TelegramConfigResponse>("/telegram/config");
    return response.data;
  },

  getSubscription: async (): Promise<TelegramSubscription | null> => {
    const response = await axiosInstance.get<TelegramSubscription | null>("/telegram/subscription");
    return response.data;
  },

  generateVerificationCode: async (): Promise<TelegramVerificationCodeResponse> => {
    const response = await axiosInstance.post<TelegramVerificationCodeResponse>(
      "/telegram/generate-verification-code"
    );
    return response.data;
  },

  updateScheduleNotifications: async (enabled: boolean): Promise<TelegramSubscription> => {
    const response = await axiosInstance.put<TelegramSubscription>(
      "/telegram/subscription/schedule-notifications",
      { enabled }
    );
    return response.data;
  },

  unlink: async (): Promise<void> => {
    await axiosInstance.delete("/telegram/subscription");
  },
};
