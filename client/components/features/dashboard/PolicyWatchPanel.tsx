"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import policyWatchService from "@/services/policyWatch.service";
import type {
  PolicyChangeEvent,
  PolicySnapshotStatus,
} from "@/types/policyWatch.types";

const PLATFORM_STYLE: Record<string, string> = {
  "Google Ads": "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  Meta: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  TikTok: "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300",
};

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
        PLATFORM_STYLE[platform] || "bg-muted text-muted-foreground"
      )}
    >
      {platform}
    </span>
  );
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function PolicyWatchPanel() {
  const [changes, setChanges] = useState<PolicyChangeEvent[]>([]);
  const [sources, setSources] = useState<PolicySnapshotStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [changesRes, statusRes] = await Promise.all([
        policyWatchService.listChanges(),
        policyWatchService.getStatus(),
      ]);
      setChanges(changesRes.items);
      setSources(statusRes.sources);
    } catch {
      // Không chặn UI — chỉ là panel phụ trợ
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCheckNow() {
    setChecking(true);
    const toastId = toast.loading("Đang kiểm tra chính sách Google Ads...");
    try {
      const result = await policyWatchService.checkNow();
      toast.dismiss(toastId);
      if (result.changed > 0) {
        toast.warning(
          `Phát hiện ${result.changed} thay đổi chính sách trên ${result.checked} nguồn!`
        );
      } else {
        toast.success(
          `Đã kiểm tra ${result.checked} nguồn — chưa có thay đổi nào.`
        );
      }
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} nguồn không tải được.`);
      }
      await refresh();
    } catch {
      toast.dismiss(toastId);
      toast.error("Kiểm tra thất bại. Vui lòng thử lại.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <ShieldCheck size={15} className="text-[#059669]" /> Theo dõi Chính sách Quảng cáo
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Google Ads · Meta · TikTok — tự quét mỗi giờ. Khi chính sách thay đổi sẽ báo qua chuông & Telegram.
          </p>
        </div>
        <button
          onClick={handleCheckNow}
          disabled={checking}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#059669] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#047857] disabled:opacity-60 transition-colors"
        >
          {checking ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          Kiểm tra ngay
        </button>
      </div>

      {/* Trạng thái các nguồn đang theo dõi */}
      <div className="space-y-1.5">
        {sources.length === 0 && !loading ? (
          <p className="text-[11px] text-muted-foreground italic">
            Chưa có nguồn nào được theo dõi (lần quét đầu tiên sẽ tạo baseline).
          </p>
        ) : (
          sources.map((s) => (
            <a
              key={s.sourceUrl}
              href={s.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-[11px] hover:bg-muted/70 transition-colors group"
            >
              <span className="truncate text-foreground flex items-center gap-1.5">
                <PlatformBadge platform={s.platform} />
                {s.title || s.sourceUrl}
              </span>
              <span className="shrink-0 text-muted-foreground flex items-center gap-1">
                {formatDateTime(s.fetchedAt)}
                <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
            </a>
          ))
        )}
      </div>

      {/* Lịch sử thay đổi gần đây */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Thay đổi gần đây
        </p>
        {changes.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-[11px] text-muted-foreground">
            <ShieldCheck size={14} className="text-emerald-500" />
            Chưa phát hiện thay đổi chính sách nào.
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {changes.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/30"
              >
                <div className="flex items-start gap-1.5">
                  <AlertTriangle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <a
                      href={c.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-amber-900 dark:text-amber-200 hover:underline truncate block"
                    >
                      {c.title || c.sourceUrl}
                    </a>
                    {c.summary && (
                      <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                        {c.summary}
                      </p>
                    )}
                    <p className="text-[10px] text-amber-700/60 dark:text-amber-400/60 mt-1 flex items-center gap-1.5">
                      <PlatformBadge platform={c.platform} />
                      {formatDateTime(c.detectedAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PolicyWatchPanel;
