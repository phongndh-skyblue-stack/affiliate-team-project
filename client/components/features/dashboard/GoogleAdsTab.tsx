"use client";

import { useState } from "react";
import { Hash, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { KeywordPlannerTab } from "@/components/features/dashboard/KeywordPlannerTab";
import { MailDelegationTab } from "@/components/features/dashboard/MailDelegationTab";

const TABS = [
  {
    id: "keyword-planner",
    label: "Keyword Planner",
    icon: Hash,
  },
  {
    id: "mail-delegation",
    label: "Ủy quyền Mail",
    icon: Mail,
  },
] as const;

type InnerTab = (typeof TABS)[number]["id"];

export function GoogleAdsTab() {
  const [activeTab, setActiveTab] = useState<InnerTab>("keyword-planner");

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Inner tab bar */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1 self-start">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-[#059669] text-white shadow-sm shadow-[#059669]/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-background"
              )}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeTab === "keyword-planner" ? (
          <KeywordPlannerTab />
        ) : (
          <MailDelegationTab />
        )}
      </div>
    </div>
  );
}
