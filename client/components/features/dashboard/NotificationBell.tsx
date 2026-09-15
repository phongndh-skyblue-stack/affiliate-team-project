"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Trash2, X } from "lucide-react";
import { useNotificationStore } from "@/stores/notificationStore";
import { notificationService } from "@/services/notification.service";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  const utc = /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + "Z";
  return new Date(utc).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type NotificationItem = ReturnType<typeof useNotificationStore.getState>["notifications"][number];

function notificationDescription(n: NotificationItem) {
  if (n.type === "telegram_linked" || n.type === "telegram_unlinked") {
    return n.description;
  }

  const accountCount = n.accounts?.length ?? 0;
  const inaccessibleCount = n.unaccessibleIds?.length ?? 0;
  return `${accountCount > 0 ? `${accountCount} tài khoản Google Ads` : "Không tìm thấy tài khoản"}${
    inaccessibleCount > 0 ? ` · ${inaccessibleCount} không thể truy cập` : ""
  }`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const deleteOne = useNotificationStore((s) => s.deleteOne);
  const deleteAll = useNotificationStore((s) => s.deleteAll);

  // Close when clicking outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      markAllRead();
      notificationService.markAllRead().catch(() => {});
    }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="relative flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Thông báo"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 z-50 w-96 rounded-2xl border border-border bg-background shadow-xl shadow-black/10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="font-semibold text-sm">Thông báo</p>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => {
                    markAllRead();
                    notificationService.markAllRead().catch(() => {});
                  }}
                  className="flex items-center gap-1 text-xs text-[#059669] hover:underline"
                >
                  <CheckCheck size={13} />
                  Đã đọc tất cả
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={() => {
                    deleteAll();
                    notificationService.deleteAll().catch(() => {});
                  }}
                  className="flex items-center gap-1 text-xs text-red-500 hover:underline"
                >
                  <Trash2 size={12} />
                  Xóa tất cả
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <Bell size={28} strokeWidth={1.5} />
                <p className="text-sm">Chưa có thông báo nào</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "px-4 py-3 text-sm transition-colors group/item",
                    !n.read && "bg-[#059669]/5"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <span className="mt-1.5 size-2 rounded-full bg-[#059669] shrink-0" />
                    )}
                    <div className={cn("flex-1 min-w-0", n.read && "pl-4")}>
                      <p className="font-medium text-foreground leading-snug">
                        {n.message || "Ủy quyền thành công"}
                      </p>
                      {n.mailEmail && (
                        <p className="text-[11px] text-muted-foreground truncate">{n.mailEmail}</p>
                      )}
                      {notificationDescription(n) && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {notificationDescription(n)}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        {formatDate(n.receivedAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        deleteOne(n.id);
                        if (!n.id.startsWith("socket-")) {
                          notificationService.deleteOne(n.id).catch(() => {});
                        }
                      }}
                      className="shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 hover:text-red-500 text-muted-foreground"
                      title="Xóa thông báo"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
