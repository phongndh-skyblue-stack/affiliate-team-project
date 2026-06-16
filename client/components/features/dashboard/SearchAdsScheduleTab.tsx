"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  ExternalLink,
  Globe,
  Link2,
  Loader2,
  MapPin,
  Monitor,
  MonitorPlay,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Smartphone,
  Trash2,
  Video,
  VideoOff,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { API_BASE_URL } from "@/constants/config";
import { cn } from "@/lib/utils";
import { proxyService } from "@/services/proxy.service";
import { searchAdsService } from "@/services/searchAds.service";
import { telegramService } from "@/services/telegram.service";
import type { ProxyResponse } from "@/types/proxy.types";
import type {
  OrganicLinkItem,
  SearchAdItem,
  SearchAdsHistoryItem,
  SearchAdsScheduleItem,
} from "@/types/searchAds.types";

const LOCATION_OPTIONS = [
  { value: "Vietnam", label: "Việt Nam" },
  { value: "United States", label: "Hoa Kỳ" },
  { value: "United Kingdom", label: "Vương quốc Anh" },
  { value: "Australia", label: "Úc" },
  { value: "Singapore", label: "Singapore" },
  { value: "Canada", label: "Canada" },
  { value: "Germany", label: "Đức" },
  { value: "France", label: "Pháp" },
  { value: "Italy", label: "Ý" },
  { value: "Spain", label: "Tây Ban Nha" },
  { value: "Netherlands", label: "Hà Lan" },
  { value: "Switzerland", label: "Thụy Sĩ" },
  { value: "Sweden", label: "Thụy Điển" },
  { value: "Norway", label: "Na Uy" },
  { value: "Denmark", label: "Đan Mạch" },
  { value: "Finland", label: "Phần Lan" },
  { value: "Ireland", label: "Ireland" },
  { value: "Belgium", label: "Bỉ" },
  { value: "Austria", label: "Áo" },
  { value: "Poland", label: "Ba Lan" },
  { value: "Portugal", label: "Bồ Đào Nha" },
  { value: "Greece", label: "Hy Lạp" },
  { value: "Czech Republic", label: "Séc" },
  { value: "Hungary", label: "Hungary" },
  { value: "Romania", label: "Romania" },
  { value: "Turkey", label: "Thổ Nhĩ Kỳ" },
  { value: "United Arab Emirates", label: "UAE" },
  { value: "Saudi Arabia", label: "Ả Rập Xê Út" },
  { value: "Qatar", label: "Qatar" },
  { value: "Kuwait", label: "Kuwait" },
  { value: "India", label: "Ấn Độ" },
  { value: "Thailand", label: "Thái Lan" },
  { value: "Indonesia", label: "Indonesia" },
  { value: "Malaysia", label: "Malaysia" },
  { value: "Philippines", label: "Philippines" },
  { value: "Japan", label: "Nhật Bản" },
  { value: "South Korea", label: "Hàn Quốc" },
  { value: "Taiwan", label: "Đài Loan" },
  { value: "Hong Kong", label: "Hồng Kông" },
  { value: "China", label: "Trung Quốc" },
  { value: "New Zealand", label: "New Zealand" },
  { value: "Brazil", label: "Brazil" },
  { value: "Mexico", label: "Mexico" },
  { value: "Argentina", label: "Argentina" },
  { value: "Chile", label: "Chile" },
  { value: "Colombia", label: "Colombia" },
  { value: "Peru", label: "Peru" },
  { value: "South Africa", label: "Nam Phi" },
  { value: "Nigeria", label: "Nigeria" },
  { value: "Kenya", label: "Kenya" },
  { value: "Egypt", label: "Ai Cập" },
  { value: "Israel", label: "Israel" },
];

const LANGUAGE_OPTIONS = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "Tiếng Anh" },
  { value: "ja", label: "Tiếng Nhật" },
  { value: "ko", label: "Tiếng Hàn" },
];

const DEVICE_OPTIONS = [
  { value: "desktop", label: "Máy tính" },
  { value: "mobile", label: "Điện thoại" },
];

