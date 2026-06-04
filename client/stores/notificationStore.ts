import { create } from "zustand";
import type { AccountNode } from "@/types/mailDelegation.types";
import type { ApiNotification } from "@/services/notification.service";

export interface DelegationNotification {
  id: string;
  type: "delegation_result";
  mailId: string;
  mailEmail: string;
  message: string;
  accounts: AccountNode[];
  unaccessibleIds: string[];
  receivedAt: string;     // ISO
  read: boolean;
}

function fromApi(n: ApiNotification): DelegationNotification {
  const p = n.payload;
  return {
    id: n.id,
    type: "delegation_result",
    mailId: p.mailId ?? "",
    mailEmail: p.mailEmail ?? "",
    message: p.message ?? "",
    accounts: (p.accounts ?? []) as AccountNode[],
    unaccessibleIds: (p.unaccessibleIds ?? []) as string[],
    receivedAt: n.createdAt,
    read: n.isRead,
  };
}

interface NotificationState {
  notifications: DelegationNotification[];
  unreadCount: number;
  hydrated: boolean;
  setFromApi: (items: ApiNotification[], unreadCount: number) => void;
  addDelegationResult: (payload: Omit<DelegationNotification, "id" | "receivedAt" | "read">) => void;
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

  addDelegationResult: (payload) => {
    // Avoid duplicate if the same notification already came from API hydration
    const item: DelegationNotification = {
      ...payload,
      id: `socket-${Date.now()}-${Math.random()}`,
      receivedAt: new Date().toISOString(),
      read: false,
    };
    set((state) => ({
      notifications: [item, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + 1,
    }));
  },

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
