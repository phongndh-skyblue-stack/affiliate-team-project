"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  Eye,
  FolderOpen,
  MonitorPlay,
  Search,
  Send,
  Server,
  TrendingUp,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AdsTransparencyTab } from "@/components/features/dashboard/AdsTransparencyTab";
import {
  DASHBOARD_TABS,
  DashboardSidebar,
  type TabId,
} from "@/components/features/dashboard/DashboardSidebar";
import { EditProfileModal } from "@/components/features/dashboard/EditProfileModal";
import { GoogleAdsTab } from "@/components/features/dashboard/GoogleAdsTab";
import { ManualSearchTab } from "@/components/features/dashboard/ManualSearchTab";
import { NotificationBell } from "@/components/features/dashboard/NotificationBell";
import { ProjectsTab } from "@/components/features/dashboard/ProjectsTab";
import { ProxyTab } from "@/components/features/dashboard/ProxyTab";
import { SearchAdsScheduleTab } from "@/components/features/dashboard/SearchAdsScheduleTab";
import { SearchAdsTab } from "@/components/features/dashboard/SearchAdsTab";
import { TelegramLinkTab } from "@/components/features/dashboard/TelegramLinkTab";

const EMPTY_STATES: Record<
  TabId,
  { icon: React.ElementType; heading: string; description: string }
> = {
  projects: {
    icon: FolderOpen,
    heading: "Chưa có dự án nào",
    description: "Các dự án affiliate của bạn sẽ hiển thị ở đây.",
  },
  transparency: {
    icon: Eye,
    heading: "Chưa có dữ liệu minh bạch",
    description: "Dữ liệu đối thủ từ Trung tâm minh bạch sẽ được hiển thị ở đây.",
  },
  manual: {
    icon: Search,
    heading: "Chưa có kết quả tìm kiếm",
    description: "Các đối thủ bạn nghiên cứu qua SerpAPI sẽ được lưu và hiển thị ở đây.",
  },
  "search-ads": {
    icon: MonitorPlay,
    heading: "Chưa có kết quả Google Ads",
    description: "Nhập từ khóa để tìm nhà quảng cáo Google Ads.",
  },
  "search-ads-schedule": {
    icon: CalendarClock,
    heading: "Chưa có lịch quét quảng cáo",
    description: "Đặt lịch để hệ thống tự quét quảng cáo Google Ads theo thời điểm bạn chọn.",
  },
  proxy: {
    icon: Server,
    heading: "Chưa có proxy nào",
    description: "Thêm proxy để dùng khi tìm kiếm Google Ads.",
  },
  "telegram-link": {
    icon: Send,
    heading: "Chưa liên kết Telegram",
    description: "Liên kết Telegram để nhận thông báo qua bot.",
  },
  "keyword-planner": {
    icon: TrendingUp,
    heading: "Chưa có dữ liệu Google Ads",
    description: "Quét keyword ideas hoặc ủy quyền Gmail truy cập Google Ads.",
  },
};

function isTabId(value: string | null): value is TabId {
  return DASHBOARD_TABS.some((tab) => tab.id === value);
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  const activeTab = useMemo<TabId>(() => {
    const tab = searchParams.get("tab");
    return isTabId(tab) ? tab : "projects";
  }, [searchParams]);

  const currentTab = DASHBOARD_TABS.find((tab) => tab.id === activeTab)!;
  const emptyState = EMPTY_STATES[activeTab];
  const EmptyIcon = emptyState.icon;

  return (
    <>
      <div className="flex h-screen overflow-hidden bg-background">
        <DashboardSidebar
          activeTab={activeTab}
          onEditProfile={() => setEditProfileOpen(true)}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex shrink-0 items-center gap-3 border-b border-border bg-background/80 px-6 py-4 backdrop-blur-sm">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#059669]/10">
              <currentTab.icon size={18} className="text-[#059669]" />
            </div>
            <div className="flex-1">
              <h1 className="text-base font-semibold leading-tight">
                {currentTab.label}
              </h1>
              <p className="text-xs text-muted-foreground">
                {currentTab.description}
              </p>
            </div>
            <NotificationBell />
          </header>

          <main className="flex-1 overflow-y-auto p-6">
            {activeTab === "projects" ? (
              <ProjectsTab />
            ) : activeTab === "transparency" ? (
              <AdsTransparencyTab />
            ) : activeTab === "manual" ? (
              <ManualSearchTab />
            ) : activeTab === "search-ads" ? (
              <SearchAdsTab />
            ) : activeTab === "search-ads-schedule" ? (
              <SearchAdsScheduleTab />
            ) : activeTab === "proxy" ? (
              <ProxyTab />
            ) : activeTab === "telegram-link" ? (
              <TelegramLinkTab />
            ) : activeTab === "keyword-planner" ? (
              <GoogleAdsTab />
            ) : (
              <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
                <div className="mb-5 flex size-20 items-center justify-center rounded-2xl bg-[#059669]/10 ring-8 ring-[#059669]/5">
                  <EmptyIcon size={36} className="text-[#059669]/70" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">
                  {emptyState.heading}
                </h2>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  {emptyState.description}
                </p>
                <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-muted px-4 py-1.5 text-xs text-muted-foreground">
                  <span className="size-1.5 animate-pulse rounded-full bg-amber-400" />
                  Tính năng đang được phát triển
                </p>
              </div>
            )}
          </main>
        </div>
      </div>

      <EditProfileModal
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
      />
    </>
  );
}
