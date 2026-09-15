import axiosInstance from "@/lib/axios";

export interface NotificationPayload {
  mailId?: string;
  mailEmail?: string;
  message?: string;
  accounts?: unknown[];
  unaccessibleIds?: string[];
  [key: string]: unknown;
}

export interface ApiNotification {
  id: string;
  userId: string;
  type: string;
  payload: NotificationPayload;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  total: number;
  unreadCount: number;
  items: ApiNotification[];
}

export const notificationService = {
  list: async (skip = 0, limit = 50): Promise<NotificationListResponse> => {
    const res = await axiosInstance.get<NotificationListResponse>("/notifications", {
      params: { skip, limit },
    });
    return res.data;
  },

  markAllRead: async (): Promise<void> => {
    await axiosInstance.post("/notifications/read");
  },

  deleteOne: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/notifications/${id}`);
  },

  deleteAll: async (): Promise<void> => {
    await axiosInstance.delete("/notifications");
  },
};
