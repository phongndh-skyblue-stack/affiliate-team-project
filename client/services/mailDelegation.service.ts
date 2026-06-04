import axiosInstance from "@/lib/axios";
import type {
  AdsAccountListResponse,
  CallbackResponse,
  ImportAccountsRequest,
  ImportAccountsResponse,
  MailListResponse,
  MailResponse,
  SendAuthResponse,
} from "@/types/mailDelegation.types";

export const mailDelegationService = {
  addMail: async (email: string): Promise<MailResponse> => {
    const res = await axiosInstance.post<MailResponse>("/mail-delegation/mails", { email });
    return res.data;
  },

  listMails: async (skip = 0, limit = 50): Promise<MailListResponse> => {
    const res = await axiosInstance.get<MailListResponse>("/mail-delegation/mails", {
      params: { skip, limit },
    });
    return res.data;
  },

  deleteMail: async (mailId: string): Promise<void> => {
    await axiosInstance.delete(`/mail-delegation/mails/${mailId}`);
  },

  sendAuthEmail: async (mailId: string): Promise<SendAuthResponse> => {
    const res = await axiosInstance.post<SendAuthResponse>(
      `/mail-delegation/mails/${mailId}/send-auth`
    );
    return res.data;
  },

  handleCallback: async (code: string, state: string): Promise<CallbackResponse> => {
    const res = await axiosInstance.post<CallbackResponse>("/mail-delegation/callback", {
      code,
      state,
    });
    return res.data;
  },

  listAccounts: async (mailId: string): Promise<AdsAccountListResponse> => {
    const res = await axiosInstance.get<AdsAccountListResponse>(
      `/mail-delegation/mails/${mailId}/accounts`
    );
    return res.data;
  },

  importAccounts: async (
    mailId: string,
    data: ImportAccountsRequest
  ): Promise<ImportAccountsResponse> => {
    const res = await axiosInstance.post<ImportAccountsResponse>(
      `/mail-delegation/mails/${mailId}/accounts/import`,
      data
    );
    return res.data;
  },
};
