"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  MonitorPlay,
  Search,
  Send,
  Server,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

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
    id: "search-ads",
    label: "Quét quảng cáo",
    shortLabel: "Google Ads",
    icon: MonitorPlay,
    description: "Tìm nhà quảng cáo Google Ads theo từ khóa",
  },
  {
    id: "manual",
    label: "Đối thủ (SerpAPI)",
    shortLabel: "SerpAPI",
    icon: Search,
    description: "Nghiên cứu đối thủ qua SerpAPI",
  },
  {
    id: "search-ads-schedule",
    label: "Đặt lịch",
    shortLabel: "Lịch quét",
    icon: CalendarClock,
    description: "Đặt lịch quét quảng cáo Google Ads theo từ khóa và proxy",
  },
  {
    id: "my-search-ads-competitors",
    label: "Đối thủ của tôi",
    shortLabel: "Đối thủ",
    icon: Users,
    description: "Danh sách đối thủ Google Ads đã lưu theo từ khóa",
  },
  {
    id: "keyword-planner",
    label: "Google Ads",
    shortLabel: "Google Ads",
    icon: TrendingUp,
    description: "Keyword Planner & ủy quyền Gmail",
  },
  {
    id: "telegram-link",
    label: "Liên kết Telegram",
    shortLabel: "Telegram",
    icon: Send,
    description: "Xác thực và liên kết Telegram để nhận thông báo qua bot",
  },
  {
    id: "proxy",
    label: "Proxy",
    shortLabel: "Proxy",
    icon: Server,
    description: "Quản lý proxy dùng cho tìm kiếm Google Ads",
  },
  {
    id: "ads-strategy-skill",
    label: "Chiến lược chạy",
    shortLabel: "Skill Ads",
    icon: ClipboardList,
    description: "Tạo prompt phân tích website và lập chiến lược Google Search Ads",
  },
  {
    id: "project-overview",
    label: "Tổng hợp dự án",
    shortLabel: "Tổng hợp",
    icon: LayoutDashboard,
    description: "Xem content, keyword, traffic, quốc gia và đối thủ trong một màn hình",
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

  useNotifications();

  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "U";

  return (
    <aside
      className={cn(
        "relative flex h-screen shrink-0 flex-col bg-brand-panel text-white transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3.5 top-7 z-20 flex size-7 items-center justify-center rounded-full bg-[#059669] text-white shadow-lg shadow-[#059669]/40 transition-transform hover:scale-110"
        aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

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
          style={{ height: 30, width: "auto" }}
          priority
        />
        {!collapsed && (
          <span className="whitespace-nowrap text-lg font-bold tracking-tight">
            MIC ACE
          </span>
        )}
      </div>

      {!collapsed && (
        <p className="px-4 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Chức năng
        </p>
      )}

      <nav className="flex-1 space-y-1 px-2">
        {DASHBOARD_TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <Link
              key={id}
              href={`/dashboard?tab=${id}`}
              title={collapsed ? label : undefined}
              className={cn(
                "group relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-[#059669] text-white shadow-lg shadow-[#059669]/30"
                  : "text-slate-300 hover:bg-white/8 hover:text-white",
                collapsed && "justify-center px-0"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-white/70" />
              )}
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate text-left">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-white/10 p-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl px-2 py-2",
            collapsed && "justify-center px-0"
          )}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#059669] text-xs font-bold shadow-md shadow-[#059669]/30">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user?.username}</p>
              <p className="truncate text-xs text-slate-400">{user?.email}</p>
            </div>
          )}
        </div>

        <button
          onClick={onEditProfile}
          title={collapsed ? "Chỉnh sửa hồ sơ" : undefined}
          className={cn(
            "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-300 transition-all hover:bg-white/10 hover:text-white",
            collapsed && "justify-center px-0"
          )}
        >
          <Settings size={16} className="shrink-0" />
          {!collapsed && "Chỉnh sửa hồ sơ"}
        </button>

        <button
          onClick={signOut}
          title={collapsed ? "Đăng xuất" : undefined}
          className={cn(
            "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-400 transition-all hover:bg-red-500/10 hover:text-red-300",
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
