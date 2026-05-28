"use client";

import { useEffect, useRef } from "react";
import { X, User, Mail, Shield, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-2.5">
        <Icon size={15} className="shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium">{value ?? "—"}</span>
      </div>
    </div>
  );
}

export function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { user } = useAuth();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Prevent scroll on body when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "U";

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const roleLabel = (role?: string | null) => {
    if (!role) return "—";
    const map: Record<string, string> = {
      admin: "Quản trị viên",
      user: "Người dùng",
    };
    return map[role] ?? role;
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className={cn(
          "relative z-10 w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl",
          "animate-in fade-in-0 zoom-in-95 duration-200"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">Hồ sơ của bạn</h2>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="size-20 rounded-full bg-[#059669] flex items-center justify-center text-2xl font-bold text-white shadow-lg shadow-[#059669]/30">
              {initials}
            </div>
            <div className="text-center">
              <p className="font-semibold text-base">{user?.username}</p>
              <span className="inline-block mt-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {roleLabel(user?.role)}
              </span>
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <Field icon={User} label="Tên đăng nhập" value={user?.username} />
            <Field icon={Mail} label="Email" value={user?.email} />
            <Field icon={Shield} label="Vai trò" value={roleLabel(user?.role)} />
            <Field
              icon={Calendar}
              label="Ngày tạo tài khoản"
              value={formatDate(user?.createdAt)}
            />
          </div>

          {/* Note */}
          <p className="text-center text-xs text-muted-foreground pt-1">
            Tính năng chỉnh sửa hồ sơ sẽ sớm ra mắt.
          </p>
        </div>
      </div>
    </div>
  );
}
