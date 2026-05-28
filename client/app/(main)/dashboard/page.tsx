"use client";

import { useMemo, useState } from "react";
import { FolderOpen, Eye, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  DashboardSidebar,
  DASHBOARD_TABS,
  type TabId,
} from "@/components/features/dashboard/DashboardSidebar";
import { EditProfileModal } from "@/components/features/dashboard/EditProfileModal";
import { AdsTransparencyTab } from "@/components/features/dashboard/AdsTransparencyTab";
import { ManualSearchTab } from "@/components/features/dashboard/ManualSearchTab";
import { ProjectsTab } from "@/components/features/dashboard/ProjectsTab";

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
    description:
      "Dữ liệu đối thủ từ Trung tâm minh bạch sẽ được hiển thị ở đây.",
  },
  manual: {
    icon: Search,
    heading: "Chưa có kết quả tìm kiếm",
    description:
      "Các đối thủ bạn nghiên cứu thủ công sẽ được lưu và hiển thị ở đây.",
  },
};

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  const activeTab = useMemo<TabId>(() => {
    const tab = searchParams.get("tab");
    if (tab === "transparency" || tab === "manual" || tab === "projects") {
      return tab;
    }
    return "projects";
  }, [searchParams]);

  const currentTab = DASHBOARD_TABS.find((t) => t.id === activeTab)!;
  const emptyState = EMPTY_STATES[activeTab];
  const EmptyIcon = emptyState.icon;

  return (
    <>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Sidebar */}
        <DashboardSidebar
          activeTab={activeTab}
          onEditProfile={() => setEditProfileOpen(true)}
        />

        {/* Main content */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          {/* Top header */}
          <header className="flex items-center gap-3 border-b border-border bg-background/80 backdrop-blur-sm px-6 py-4 shrink-0">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#059669]/10">
              <currentTab.icon size={18} className="text-[#059669]" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">
                {currentTab.label}
              </h1>
              <p className="text-xs text-muted-foreground">
                {currentTab.description}
              </p>
            </div>
          </header>

          {/* Content area */}
          <main className="flex-1 overflow-y-auto p-6">
            {activeTab === "projects" ? (
              <ProjectsTab />
            ) : activeTab === "transparency" ? (
              <AdsTransparencyTab />
            ) : activeTab === "manual" ? (
              <ManualSearchTab />
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
                  <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Tính năng đang được phát triển
                </p>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Profile modal */}
      <EditProfileModal
        isOpen={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
      />
    </>
  );
}
