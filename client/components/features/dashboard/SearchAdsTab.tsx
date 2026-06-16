"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe,
  Layers3,
  Link2,
  Loader2,
  MapPin,
  MonitorPlay,
  Monitor,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserPlus,
  Video,
  VideoOff,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/constants/config";
import { affiliateProjectService } from "@/services/affiliateProject.service";
import { searchAdsService } from "@/services/searchAds.service";
import { proxyService } from "@/services/proxy.service";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type {
  SearchAdItem,
  SearchAdsHistoryItem,
  OrganicLinkItem,
} from "@/types/searchAds.types";
import type { AffiliateLinkModel } from "@/types/affiliateProject.types";
import type { ProxyResponse } from "@/types/proxy.types";

// Constants

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
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
];

type HistorySourceFilter = "all" | "scheduled" | "manual";

const HISTORY_SOURCE_FILTERS: { value: HistorySourceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "scheduled", label: "Theo lịch" },
  { value: "manual", label: "Tự quét" },
];

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
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

function errorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (err as { response?: { status?: number; data?: { detail?: string } } }).response;
    if (response?.status === 409) return "Đối thủ này đã tồn tại trong cùng từ khóa";
    if (response?.data?.detail) return response.data.detail;
  }
  return err instanceof Error ? err.message : fallback;
}

function competitorAddKey(searchId: string, ad: SearchAdItem) {
  return [searchId, ad.id ?? ad.position, ad.advertiserName ?? ad.advertiserDomain ?? ""].join("|");
}

// Sub-components

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        pct >= 90
          ? "bg-[#059669]/10 text-[#059669]"
          : "bg-amber-500/10 text-amber-700"
      )}
    >
      {pct}%
    </span>
  );
}

