"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  FolderOpen,
  Eye,
  Search,
  ChevronLeft,
  ChevronRight,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

export const DASHBOARD_TABS = [
  {
    id: "projects",
    label: "Dự án",
    shortLabel: "Dự án",
    icon: FolderOpen,
    description: "Quản lý các dự án affiliate của bạn",
  },
  {
    id: "transparency",
    label: "Đối thủ (TTMB)",
    shortLabel: "TTMB",
    icon: Eye,
    description: "Phân tích đối thủ từ Trung tâm minh bạch",
  },
  {
    id: "manual",
    label: "Đối thủ (Search)",
    shortLabel: "Search",
    icon: Search,
    description: "Nghiên cứu đối thủ thủ công",
  },
] as const;

export type TabId = (typeof DASHBOARD_TABS)[number]["id"];

interface DashboardSidebarProps {
  activeTab: TabId;
  onEditProfile: () => void;
}

export function DashboardSidebar({
  activeTab,
  onEditProfile,
}: DashboardSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, signOut } = useAuth();

  const initials =
    user?.username?.slice(0, 2).toUpperCase() ?? "U";

  return (
    <aside
      className={cn(
        "relative flex h-screen flex-col bg-brand-panel text-white transition-[width] duration-300 ease-in-out shrink-0",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3.5 top-7 z-20 flex size-7 items-center justify-center rounded-full bg-[#059669] text-white shadow-lg shadow-[#059669]/40 hover:scale-110 transition-transform"
        aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
      >
        {collapsed ? (
          <ChevronRight size={13} />
        ) : (
          <ChevronLeft size={13} />
        )}
      </button>

      {/* Logo */}
      <div
        className={cn(
          "flex items-center gap-3 border-b border-white/10 px-4 py-5",
          collapsed && "justify-center px-0"
        )}
      >
        <Image
          src="/logo.png"
          alt="MIC ACE logo"
          width={632}
          height={395}
          className=""
          style={{ height: 30, width: "auto" }}
          priority
        />
        {!collapsed && (
          <span className="font-bold text-lg tracking-tight whitespace-nowrap">
            MIC ACE
          </span>
        )}
      </div>

      {/* Nav label */}
      {!collapsed && (
        <p className="px-4 pt-5 pb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Chức năng
        </p>
      )}

      {/* Nav items */}
      <nav className="flex-1 space-y-1 px-2">
        {DASHBOARD_TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <Link
              key={id}
              href={`/dashboard?tab=${id}`}
              title={collapsed ? label : undefined}
              className={cn(
                "group relative w-full flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-[#059669] text-white shadow-lg shadow-[#059669]/30"
                  : "text-slate-300 hover:bg-white/8 hover:text-white",
                collapsed && "justify-center px-0"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-white/70" />
              )}
              <Icon size={18} className="shrink-0" />
              {!collapsed && (
                <span className="truncate text-left">{label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Profile + actions */}
      <div className="border-t border-white/10 p-3 space-y-1">
        {/* User info */}
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl px-2 py-2",
            collapsed && "justify-center px-0"
          )}
        >
          <div className="size-9 rounded-full bg-[#059669] flex items-center justify-center text-xs font-bold shrink-0 shadow-md shadow-[#059669]/30">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user?.username}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          )}
        </div>

        {/* Edit profile */}
        <button
          onClick={onEditProfile}
          title={collapsed ? "Chỉnh sửa hồ sơ" : undefined}
          className={cn(
            "w-full flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-all",
            collapsed && "justify-center px-0"
          )}
        >
          <Settings size={16} className="shrink-0" />
          {!collapsed && "Chỉnh sửa hồ sơ"}
        </button>

        {/* Logout */}
        <button
          onClick={signOut}
          title={collapsed ? "Đăng xuất" : undefined}
          className={cn(
            "w-full flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && "Đăng xuất"}
        </button>
      </div>
    </aside>
  );
}
