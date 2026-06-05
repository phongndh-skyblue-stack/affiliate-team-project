import { create } from "zustand";
import type { AccountNode } from "@/types/mailDelegation.types";
import type { ApiNotification } from "@/services/notification.service";

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  description?: string;
  mailId?: string;
  mailEmail?: string;
  accounts?: AccountNode[];
  unaccessibleIds?: string[];
  chatId?: number;
  receivedAt: string;
  read: boolean;
}

function fromApi(n: ApiNotification): AppNotification {
  const p = n.payload;
  return {
    id: n.id,
    type: n.type,
    mailId: p.mailId ?? "",
    mailEmail: p.mailEmail ?? "",
    message: p.message ?? "",
    description: typeof p.description === "string" ? p.description : undefined,
    accounts: (p.accounts ?? []) as AccountNode[],
    unaccessibleIds: (p.unaccessibleIds ?? []) as string[],
    chatId: typeof p.chatId === "number" ? p.chatId : undefined,
    receivedAt: n.createdAt,
    read: n.isRead,
  };
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  hydrated: boolean;
  setFromApi: (items: ApiNotification[], unreadCount: number) => void;
  addNotification: (payload: Omit<AppNotification, "id" | "receivedAt" | "read"> & { id?: string; receivedAt?: string }) => void;
  addDelegationResult: (payload: Omit<AppNotification, "id" | "receivedAt" | "read">) => void;
  markAllRead: () => void;
  deleteOne: (id: string) => void;
  deleteAll: () => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  hydrated: false,

  setFromApi: (items, unreadCount) =>
    set({
      notifications: items.map(fromApi),
      unreadCount,
      hydrated: true,
    }),

  addNotification: (payload) => {
    // Avoid duplicate if the same notification already came from API hydration
    const id = payload.id ?? `socket-${Date.now()}-${Math.random()}`;
    if (get().notifications.some((n) => n.id === id)) return;

    const item: AppNotification = {
      ...payload,
      id,
      receivedAt: payload.receivedAt ?? new Date().toISOString(),
      read: false,
    };
    set((state) => ({
      notifications: [item, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + 1,
    }));
  },

  addDelegationResult: (payload) => get().addNotification(payload),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  deleteOne: (id) =>
    set((state) => {
      const removed = state.notifications.find((n) => n.id === id);
      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: removed && !removed.read
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      };
    }),

  deleteAll: () => set({ notifications: [], unreadCount: 0 }),

  clear: () => set({ notifications: [], unreadCount: 0, hydrated: false }),
}));