function OrganicLinks({ links }: { links: OrganicLinkItem[] }) {
  if (!links.length) return null;
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Link2 size={12} />Kết quả tự nhiên ({links.length})
      </p>
      <div className="space-y-1">
        {links.map((l, i) => (
          <a
            key={i}
            href={l.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 text-xs hover:text-[#059669] group"
          >
            <span className="truncate text-foreground group-hover:underline">{l.title || l.url}</span>
            <ExternalLink size={10} className="shrink-0 text-muted-foreground" />
          </a>
        ))}
      </div>
    </div>
  );
}

function AdCard({
  ad,
  keyword,
  searchId,
  adding,
  onAddCompetitor,
}: {
  ad: SearchAdItem;
  keyword: string;
  searchId: string;
  adding: boolean;
  onAddCompetitor: (keyword: string, searchId: string, ad: SearchAdItem) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      <div className="flex items-start gap-3 p-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#059669]/10 text-xs font-bold text-[#059669]">
          {ad.position}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">
            {ad.title || "Không có tiêu đề"}
          </p>
          {ad.snippet && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{ad.snippet}</p>
          )}
          {ad.displayUrl && (
            <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{ad.displayUrl}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ConfidenceBadge value={ad.confidence} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onAddCompetitor(keyword, searchId, ad)}
            disabled={adding || !(ad.advertiserName || ad.advertiserDomain)}
            className="border border-[#059669]/30 bg-[#059669]/10 px-2.5 text-xs text-[#047857] hover:bg-[#059669]/15"
            title="Thêm vào Đối thủ của tôi"
          >
            {adding ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
            Thêm
          </Button>
        </div>
      </div>

      {/* Advertiser info row */}
      {(ad.advertiserName || ad.advertiserDomain || ad.advertiserLocation) && (
        <div className="border-t border-border bg-muted/30 px-3 py-2 space-y-1 text-xs">
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

      {/* Landing page info row */}
      {ad.landingPage && (
        <div className="border-t border-border bg-muted/10 px-3 py-2 text-xs space-y-1.5">
          <p className="flex items-center gap-1.5 font-semibold text-muted-foreground">
            <Link2 size={11} />Landing Page
          </p>
          {ad.landingPage.originalUrl && (
            <div className="flex items-start gap-1.5">
              <span className="shrink-0 text-muted-foreground w-20">Original URL:</span>
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
              <span className="shrink-0 text-muted-foreground w-20">Final URL:</span>
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
              <span className="shrink-0 text-muted-foreground w-20">Domain:</span>
              <span className="font-medium">{ad.landingPage.domain}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-muted-foreground w-20">Status:</span>
            <span className={cn("font-medium", ad.landingPage.status === "success" ? "text-[#059669]" : "text-destructive")}>
              {ad.landingPage.status}
            </span>
            {ad.landingPage.finalStatusCode && (
              <span className="text-muted-foreground">({ad.landingPage.finalStatusCode})</span>
            )}
          </div>
          {(ad.landingPage.redirectChain?.length ?? 0) > 0 && (
            <div className="flex items-start gap-1.5">
              <span className="shrink-0 text-muted-foreground w-20">Redirects:</span>
              <div className="space-y-0.5">
                {ad.landingPage.redirectChain.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-all text-muted-foreground hover:text-[#059669] hover:underline"
                  >
                    {i + 1}. {url}
                  </a>
                ))}
              </div>
            </div>
          )}
          {ad.landingPage.error && (
            <div className="flex items-start gap-1.5">
              <span className="shrink-0 text-muted-foreground w-20">Error:</span>
              <p className="text-destructive break-all">{ad.landingPage.error}</p>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-border px-3 py-2 flex items-center gap-3">
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

function SearchVideoPanel({
  item,
  onDeleteVideo,
}: {
  item: SearchAdsHistoryItem;
  onDeleteVideo: (id: string) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const url = mediaUrl(item.videoUrl);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDeleteVideo(item.id);
      toast.success("Đã xoá video");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Không xoá được video");
    } finally {
      setDeleting(false);
    }
  };

  if (item.videoStatus === "deleted") {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <VideoOff size={13} />Video ghi lại lần search này đã được xoá.
        </span>
      </div>
    );
  }

  if (!url || item.videoStatus !== "available" || videoError) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5">
            <VideoOff size={13} />
            {videoError ? "Video ghi lại bị lỗi hoặc không đọc được." : "Không có video ghi lại cho lần search này."}
          </span>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-[#059669] hover:underline"
            >
              Mở trực tiếp <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Video size={13} />Video quá trình search
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
          className="border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          Xoá video
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ExternalLink size={12} />
          Mở
        </a>
      </div>
      <video
        src={url}
        controls
        preload="metadata"
        onError={() => setVideoError(true)}
        className="aspect-video w-full rounded-lg border border-border bg-black"
      />
    </div>
  );
}

function DeleteButton({
  item,
  onDeleteSearch,
}: {
  item: SearchAdsHistoryItem;
  onDeleteSearch: (id: string) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onDeleteSearch(item.id);
      }}
      className="border border-border text-destructive hover:bg-destructive/10 hover:text-destructive"
      title="Xoá lần search này"
    >
      <Trash2 size={14} />
      Xoá
    </Button>
  );
}

function HistoryCard({
  item,
  onDeleteVideo,
  onDeleteSearch,
  addingCompetitorKey,
  onAddCompetitor,
}: {
  item: SearchAdsHistoryItem;
  onDeleteVideo: (id: string) => Promise<void>;
  onDeleteSearch: (id: string) => void;
  addingCompetitorKey: string | null;
  onAddCompetitor: (keyword: string, searchId: string, ad: SearchAdItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const isScheduled = item.source === "scheduled" || item.isScheduled;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-3 text-left transition-colors hover:bg-muted/50"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#059669]/10">
            <MonitorPlay size={15} className="text-[#059669]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold">{item.keyword}</p>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  isScheduled
                    ? "bg-[#0f766e]/10 text-[#0f766e]"
                    : "bg-slate-500/10 text-slate-600"
                )}
              >
                {isScheduled ? <CalendarClock size={11} /> : <Search size={11} />}
                {isScheduled ? "Theo lịch" : "Tự quét"}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  item.projectId ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
                )}
              >
                <Link2 size={11} />
                {item.projectId ? `Dự án: ${item.projectName || "Project"}` : "Riêng lẻ"}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><MapPin size={10} />{item.location}</span>
              <span className="inline-flex items-center gap-1">
                {item.device === "mobile" ? <Smartphone size={10} /> : <Monitor size={10} />}{item.device}
              </span>
              <span className="inline-flex items-center gap-1"><Globe size={10} />{item.language}</span>
              {item.proxyName && (
                <span className="inline-flex items-center gap-1"><Server size={10} />{item.proxyName}</span>
              )}
              <span>{formatDateTime(item.createdAt)}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold">{item.totalAdsFound} ads</p>
            <span className={cn("text-[11px]", item.status === "done" ? "text-[#059669]" : "text-destructive")}>
              {item.status}
            </span>
          </div>
          {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </button>
        <DeleteButton item={item} onDeleteSearch={onDeleteSearch} />
      </div>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {item.finalSummary && (
            <p className="text-xs text-muted-foreground italic">{item.finalSummary}</p>
          )}

          <SearchVideoPanel item={item} onDeleteVideo={onDeleteVideo} />

          {item.errors.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive space-y-0.5">
              {item.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}

          {item.ads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              Không có ads trong lần search này.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {item.ads.map((ad, i) => (
                <AdCard
                  key={`${item.id}-${i}`}
                  ad={ad}
                  keyword={item.keyword}
                  searchId={item.id}
                  adding={addingCompetitorKey === competitorAddKey(item.id, ad)}
                  onAddCompetitor={onAddCompetitor}
                />
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
              <Search size={11} />Xem trang tìm kiếm gốc <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

interface KeywordGroup {
  keyword: string;
  searches: SearchAdsHistoryItem[];
  totalAdsFound: number;
  latestAt: string;
}

function KeywordGroupCard({
  group,
  onDeleteVideo,
  onDeleteSearch,
  addingCompetitorKey,
  onAddCompetitor,
}: {
  group: KeywordGroup;
  onDeleteVideo: (id: string) => Promise<void>;
  onDeleteSearch: (id: string) => void;
  addingCompetitorKey: string | null;
  onAddCompetitor: (keyword: string, searchId: string, ad: SearchAdItem) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#059669]/10 text-[#059669]">
          <Layers3 size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{group.keyword}</p>
          <div className="mt-0.5 flex gap-x-3 gap-y-1 flex-wrap text-[11px] text-muted-foreground">
            <span>{group.searches.length} lần search</span>
            <span>{group.totalAdsFound} ads cộng dồn</span>
            <span>{formatDateTime(group.latestAt)}</span>
          </div>
        </div>
        {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-3">
          {group.searches.map((s) => (
            <HistoryCard
              key={s.id}
              item={s}
              onDeleteVideo={onDeleteVideo}
              onDeleteSearch={onDeleteSearch}
              addingCompetitorKey={addingCompetitorKey}
              onAddCompetitor={onAddCompetitor}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyHistoryState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-[#059669]/10 ring-8 ring-[#059669]/5">
        <MonitorPlay size={28} className="text-[#059669]/70" />
      </div>
      <p className="text-sm font-medium text-foreground">Chưa có lịch sử tìm kiếm</p>
      <p className="text-xs text-muted-foreground max-w-xs">
        Nhập từ khóa ở form trên và nhấn &quot;Tìm quảng cáo&quot; để bắt đầu.
      </p>
    </div>
  );
}

export function SearchAdsTab() {
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("Vietnam");
  const [language, setLanguage] = useState("vi");
  const [device, setDevice] = useState("desktop");
  const [useProxy, setUseProxy] = useState(false);
  const [selectedProxyId, setSelectedProxyId] = useState("");
  const [projects, setProjects] = useState<AffiliateLinkModel[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [proxies, setProxies] = useState<ProxyResponse[]>([]);
  const [proxiesLoading, setProxiesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [history, setHistory] = useState<SearchAdsHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [view, setView] = useState<"history" | "keyword">("history");
  const [historySource, setHistorySource] = useState<HistorySourceFilter>("all");
  const [addingCompetitorKey, setAddingCompetitorKey] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const hasFetchedProxies = useRef(false);

  const keywordGroups = history.reduce<KeywordGroup[]>((acc, item) => {
    const existing = acc.find((g) => g.keyword.toLowerCase() === item.keyword.toLowerCase());
    if (existing) {
      existing.searches.push(item);
      existing.totalAdsFound += item.totalAdsFound;
      if (item.createdAt > existing.latestAt) existing.latestAt = item.createdAt;
    } else {
      acc.push({ keyword: item.keyword, searches: [item], totalAdsFound: item.totalAdsFound, latestAt: item.createdAt });
    }
    return acc;
  }, []);

  const selectedProject = projects.find((project) => project.id === selectedProjectId);

  function applySelectedProject() {
    if (!selectedProject) return;
    setKeyword(selectedProject.search_query || selectedProject.name || selectedProject.domain);
  }

  async function fetchHistory(source = historySource) {
    setHistoryLoading(true);
    try {
      const res = await searchAdsService.getHistory(source);
      setHistory(res.items);
    } catch {
      toast.error("Không tải được lịch sử");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleDeleteVideo(id: string) {
    await searchAdsService.deleteVideo(id);
    setHistory((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, videoUrl: null, videoStatus: "deleted" }
          : item
      )
    );
  }

  const openDeleteDialog = (id: string) => {
    setDeleteTargetId(id);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeleteTargetId(null);
  };

  async function deleteSearch(id: string) {
    try {
      await searchAdsService.deleteHistory(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
      toast.success("Đã xoá lịch sử tìm kiếm");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Không thể xoá lịch sử tìm kiếm");
    }
  }

  const confirmDeleteSearch = async () => {
    if (!deleteTargetId) {
      return;
    }
    await deleteSearch(deleteTargetId);
    closeDeleteDialog();
  };

  async function handleAddCompetitor(keyword: string, searchId: string, ad: SearchAdItem) {
    const key = competitorAddKey(searchId, ad);
    setAddingCompetitorKey(key);
    try {
      await searchAdsService.addCompetitor({
        keyword,
        sourceSearchId: searchId,
        sourceAdId: ad.id ?? null,
        position: ad.position,
        title: ad.title,
        snippet: ad.snippet,
        displayUrl: ad.displayUrl,
        targetUrl: ad.targetUrl,
        advertiserName: ad.advertiserName,
        advertiserDomain: ad.advertiserDomain,
        advertiserLocation: ad.advertiserLocation,
        confidence: ad.confidence,
        landingPage: ad.landingPage ?? null,
      });
      toast.success("Đã thêm vào Đối thủ của tôi");
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Không thể thêm đối thủ"));
    } finally {
      setAddingCompetitorKey(null);
    }
  }

  useEffect(() => {
    let ignore = false;
    Promise.resolve()
      .then(() => searchAdsService.getHistory(historySource))
      .then((res) => {
        if (!ignore) setHistory(res.items);
      })
      .catch(() => {
        if (!ignore) toast.error("Không tải được lịch sử");
      })
      .finally(() => {
        if (!ignore) setHistoryLoading(false);
      });
    affiliateProjectService
      .getAffiliateLinks()
      .then((items) => {
        if (!ignore) setProjects(items);
      })
      .catch(() => {
        if (!ignore) toast.error("Không tải được danh sách dự án");
      });
    return () => {
      ignore = true;
    };
  }, [historySource]);

  // Load proxies lazily when user toggles proxy on for the first time
  useEffect(() => {
    if (useProxy && !hasFetchedProxies.current) {
      hasFetchedProxies.current = true;
      setProxiesLoading(true);
      proxyService
        .list()
        .then((r) => setProxies(r.items))
        .catch(() => toast.error("Không tải được danh sách proxy"))
        .finally(() => setProxiesLoading(false));
    }
  }, [useProxy]);

  const handleSearch = async () => {
    if (!keyword.trim()) {
      toast.error("Vui lòng nhập từ khóa");
      return;
    }
    if (useProxy && !selectedProxyId) {
      toast.error("Vui lòng chọn proxy hoặc tắt tùy chọn dùng proxy");
      return;
    }
    setSubmitting(true);
    try {
      const data = await searchAdsService.run({
        keyword: keyword.trim(),
        location,
        language,
        device,
        noProxy: !useProxy,
        headful: false,
        proxyId: useProxy ? selectedProxyId : null,
        projectId: selectedProjectId || null,
      });
      if (data.status === "failed") {
        toast.error(data.errors[0] || "Tìm kiếm thất bại");
      } else if (data.totalAdsFound === 0) {
        toast.info("Không tìm thấy quảng cáo nào");
      } else {
        toast.success(`Tìm thấy ${data.totalAdsFound} quảng cáo`);
      }
      const proxyNameUsed = useProxy
        ? proxies.find((p) => p.id === selectedProxyId)?.name ?? null
        : null;
      const newItem: SearchAdsHistoryItem = {
        id: data.id ?? crypto.randomUUID(),
        keyword: data.keyword,
        location,
        language,
        device,
        searchUrl: data.searchUrl,
        status: data.status,
        totalAdsFound: data.totalAdsFound,
        errors: data.errors,
        ads: data.ads,
        organicLinks: data.organicLinks ?? [],
        finalSummary: data.finalSummary ?? null,
        proxyName: proxyNameUsed,
        projectId: data.projectId ?? (selectedProjectId || null),
        projectName: data.projectName ?? selectedProject?.name ?? selectedProject?.domain ?? null,
        videoUrl: data.videoUrl ?? null,
        videoStatus: data.videoStatus ?? "none",
        isScheduled: false,
        source: "manual",
        createdAt: new Date().toISOString(),
      };
      if (historySource !== "scheduled") {
        setHistory((prev) => [newItem, ...prev]);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setSubmitting(false);
    }
  };

  const selectClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30 disabled:opacity-50";
  const projectSearches = history.filter((item) => item.projectId).length;
  const standaloneSearches = history.length - projectSearches;

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Search form */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <MonitorPlay size={17} className="text-[#059669]" />
          <h2 className="text-sm font-semibold">Tìm nhà quảng cáo Google Ads</h2>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Nhập từ khóa (vd: xm trading, adidas...)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !submitting && handleSearch()}
            disabled={submitting}
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#059669]/30 disabled:opacity-50"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            disabled={submitting}
            className={selectClass}
          >
            <option value="">Chọn dự án để tìm theo project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name || project.domain} - {project.search_query || project.domain}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant={selectedProjectId ? "sage" : "secondary"}
            onClick={applySelectedProject}
            disabled={submitting || !selectedProject}
            className="h-10"
          >
            <Link2 size={14} /> Dùng search dự án
          </Button>
          <Button
            type="button"
            variant={!selectedProjectId ? "sage" : "ghost"}
            onClick={() => setSelectedProjectId("")}
            disabled={submitting}
            className={cn("h-10 border", selectedProjectId ? "border-border" : "border-[#059669]")}
          >
            Riêng lẻ
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Vị trí", value: location, setter: setLocation, options: LOCATION_OPTIONS },
            { label: "Ngôn ngữ", value: language, setter: setLanguage, options: LANGUAGE_OPTIONS },
            { label: "Thiết bị", value: device, setter: setDevice, options: DEVICE_OPTIONS },
          ].map(({ label, value, setter, options }) => (
            <div key={label} className="space-y-1">
              <label className="text-xs text-muted-foreground">{label}</label>
              <select value={value} onChange={(e) => setter(e.target.value)} disabled={submitting} className={selectClass}>
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* Proxy selector */}
        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <label
              className="flex cursor-pointer select-none items-center gap-2.5"
              onClick={() => setUseProxy((v) => !v)}
            >
              <div
                className={cn(
                  "relative h-5 w-9 rounded-full transition-colors",
                  useProxy ? "bg-[#059669]" : "bg-border"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                    useProxy ? "translate-x-4" : "translate-x-0.5"
                  )}
                />
              </div>
              <span className="text-sm">Dùng proxy</span>
            </label>
            <Link
              href="/dashboard?tab=proxy"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-[#059669] hover:underline"
            >
              <Server size={11} />Quản lý proxy
            </Link>
          </div>

          {useProxy && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Chọn proxy</label>
              {proxiesLoading ? (
                <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                  <Loader2 size={12} className="animate-spin" />Đang tải...
                </div>
              ) : proxies.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">
                  Chưa có proxy.{" "}
                  <Link href="/dashboard?tab=proxy" className="text-[#059669] hover:underline">
                    Thêm proxy tại đây
                  </Link>
                </p>
              ) : (
                <select
                  value={selectedProxyId}
                  onChange={(e) => setSelectedProxyId(e.target.value)}
                  disabled={submitting}
                  className={selectClass}
                >
                  <option value="">-- Chọn proxy --</option>
                  {proxies.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.protocol.toUpperCase()}] {p.name} - {p.host}:{p.port}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        <Button
          variant="sage"
          size="lg"
          onClick={handleSearch}
          disabled={submitting || !keyword.trim()}
          className="w-full"
        >
          {submitting ? (
            <><Loader2 size={14} className="animate-spin" />Đang tìm kiếm... (có thể mất 30-60 giây)</>
          ) : (
            <><Search size={14} />Tìm quảng cáo</>
          )}
        </Button>
        {submitting && (
          <p className="text-center text-xs text-muted-foreground">
            Đang mở Google Chrome, click từng quảng cáo để lấy thông tin nhà quảng cáo...
          </p>
        )}
      </div>

      {/* History section */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Lần quét", value: history.length, icon: Search },
          { label: "Ads", value: history.reduce((sum, item) => sum + item.totalAdsFound, 0), icon: MonitorPlay },
          { label: "Theo dự án", value: projectSearches, icon: Link2 },
          { label: "Riêng lẻ", value: standaloneSearches, icon: Layers3 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#059669]/10">
              <Icon size={15} className="text-[#059669]" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none">{value}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
            {(["history", "keyword"] as const).map((v) => (
              <Button
                key={v}
                type="button"
                size="sm"
                variant={view === v ? "sage" : "ghost"}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-lg text-xs font-medium transition-all",
                  view === v ? "shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v === "history" ? "Theo lịch sử" : "Gom theo keyword"}
              </Button>
            ))}
          </div>
          <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
            {HISTORY_SOURCE_FILTERS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={historySource === option.value ? "sage" : "ghost"}
                onClick={() => {
                  if (historySource === option.value) return;
                  setHistoryLoading(true);
                  setHistorySource(option.value);
                }}
                className={cn(
                  "rounded-lg text-xs font-medium transition-all",
                  historySource === option.value ? "shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fetchHistory()}
          disabled={historyLoading}
          className="border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <RefreshCw size={12} className={historyLoading ? "animate-spin" : ""} />
          Làm mới
        </Button>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => { if (!open) closeDeleteDialog(); setIsDeleteDialogOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xoá</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này sẽ xoá lần tìm kiếm và không thể khôi phục.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary">Huỷ</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" onClick={confirmDeleteSearch}>
                Xoá
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {historyLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 size={28} className="animate-spin text-[#059669]" />
          <p className="text-sm text-muted-foreground">Đang tải lịch sử...</p>
        </div>
      ) : history.length === 0 ? (
        <EmptyHistoryState />
      ) : view === "history" ? (
        <div className="space-y-2">
          {history.map((item) => (
            <HistoryCard
              key={item.id}
              item={item}
              onDeleteVideo={handleDeleteVideo}
              onDeleteSearch={openDeleteDialog}
              addingCompetitorKey={addingCompetitorKey}
              onAddCompetitor={handleAddCompetitor}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {keywordGroups.map((group) => (
            <KeywordGroupCard
              key={group.keyword.toLowerCase()}
              group={group}
              onDeleteVideo={handleDeleteVideo}
              onDeleteSearch={openDeleteDialog}
              addingCompetitorKey={addingCompetitorKey}
              onAddCompetitor={handleAddCompetitor}
            />
          ))}
        </div>
      )}
    </div>
  );
}