function toDateTimeLocal(value: Date) {
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatDateTime(value: string) {
  return parseUtcDate(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseUtcDate(value: string) {
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) {
    return new Date(value);
  }
  return new Date(`${value}Z`);
}

function formatResultTime(value: string) {
  return parseUtcDate(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mediaUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

function optionLabel(options: { value: string; label: string }[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function locationLabel(value: string) {
  return optionLabel(LOCATION_OPTIONS, value);
}

function languageLabel(value: string) {
  return optionLabel(LANGUAGE_OPTIONS, value);
}

function deviceLabel(value: string) {
  return optionLabel(DEVICE_OPTIONS, value);
}

function statusMeta(status: string) {
  const map: Record<
    string,
    { label: string; className: string; icon: typeof Clock3 }
  > = {
    pending: {
      label: "Chờ xếp hàng",
      className: "bg-slate-500/10 text-slate-600",
      icon: Clock3,
    },
    enqueued: {
      label: "Đã đặt lịch",
      className: "bg-amber-500/10 text-amber-700",
      icon: CalendarClock,
    },
    running: {
      label: "Đang chạy",
      className: "bg-blue-500/10 text-blue-700",
      icon: Loader2,
    },
    done: {
      label: "Đã hoàn tất",
      className: "bg-[#059669]/10 text-[#059669]",
      icon: CheckCircle2,
    },
    failed: {
      label: "Lỗi",
      className: "bg-destructive/10 text-destructive",
      icon: XCircle,
    },
    cancelled: {
      label: "Đã hủy",
      className: "bg-muted text-muted-foreground",
      icon: XCircle,
    },
  };
  return map[status] ?? map.pending;
}

interface ScheduleGroup {
  id: string;
  items: SearchAdsScheduleItem[];
  keyword: string;
  location: string;
  language: string;
  device: string;
  proxyName?: string | null;
  scheduleMode: "once" | "daily";
  dailyTime?: string | null;
  notifyTelegramOnChange: boolean;
  createdAt: string;
  nextRunAt: string;
  total: number;
  done: number;
  running: number;
  pending: number;
  failed: number;
  cancelled: number;
}

type ScheduleView = "history" | "keyword";

function groupKey(item: SearchAdsScheduleItem, view: ScheduleView) {
  if (view === "keyword") {
    return ["keyword", item.keyword.trim().toLowerCase()].join("|");
  }
  if (item.batchId) return item.batchId;
  return [
    item.keyword,
    item.location,
    item.language,
    item.device,
    item.proxyId ?? "no-proxy",
    item.createdAt.slice(0, 16),
  ].join("|");
}

function buildScheduleGroups(items: SearchAdsScheduleItem[], view: ScheduleView) {
  const map = new Map<string, SearchAdsScheduleItem[]>();
  for (const item of items) {
    const key = groupKey(item, view);
    map.set(key, [...(map.get(key) ?? []), item]);
  }

  return Array.from(map.entries())
    .map(([id, groupItems]) => {
      const sorted = [...groupItems].sort((a, b) => parseUtcDate(a.runAt).getTime() - parseUtcDate(b.runAt).getTime());
      const first = sorted[0];
      return {
        id,
        items: sorted,
        keyword: first.keyword,
        location: first.location,
        language: first.language,
        device: first.device,
        proxyName: first.proxyName,
        scheduleMode: first.scheduleMode ?? "once",
        dailyTime: first.dailyTime,
        notifyTelegramOnChange: first.notifyTelegramOnChange ?? false,
        createdAt: view === "keyword" ? sorted[sorted.length - 1].createdAt : first.createdAt,
        nextRunAt: sorted[0].runAt,
        total: sorted.length,
        done: sorted.filter((item) => item.status === "done").length,
        running: sorted.filter((item) => item.status === "running").length,
        pending: sorted.filter((item) => ["pending", "enqueued"].includes(item.status)).length,
        failed: sorted.filter((item) => item.status === "failed").length,
        cancelled: sorted.filter((item) => item.status === "cancelled").length,
      } satisfies ScheduleGroup;
    })
    .sort((a, b) => parseUtcDate(b.createdAt).getTime() - parseUtcDate(a.createdAt).getTime());
}

function groupStatusMeta(group: ScheduleGroup) {
  if (group.running > 0) return statusMeta("running");
  if (group.pending > 0) return statusMeta("enqueued");
  if (group.failed > 0) return statusMeta("failed");
  if (group.done > 0 && group.done === group.total) return statusMeta("done");
  if (group.cancelled === group.total) return statusMeta("cancelled");
  if (group.done > 0) return statusMeta("done");
  return statusMeta("pending");
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        pct >= 90 ? "bg-[#059669]/10 text-[#059669]" : "bg-amber-500/10 text-amber-700"
      )}
    >
      {pct}%
    </span>
  );
}

function OrganicLinks({ links }: { links: OrganicLinkItem[] }) {
  if (!links.length) return null;
  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/30 px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Link2 size={12} />
        Kết quả tự nhiên ({links.length})
      </p>
      <div className="space-y-1">
        {links.map((link, index) => (
          <a
            key={`${link.url}-${index}`}
            href={link.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between gap-2 text-xs hover:text-[#059669]"
          >
            <span className="truncate text-foreground group-hover:underline">{link.title || link.url}</span>
            <ExternalLink size={10} className="shrink-0 text-muted-foreground" />
          </a>
        ))}
      </div>
    </div>
  );
}

function AdResultCard({ ad }: { ad: SearchAdItem }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex items-start gap-3 p-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#059669]/10 text-xs font-bold text-[#059669]">
          {ad.position}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">
            {ad.title || "Không có tiêu đề"}
          </p>
          {ad.snippet && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{ad.snippet}</p>}
          {ad.displayUrl && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{ad.displayUrl}</p>}
        </div>
        <ConfidenceBadge value={ad.confidence} />
      </div>

      {(ad.advertiserName || ad.advertiserDomain || ad.advertiserLocation) && (
        <div className="space-y-1 border-t border-border bg-muted/30 px-3 py-2 text-xs">
          {(ad.advertiserName || ad.advertiserLocation) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {ad.advertiserName && (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <ShieldCheck size={11} className="text-[#059669]" />
                  <span className="text-muted-foreground">Advertiser:</span>
                  <span>{ad.advertiserName}</span>
                </span>
              )}
              {ad.advertiserLocation && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={11} className="text-muted-foreground" />
                  <span className="text-muted-foreground">Location:</span>
                  <span className="font-medium">{ad.advertiserLocation}</span>
                </span>
              )}
            </div>
          )}
          {ad.advertiserDomain && (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Globe size={11} />
              <span>Domain:</span>
              <span>{ad.advertiserDomain}</span>
            </span>
          )}
        </div>
      )}

      {ad.landingPage && (
        <div className="space-y-1.5 border-t border-border bg-muted/10 px-3 py-2 text-xs">
          <p className="flex items-center gap-1.5 font-semibold text-muted-foreground">
            <Link2 size={11} />
            Landing Page
          </p>
          {ad.landingPage.originalUrl && (
            <div className="flex items-start gap-1.5">
              <span className="w-20 shrink-0 text-muted-foreground">Original URL:</span>
              <a
                href={ad.landingPage.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-[#059669] hover:underline"
              >
                {ad.landingPage.originalUrl}
              </a>
            </div>
          )}
          {ad.landingPage.finalUrl && (
            <div className="flex items-start gap-1.5">
              <span className="w-20 shrink-0 text-muted-foreground">Final URL:</span>
              <a
                href={ad.landingPage.finalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-[#059669] hover:underline"
              >
                {ad.landingPage.finalUrl}
              </a>
            </div>
          )}
          {ad.landingPage.domain && (
            <div className="flex items-center gap-1.5">
              <span className="w-20 shrink-0 text-muted-foreground">Domain:</span>
              <span className="font-medium">{ad.landingPage.domain}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-20 shrink-0 text-muted-foreground">Status:</span>
            <span className={cn("font-medium", ad.landingPage.status === "success" ? "text-[#059669]" : "text-destructive")}>
              {ad.landingPage.status}
            </span>
            {ad.landingPage.finalStatusCode && (
              <span className="text-muted-foreground">({ad.landingPage.finalStatusCode})</span>
            )}
          </div>
          {(ad.landingPage.redirectChain?.length ?? 0) > 0 && (
            <div className="flex items-start gap-1.5">
              <span className="w-20 shrink-0 text-muted-foreground">Redirects:</span>
              <div className="space-y-0.5">
                {ad.landingPage.redirectChain.map((url, index) => (
                  <a
                    key={`${url}-${index}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-all text-muted-foreground hover:text-[#059669] hover:underline"
                  >
                    {index + 1}. {url}
                  </a>
                ))}
              </div>
            </div>
          )}
          {ad.landingPage.error && (
            <div className="flex items-start gap-1.5">
              <span className="w-20 shrink-0 text-muted-foreground">Error:</span>
              <p className="break-all text-destructive">{ad.landingPage.error}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 border-t border-border px-3 py-2">
        {ad.targetUrl && (
          <a
            href={ad.targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#059669] hover:underline"
          >
            Xem quảng cáo <ExternalLink size={11} />
          </a>
        )}
        {ad.landingPage?.finalUrl && ad.landingPage.finalUrl !== ad.targetUrl && (
          <a
            href={ad.landingPage.finalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            Landing page <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}

function ScheduledResultDetail({ item }: { item: SearchAdsHistoryItem }) {
  const meta = statusMeta(item.status);
  const StatusIcon = meta.icon;
  const videoUrl = mediaUrl(item.videoUrl);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#059669]/10 text-[#059669]">
          <MonitorPlay size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">{item.keyword}</p>
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", meta.className)}>
              <StatusIcon size={11} />
              {meta.label}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin size={10} />{locationLabel(item.location)}</span>
            <span className="inline-flex items-center gap-1"><Globe size={10} />{languageLabel(item.language)}</span>
            <span className="inline-flex items-center gap-1">
              {item.device === "mobile" ? <Smartphone size={10} /> : <Monitor size={10} />}
              {deviceLabel(item.device)}
            </span>
            <span className="inline-flex items-center gap-1"><Server size={10} />{item.proxyName || "Không dùng proxy"}</span>
            <span>{formatResultTime(item.createdAt)}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold">{item.totalAdsFound} quảng cáo</p>
          <p className="text-[11px] text-muted-foreground">{item.ads.length} mẫu đã lưu</p>
        </div>
      </div>

      {item.finalSummary && <p className="text-xs italic text-muted-foreground">{item.finalSummary}</p>}

      {videoUrl && item.videoStatus === "available" ? (
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Video size={13} />
            Video quá trình quét
          </p>
          <video
            src={videoUrl}
            controls
            preload="metadata"
            className="aspect-video w-full rounded-lg border border-border bg-black"
          />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <VideoOff size={13} />
            Không có video ghi lại cho lần quét này.
          </span>
        </div>
      )}

      {item.errors.length > 0 && (
        <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {item.errors.map((error, index) => <p key={index}>{error}</p>)}
        </div>
      )}

      {item.ads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          Lịch đã chạy nhưng không tìm thấy quảng cáo.
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {item.ads.map((ad, index) => (
            <AdResultCard key={`${item.id}-${index}`} ad={ad} />
          ))}
        </div>
      )}

      <OrganicLinks links={item.organicLinks ?? []} />

      {item.searchUrl && (
        <a
          href={item.searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#059669] hover:underline"
        >
          <Search size={11} />
          Xem trang tìm kiếm gốc
          <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

function ScheduleRow({
  item,
  cancelling,
  hasResult,
  onCancel,
  onViewResult,
}: {
  item: SearchAdsScheduleItem;
  cancelling: boolean;
  hasResult: boolean;
  onCancel: (id: string) => void;
  onViewResult: (searchId: string) => void;
}) {
  const meta = statusMeta(item.status);
  const StatusIcon = meta.icon;
  const canCancel = !["done", "running", "cancelled"].includes(item.status);

  return (
    <div className="grid gap-3 border-b border-border px-4 py-3 last:border-b-0 lg:grid-cols-[1fr_180px_190px_96px] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold">{item.keyword}</p>
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", meta.className)}>
            <StatusIcon size={11} className={item.status === "running" ? "animate-spin" : ""} />
            {meta.label}
          </span>
          {item.scheduleMode === "daily" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#0f766e]/10 px-2 py-0.5 text-[11px] font-medium text-[#0f766e]">
              <CalendarDays size={11} />
              Hằng ngày {item.dailyTime}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><MapPin size={10} />{locationLabel(item.location)}</span>
          <span className="inline-flex items-center gap-1"><Globe size={10} />{languageLabel(item.language)}</span>
          <span className="inline-flex items-center gap-1">
            {item.device === "mobile" ? <Smartphone size={10} /> : <Monitor size={10} />}
            {deviceLabel(item.device)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Server size={10} />
            {item.proxyName || "Không dùng proxy"}
          </span>
        </div>
        {item.error && <p className="mt-2 text-xs text-destructive">{item.error}</p>}
      </div>

      <div>
        <p className="text-[11px] text-muted-foreground lg:hidden">Thời gian chạy</p>
        <p className="text-sm font-medium">{formatDateTime(item.runAt)}</p>
      </div>

      <div>
        <p className="text-[11px] text-muted-foreground lg:hidden">Kết quả</p>
        {item.searchId && hasResult ? (
          <button
            type="button"
            onClick={() => onViewResult(item.searchId!)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#059669]/30 bg-[#059669]/10 px-3 py-1.5 text-xs font-medium text-[#047857] hover:bg-[#059669]/15"
          >
            <MonitorPlay size={12} />
            Xem kết quả
          </button>
        ) : item.searchId ? (
          <span className="text-xs font-medium text-amber-700">Đang tải kết quả</span>
        ) : (
          <span className="text-xs text-muted-foreground">Chưa có kết quả</span>
        )}
      </div>

      <div className="flex justify-end">
        {canCancel && (
          <button
            type="button"
            onClick={() => onCancel(item.id)}
            disabled={cancelling}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            title="Hủy lịch"
          >
            {cancelling ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

function ScheduleGroupAccordion({
  group,
  defaultOpen,
  cancellingId,
  resultById,
  onCancel,
  onViewResult,
}: {
  group: ScheduleGroup;
  defaultOpen: boolean;
  cancellingId: string | null;
  resultById: Map<string, SearchAdsHistoryItem>;
  onCancel: (id: string) => void;
  onViewResult: (searchId: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = groupStatusMeta(group);
  const StatusIcon = meta.icon;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#059669]/10 text-[#059669]">
          <CalendarClock size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">{group.keyword}</p>
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", meta.className)}>
              <StatusIcon size={11} className={group.running > 0 ? "animate-spin" : ""} />
              {meta.label}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {group.scheduleMode === "daily" ? `${group.total} lần daily` : `${group.total} mốc`}
            </span>
            {group.notifyTelegramOnChange && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#059669]/10 px-2 py-0.5 text-[11px] font-medium text-[#047857]">
                <Bell size={11} />
                Telegram
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin size={10} />{locationLabel(group.location)}</span>
            <span className="inline-flex items-center gap-1"><Globe size={10} />{languageLabel(group.language)}</span>
            <span className="inline-flex items-center gap-1">
              {group.device === "mobile" ? <Smartphone size={10} /> : <Monitor size={10} />}
              {deviceLabel(group.device)}
            </span>
            <span className="inline-flex items-center gap-1"><Server size={10} />{group.proxyName || "Không dùng proxy"}</span>
          </div>
        </div>
        <div className="hidden shrink-0 text-right md:block">
          <p className="text-sm font-semibold">{formatDateTime(group.nextRunAt)}</p>
          <p className="text-[11px] text-muted-foreground">
            {group.done} xong, {group.pending} chờ, {group.cancelled} hủy
          </p>
        </div>
        {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border bg-muted/10">
          {group.items.map((item) => (
            <ScheduleRow
              key={item.id}
              item={item}
              cancelling={cancellingId === item.id}
              hasResult={Boolean(item.searchId && resultById.has(item.searchId))}
              onCancel={onCancel}
              onViewResult={onViewResult}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SearchAdsScheduleTab() {
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("Vietnam");
  const [language, setLanguage] = useState("vi");
  const [device, setDevice] = useState("desktop");
  const [useProxy, setUseProxy] = useState(false);
  const [selectedProxyId, setSelectedProxyId] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"once" | "daily">("once");
  const [scheduleTimes, setScheduleTimes] = useState<string[]>([""]);
  const [dailyTimes, setDailyTimes] = useState<string[]>(["09:00"]);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [notifyTelegramOnChange, setNotifyTelegramOnChange] = useState(false);
  const [proxies, setProxies] = useState<ProxyResponse[]>([]);
  const [proxiesLoading, setProxiesLoading] = useState(false);
  const [schedules, setSchedules] = useState<SearchAdsScheduleItem[]>([]);
  const [scheduledResults, setScheduledResults] = useState<SearchAdsHistoryItem[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [scheduleView, setScheduleView] = useState<ScheduleView>("history");
  const hasFetched = useRef(false);

  const selectClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30 disabled:opacity-50";

  const upcomingSchedules = useMemo(
    () => schedules.filter((item) => ["pending", "enqueued", "running"].includes(item.status)).length,
    [schedules]
  );
  const scheduleGroups = useMemo(() => buildScheduleGroups(schedules, scheduleView), [schedules, scheduleView]);
  const resultById = useMemo(
    () => new Map(scheduledResults.map((item) => [item.id, item])),
    [scheduledResults]
  );
  const selectedResult = selectedResultId ? resultById.get(selectedResultId) : null;

  async function fetchSchedules() {
    setSchedulesLoading(true);
    try {
      const res = await searchAdsService.getSchedules();
      setSchedules(res.items);
    } catch {
      toast.error("Không tải được danh sách lịch quét");
    } finally {
      setSchedulesLoading(false);
    }
  }

  async function fetchScheduledResults() {
    setResultsLoading(true);
    try {
      const res = await searchAdsService.getScheduledResults();
      setScheduledResults(res.items);
      return res.items;
    } catch {
      toast.error("Không tải được kết quả quét từ lịch");
      return [];
    } finally {
      setResultsLoading(false);
    }
  }

  async function refreshScheduleData() {
    await Promise.all([fetchSchedules(), fetchScheduledResults()]);
  }

  async function fetchProxies() {
    setProxiesLoading(true);
    try {
      const res = await proxyService.list();
      setProxies(res.items);
    } catch {
      toast.error("Không tải được danh sách proxy");
    } finally {
      setProxiesLoading(false);
    }
  }

  async function fetchTelegramSubscription() {
    try {
      const subscription = await telegramService.getSubscription();
      const linked = Boolean(subscription?.enabled);
      setTelegramLinked(linked);
      setNotifyTelegramOnChange(linked);
    } catch {
      setTelegramLinked(false);
      setNotifyTelegramOnChange(false);
    }
  }

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchSchedules();
    fetchScheduledResults();
    fetchProxies();
    fetchTelegramSubscription();
  }, []);

  const addScheduleTime = () => {
    const last = scheduleTimes[scheduleTimes.length - 1];
    const base = last ? new Date(last) : new Date();
    setScheduleTimes((prev) => [
      ...prev,
      toDateTimeLocal(new Date(base.getTime() + 60 * 60 * 1000)),
    ]);
  };

  const addQuickTime = (hours: number) => {
    setScheduleTimes((prev) => [
      ...prev.filter(Boolean),
      toDateTimeLocal(new Date(Date.now() + hours * 60 * 60 * 1000)),
    ]);
  };

  const updateScheduleTime = (index: number, value: string) => {
    setScheduleTimes((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const removeScheduleTime = (index: number) => {
    setScheduleTimes((prev) => (prev.length === 1 ? [""] : prev.filter((_, i) => i !== index)));
  };

  const addDailyTime = () => {
    const last = dailyTimes[dailyTimes.length - 1] || "09:00";
    const [hourText, minuteText] = last.split(":");
    const next = new Date();
    next.setHours(Number(hourText) || 9, Number(minuteText) || 0, 0, 0);
    next.setHours(next.getHours() + 1);
    setDailyTimes((prev) => [
      ...prev,
      `${String(next.getHours()).padStart(2, "0")}:${String(next.getMinutes()).padStart(2, "0")}`,
    ]);
  };

  const addQuickDailyTime = (value: string) => {
    setDailyTimes((prev) => Array.from(new Set([...prev.filter(Boolean), value])).sort());
  };

  const updateDailyTime = (index: number, value: string) => {
    setDailyTimes((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const removeDailyTime = (index: number) => {
    setDailyTimes((prev) => (prev.length === 1 ? [""] : prev.filter((_, i) => i !== index)));
  };

  const handleCreateSchedules = async () => {
    if (!keyword.trim()) {
      toast.error("Vui lòng nhập từ khóa cần quét");
      return;
    }
    if (useProxy && !selectedProxyId) {
      toast.error("Vui lòng chọn proxy hoặc tắt tùy chọn dùng proxy");
      return;
    }

    const runAt = scheduleTimes
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()));
    const normalizedDailyTimes = Array.from(new Set(dailyTimes.filter(Boolean))).sort();

    if (scheduleMode === "once") {
      if (runAt.length === 0) {
        toast.error("Vui lòng chọn ít nhất một mốc thời gian");
        return;
      }
      if (runAt.some((value) => value.getTime() <= Date.now())) {
        toast.error("Mốc thời gian chạy phải lớn hơn hiện tại");
        return;
      }
    } else if (normalizedDailyTimes.length === 0) {
      toast.error("Vui lòng chọn ít nhất một giờ chạy hằng ngày");
      return;
    }

    setSubmitting(true);
    try {
      const res = await searchAdsService.createSchedules({
        keyword: keyword.trim(),
        location,
        language,
        device,
        noProxy: !useProxy,
        headful: false,
        proxyId: useProxy ? selectedProxyId : null,
        scheduleMode,
        runAt: scheduleMode === "once" ? runAt.map((value) => value.toISOString()) : [],
        dailyTimes: scheduleMode === "daily" ? normalizedDailyTimes : [],
        notifyTelegramOnChange: scheduleMode === "daily" && notifyTelegramOnChange,
      });
      setSchedules((prev) => [...res.items, ...prev]);
      if (scheduleMode === "once") {
        setScheduleTimes([""]);
      }
      fetchScheduledResults();
      toast.success(
        scheduleMode === "daily"
          ? `Đã đặt ${res.total} lịch quét hằng ngày`
          : `Đã đặt ${res.total} lịch quét quảng cáo`
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Không thể đặt lịch quét");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSchedule = async (id: string) => {
    setCancellingId(id);
    try {
      await searchAdsService.cancelSchedule(id);
      setSchedules((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: "cancelled" } : item))
      );
      toast.success("Đã hủy lịch quét");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Không thể hủy lịch quét");
    } finally {
      setCancellingId(null);
    }
  };

  const handleViewResult = async (searchId: string) => {
    if (resultById.has(searchId)) {
      setSelectedResultId(searchId);
      return;
    }

    const items = await fetchScheduledResults();
    if (items.some((item) => item.id === searchId)) {
      setSelectedResultId(searchId);
      return;
    }
    toast.error("Chưa tải được kết quả của lịch này");
  };

  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-[#059669]/10 text-[#059669]">
                <CalendarClock size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Cấu hình lịch quét</h2>
                <p className="text-xs text-muted-foreground">
                  Chọn từ khóa, proxy và các mốc thời gian để hệ thống tự chạy nền.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Từ khóa cần quét</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="Ví dụ: xm trading, adidas, máy lọc nước..."
                  className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Vị trí</label>
                <select value={location} onChange={(event) => setLocation(event.target.value)} className={selectClass}>
                  {LOCATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Ngôn ngữ</label>
                <select value={language} onChange={(event) => setLanguage(event.target.value)} className={selectClass}>
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Thiết bị</label>
                <select value={device} onChange={(event) => setDevice(event.target.value)} className={selectClass}>
                  {DEVICE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <label className="flex cursor-pointer select-none items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setUseProxy((value) => !value)}
                    className={cn(
                      "relative h-5 w-9 rounded-full transition-colors",
                      useProxy ? "bg-[#059669]" : "bg-border"
                    )}
                    aria-pressed={useProxy}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                        useProxy ? "translate-x-4" : "translate-x-0.5"
                      )}
                    />
                  </button>
                  <span className="text-sm font-medium">Dùng proxy khi quét</span>
                </label>
                <Link
                  href="/dashboard?tab=proxy"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-[#059669] hover:underline"
                >
                  <Server size={12} /> Quản lý proxy
                </Link>
              </div>

              {useProxy && (
                <div className="mt-3 space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Proxy sử dụng</label>
                  {proxiesLoading ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                      <Loader2 size={13} className="animate-spin" /> Đang tải proxy...
                    </div>
                  ) : proxies.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Chưa có proxy.{" "}
                      <Link href="/dashboard?tab=proxy" className="font-medium text-[#059669] hover:underline">
                        Thêm proxy mới
                      </Link>
                    </p>
                  ) : (
                    <select
                      value={selectedProxyId}
                      onChange={(event) => setSelectedProxyId(event.target.value)}
                      className={selectClass}
                    >
                      <option value="">-- Chọn proxy --</option>
                      {proxies.map((proxy) => (
                        <option key={proxy.id} value={proxy.id}>
                          [{proxy.protocol.toUpperCase()}] {proxy.name} - {proxy.host}:{proxy.port}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">
                  {scheduleMode === "daily" ? "Giờ chạy hằng ngày" : "Mốc thời gian chạy"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {scheduleMode === "daily"
                    ? "Chọn giờ trong ngày, hệ thống sẽ tự tạo lần chạy kế tiếp."
                    : "Có thể đặt nhiều mốc cho cùng một từ khóa."}
                </p>
              </div>
              <button
                type="button"
                onClick={scheduleMode === "daily" ? addDailyTime : addScheduleTime}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
              >
                <Plus size={13} /> {scheduleMode === "daily" ? "Thêm giờ" : "Thêm mốc"}
              </button>
            </div>
          </div>

          <div className="space-y-3 p-5">
            <div className="inline-flex w-full rounded-lg border border-border bg-background p-1">
              {([
                ["once", "Một lần", CalendarClock],
                ["daily", "Hằng ngày", CalendarDays],
              ] as const).map(([mode, label, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setScheduleMode(mode)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                    scheduleMode === mode
                      ? "bg-[#059669] text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>

            {scheduleMode === "once" ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => addQuickTime(1)} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">
                    Sau 1 giờ
                  </button>
                  <button type="button" onClick={() => addQuickTime(6)} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">
                    Sau 6 giờ
                  </button>
                  <button type="button" onClick={() => addQuickTime(24)} className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">
                    Ngày mai
                  </button>
                </div>

                {scheduleTimes.map((time, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      value={time}
                      onChange={(event) => updateScheduleTime(index, event.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30"
                    />
                    <button
                      type="button"
                      onClick={() => removeScheduleTime(index)}
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Xóa mốc"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {["09:00", "13:30", "18:00"].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => addQuickDailyTime(value)}
                      className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted"
                    >
                      {value}
                    </button>
                  ))}
                </div>

                {dailyTimes.map((time, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={time}
                      onChange={(event) => updateDailyTime(index, event.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30"
                    />
                    <button
                      type="button"
                      onClick={() => removeDailyTime(index)}
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Xóa giờ"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                <div className="rounded-lg border border-border bg-muted/20 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <Bell size={14} className="text-[#059669]" />
                        Nhận thông báo Telegram
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Gửi khi advertiser top 1 đổi so với lần quét trước của cùng lịch.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => telegramLinked && setNotifyTelegramOnChange((value) => !value)}
                      disabled={!telegramLinked}
                      className={cn(
                        "relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50",
                        notifyTelegramOnChange && telegramLinked ? "bg-[#059669]" : "bg-border"
                      )}
                      aria-pressed={notifyTelegramOnChange && telegramLinked}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                          notifyTelegramOnChange && telegramLinked ? "translate-x-4" : "translate-x-0.5"
                        )}
                      />
                    </button>
                  </div>
                  {!telegramLinked && (
                    <Link
                      href="/dashboard?tab=telegram"
                      className="mt-2 inline-flex text-xs font-medium text-[#059669] hover:underline"
                    >
                      Liên kết Telegram để bật thông báo
                    </Link>
                  )}
                </div>
              </>
            )}

            <button
              type="button"
              onClick={handleCreateSchedules}
              disabled={submitting || !keyword.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#059669] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#059669]/25 hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? (
                <><Loader2 size={15} className="animate-spin" /> Đang đặt lịch...</>
              ) : (
                <><CalendarClock size={15} /> Đặt lịch quét quảng cáo</>
              )}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Lịch quét đã đặt</h2>
            <p className="text-xs text-muted-foreground">
              {upcomingSchedules} lịch đang chờ hoặc đang chạy trong {scheduleGroups.length}{" "}
              {scheduleView === "history" ? "lần đặt lịch" : "từ khóa"}.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="inline-flex rounded-lg border border-border bg-background p-1">
              {([
                ["history", "Theo lịch sử đặt"],
                ["keyword", "Theo từ khóa"],
              ] as const).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setScheduleView(view)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    scheduleView === view
                      ? "bg-[#059669] text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={refreshScheduleData}
              disabled={schedulesLoading || resultsLoading}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw size={13} className={schedulesLoading || resultsLoading ? "animate-spin" : ""} />
              Làm mới
            </button>
          </div>
        </div>

        {schedulesLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 size={18} className="animate-spin text-[#059669]" />
            Đang tải lịch quét...
          </div>
        ) : schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-[#059669]/10 ring-8 ring-[#059669]/5">
              <CalendarClock size={28} className="text-[#059669]/70" />
            </div>
            <p className="text-sm font-semibold">Chưa có lịch quét nào</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Tạo lịch ở form phía trên để hệ thống tự quét quảng cáo Google Ads theo đúng thời điểm đã chọn.
            </p>
          </div>
        ) : (
          <div>
            {scheduleGroups.map((group) => (
              <ScheduleGroupAccordion
                key={`${scheduleView}-${group.id}`}
                group={group}
                defaultOpen={false}
                cancellingId={cancellingId}
                resultById={resultById}
                onCancel={handleCancelSchedule}
                onViewResult={handleViewResult}
              />
            ))}
          </div>
        )}
      </section>

      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Kết quả quét từ lịch</h2>
                <p className="text-xs text-muted-foreground">
                  Kết quả này cũng được lưu trong màn Đối thủ (Google Ads) với nhãn Theo lịch.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedResultId(null)}
                className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Đóng"
              >
                <XCircle size={16} />
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              <ScheduledResultDetail item={selectedResult} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
