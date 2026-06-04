"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { TOKEN_KEY } from "@/constants/config";
import { WS_BASE_URL } from "@/constants/config";
import { useNotificationStore } from "@/stores/notificationStore";
import { notificationService } from "@/services/notification.service";

/**
 * Connects to the Socket.IO notification server AND hydrates
 * notifications from the DB API on first mount.
 * Must be mounted inside an authenticated layout.
 */
export function useNotifications() {
  const addDelegationResult = useNotificationStore((s) => s.addDelegationResult);
  const setFromApi = useNotificationStore((s) => s.setFromApi);
  const hydrated = useNotificationStore((s) => s.hydrated);
  const socketRef = useRef<Socket | null>(null);

  // Fetch persisted notifications from DB once (after login / on refresh)
  useEffect(() => {
    if (hydrated) return;
    notificationService.list().then((res) => {
      setFromApi(res.items, res.unreadCount);
    }).catch(() => {
      // Non-fatal — socket will still work
    });
  }, [hydrated, setFromApi]);

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;

    const socket = io(WS_BASE_URL, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
      reconnectionDelayMax: 60000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket.IO] connected:", socket.id);
    });

    socket.on("connect_error", (err) => {
      // Silence "unauthorized" — normal when token expires
      if (!err.message.includes("unauthorized")) {
        console.warn("[Socket.IO]", err.message);
      }
    });

    socket.on("delegation_result", (data: {
      mailId: string;
      message: string;
      accounts: unknown[];
      unaccessibleIds: string[];
    }) => {
      console.log("[Socket.IO] delegation_result received:", data);
      addDelegationResult({
          type: "delegation_result",
          mailId: data.mailId,
          message: data.message,
          accounts: (data.accounts ?? []) as never,
          unaccessibleIds: data.unaccessibleIds ?? [],
          mailEmail: ""
      });

      const accountCount = (data.accounts ?? []).length;
      toast.success(data.message ?? "Ủy quyền thành công!", {
        description: accountCount
          ? `Đã lưu ${accountCount} tài khoản Google Ads vào hệ thống.`
          : "Không tìm thấy tài khoản nào.",
        duration: 8000,
      });

      window.dispatchEvent(
        new CustomEvent("delegation:result", { detail: data })
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [addDelegationResult]);
}
