"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  ScanLine,
  History,
  Users,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Image as ImageIcon,
  FileText,
  Video,
  Loader2,
  Info,
  CalendarDays,
  Tag,
  X,
  RefreshCw,
} from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import "react-day-picker/style.css";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { adsTransparentService } from "@/services/adsTransparent.service";
import type {
  AdsTransparencySearchRequest,
  AdCreativeHistoryItem,
  AdSearchHistoryItem,
  CompetitorGroup,
} from "@/types/adsTransparent.types";

// ─── helpers ────────────────────────────────────────────────────────────────

const PLATFORM_OPTIONS = [
  { value: "", label: "Tất cả nền tảng" },
  { value: "SEARCH", label: "Google Search" },
  { value: "YOUTUBE", label: "YouTube" },
  { value: "SHOPPING", label: "Shopping" },
  { value: "PLAY", label: "Google Play" },
  { value: "MAPS", label: "Google Maps" },
];

const FORMAT_OPTIONS = [
  { value: "", label: "Tất cả định dạng" },
  { value: "TEXT", label: "Text" },
  { value: "IMAGE", label: "Image" },
  { value: "VIDEO", label: "Video" },
];

const REGION_OPTIONS = [
  { value: "", label: "Toàn cầu" },
  { value: "2704", label: "Việt Nam" },
  { value: "2840", label: "Hoa Kỳ" },
  { value: "2826", label: "Anh" },
  { value: "2036", label: "Úc" },
  { value: "2124", label: "Canada" },
  { value: "2276", label: "Đức" },
  { value: "2392", label: "Nhật Bản" },
];

const DATE_PICKER_START_MONTH = new Date(new Date().getFullYear() - 15, 0, 1);
const DATE_PICKER_END_MONTH = new Date(new Date().getFullYear() + 1, 11, 31);

function formatEpochDay(epoch?: number): string {
  if (epoch == null || Number.isNaN(epoch)) return "—";

  // SerpAPI can return either epoch day, epoch seconds, or epoch milliseconds.
  const abs = Math.abs(epoch);
  const ms = abs < 100_000 ? epoch * 86400000 : abs < 1_000_000_000_000 ? epoch * 1000 : epoch;
  const parsed = new Date(ms);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseDateInput(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toInputDate(value?: Date): string | undefined {
  if (!value) return undefined;
  return format(value, "yyyy-MM-dd");
}

const FORMAT_ICON: Record<string, React.ElementType> = {
  TEXT: FileText,
  IMAGE: ImageIcon,
  VIDEO: Video,
};

function FormatBadge({ format }: { format: string }) {
  const Icon = FORMAT_ICON[format?.toUpperCase()] ?? Tag;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <Icon size={10} />
      {format}
    </span>
  );
}

type DetailAction = "scan" | "view";

// ─── Creative card ────────────────────────────────────────────────────────────

function CreativeCard({
  creative,
  onScanDetail,
  extraDetailCount = 0,
}: {
  creative: AdCreativeHistoryItem;
  onScanDetail: (c: AdCreativeHistoryItem, action: DetailAction) => void;
  extraDetailCount?: number;
}) {
  const hasDetail = creative.details.length > 0 || extraDetailCount > 0;
  const [imageError, setImageError] = useState(false);
  const imageSrc = creative.image?.trim();
  const showImage = Boolean(imageSrc) && !imageError;

  return (
    <div className="group relative rounded-xl border border-border bg-card p-4 hover:border-[#059669]/40 hover:shadow-sm transition-all">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt="Ad creative"
          className="mb-3 h-32 w-full rounded-lg object-cover bg-muted"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="mb-3 flex h-20 flex-col items-center justify-center rounded-lg bg-muted gap-1">
          <ImageIcon size={24} className="text-muted-foreground/40" />
          <span className="text-[10px] text-muted-foreground">
            {imageSrc ? "Không tải được ảnh" : "Không có ảnh"}
          </span>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight line-clamp-2">
            {creative.advertiser}
          </p>
          <FormatBadge format={creative.format} />
        </div>

        <p className="text-[11px] font-mono text-muted-foreground truncate">Advertiser ID: {creative.advertiserId}</p>
        <p className="text-[11px] font-mono text-muted-foreground truncate">Creative ID: {creative.adCreativeId}</p>

        {creative.targetDomain && (
          <p className="text-xs text-muted-foreground truncate">
            🌐 {creative.targetDomain}
          </p>
        )}

        <div className="grid grid-cols-2 gap-x-2 gap-y-1 rounded-lg bg-muted/40 p-2 text-[11px] text-muted-foreground">
          <span>Kích thước: {creative.width && creative.height ? `${creative.width}x${creative.height}` : "—"}</span>
          {creative.totalDaysShown != null && (
            <span>{creative.totalDaysShown} ngày hiển thị</span>
          )}
          <span>Đầu: {formatEpochDay(creative.firstShown)}</span>
          {creative.lastShown != null && (
            <span>Cuối: {formatEpochDay(creative.lastShown)}</span>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => onScanDetail(creative, "scan")}
          className="flex-1 rounded-lg bg-[#059669] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#047857] transition-colors"
        >
          Quét chi tiết
        </button>
        {hasDetail ? (
          <button
            onClick={() => onScanDetail(creative, "view")}
            className="flex-1 rounded-lg bg-[#059669]/10 px-3 py-1.5 text-xs font-medium text-[#059669] hover:bg-[#059669]/20 transition-colors"
          >
            {`Xem chi tiết (${creative.details.length + extraDetailCount})`}
          </button>
        ) : (
          <span className="flex-1 rounded-lg border border-border px-3 py-1.5 text-center text-xs text-muted-foreground">
            Chưa có chi tiết
          </span>
        )}
        {creative.link && (
          <a
            href={creative.link}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  );
}

// ─── History row ─────────────────────────────────────────────────────────────

function HistoryRow({
  item,
  onScanDetail,
  scannedCounts,
}: {
  item: AdSearchHistoryItem;
  onScanDetail: (c: AdCreativeHistoryItem, action: DetailAction) => void;
  scannedCounts: Map<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const totalCreatives = item.creatives.length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#059669]/10">
          <Search size={14} className="text-[#059669]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {item.text ?? item.advertiserIdQuery ?? "(không có từ khóa)"}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-0 mt-0.5 text-[11px] text-muted-foreground">
            {item.platform && <span>{item.platform}</span>}
            {item.creativeFormat && <span>{item.creativeFormat}</span>}
            {item.region && (
              <span>{REGION_OPTIONS.find((r) => r.value === item.region)?.label ?? item.region}</span>
            )}
            <span>{formatDate(item.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {totalCreatives} ads
          </span>
          {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          {totalCreatives === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">Không có creative nào trong lần quét này.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {item.creatives.map((c) => (
                <CreativeCard key={c.id} creative={c} onScanDetail={onScanDetail} extraDetailCount={scannedCounts.get(c.id) ?? 0} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Competitor group card ────────────────────────────────────────────────────

function CompetitorGroupCard({
  group,
  onScanDetail,
  scannedCounts,
}: {
  group: CompetitorGroup;
  onScanDetail: (c: AdCreativeHistoryItem, action: DetailAction) => void;
  scannedCounts: Map<string, number>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#059669]/20 to-[#059669]/5 text-[#059669] font-bold text-sm">
          {group.advertiser.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{group.advertiser}</p>
          <p className="text-[11px] text-muted-foreground truncate">{group.advertiserId}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full bg-[#059669]/10 px-2.5 py-0.5 text-xs font-semibold text-[#059669]">
            {group.creatives.length} ads
          </span>
          {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {group.creatives.map((c) => (
              <CreativeCard key={c.id} creative={c} onScanDetail={onScanDetail} extraDetailCount={scannedCounts.get(c.id) ?? 0} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

function DetailDrawer({
  creative,
  mode,
  onClose,
  onScanned,
}: {
  creative: AdCreativeHistoryItem | null;
  mode: DetailAction;
  onClose: () => void;
  onScanned?: (creativeId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [imageError, setImageError] = useState(false);
  const handleScanned = useCallback(
    (creativeId: string) => onScanned?.(creativeId),
    [onScanned]
  );

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(() => {
      if (!active) return;

      if (!creative) {
        setDetail(null);
        return;
      }

      setImageError(false);

      if (mode === "view") {
        setLoading(false);
        const latestDetail = creative.details[0];
        setDetail(latestDetail ? (latestDetail as unknown as Record<string, unknown>) : null);
        return;
      }

      setLoading(true);
      setDetail(null);
      adsTransparentService
        .getDetails({
          advertiserId: creative.advertiserId,
          creativeId: creative.adCreativeId,
          adCreativeId: creative.id,
        })
        .then((r) => {
          if (!active) return;
          setDetail(r.data);
          handleScanned(creative.id);
        })
        .catch(() => {
          if (active) toast.error("Không lấy được chi tiết quảng cáo");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });

    return () => {
      active = false;
    };
  }, [creative, handleScanned, mode]);

  if (!creative) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* backdrop */}
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      {/* panel */}
      <div className="w-full max-w-md bg-background border-l border-border flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold">Chi tiết quảng cáo</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{creative.advertiser}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Advertiser ID</p>
              <p className="font-mono text-xs truncate">{creative.advertiserId}</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Creative ID</p>
              <p className="font-mono text-xs truncate">{creative.adCreativeId}</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Định dạng</p>
              <FormatBadge format={creative.format} />
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-[11px] text-muted-foreground mb-1">Domain</p>
              <p className="text-xs truncate">{creative.targetDomain ?? "—"}</p>
            </div>
            {creative.totalDaysShown != null && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-[11px] text-muted-foreground mb-1">Số ngày hiển thị</p>
                <p className="text-sm font-semibold">{creative.totalDaysShown}</p>
              </div>
            )}
            {creative.firstShown != null && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-[11px] text-muted-foreground mb-1">Lần đầu hiển thị</p>
                <p className="text-xs">{formatEpochDay(creative.firstShown)}</p>
              </div>
            )}
          </div>

          {/* Image */}
          {creative.image && !imageError && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Creative image</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={creative.image}
                alt=""
                className="w-full rounded-xl object-cover border border-border"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)}
              />
            </div>
          )}

          {creative.image && imageError && (
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-center text-xs text-muted-foreground">
              Không tải được ảnh creative.
            </div>
          )}

          {/* Links */}
          {creative.link && (
            <a
              href={creative.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-[#059669]/30 bg-[#059669]/5 px-4 py-2.5 text-sm text-[#059669] hover:bg-[#059669]/10 transition-colors"
            >
              <ExternalLink size={14} />
              Mở landing page
            </a>
          )}

          {/* API detail */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Info size={12} />
              Dữ liệu chi tiết từ SerpAPI
            </p>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={22} className="animate-spin text-[#059669]" />
              </div>
            ) : detail ? (
              <pre className="rounded-xl bg-muted p-4 text-[11px] overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(detail, null, 2)}
              </pre>
            ) : (
              <div className="rounded-xl bg-muted p-4 text-center text-xs text-muted-foreground">
                Không có dữ liệu chi tiết
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Scan form ────────────────────────────────────────────────────────────────

interface ScanFormProps {
  onScanDone: () => void;
}

function DateRangePicker({
  from,
  to,
  onChange,
}: {
  from?: string;
  to?: string;
  onChange: (nextFrom?: string, nextTo?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const selected: DateRange | undefined = {
    from: parseDateInput(from),
    to: parseDateInput(to),
  };

  const label =
    selected.from && selected.to
      ? `${format(selected.from, "dd/MM/yyyy")} - ${format(selected.to, "dd/MM/yyyy")}`
      : selected.from
      ? `${format(selected.from, "dd/MM/yyyy")} - ...`
      : "Chọn khoảng thời gian";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center justify-between rounded-xl border border-border bg-background px-3 text-left text-sm transition-colors hover:border-[#059669]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/30"
      >
        <span className={cn("truncate", !selected.from && "text-muted-foreground")}>{label}</span>
        <CalendarDays size={16} className="text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 z-40 mt-2 w-[min(95vw,620px)] rounded-2xl border border-border bg-card p-3 shadow-xl">
          <div className="mb-3 flex items-start justify-between gap-3 border-b border-border pb-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Chọn khoảng ngày</p>
              <p className="text-xs text-muted-foreground">
                Dùng dropdown tháng và năm để nhảy nhanh khi cần chọn khoảng dài.
              </p>
            </div>
          </div>

          <DayPicker
            mode="range"
            selected={selected}
            onSelect={(range) => {
              onChange(toInputDate(range?.from), toInputDate(range?.to));
            }}
            locale={vi}
            numberOfMonths={2}
            pagedNavigation
            captionLayout="dropdown"
            hideNavigation
            startMonth={DATE_PICKER_START_MONTH}
            endMonth={DATE_PICKER_END_MONTH}
            classNames={{
              months: "flex flex-col gap-4 sm:flex-row",
              month: "space-y-2",
              month_caption: "flex items-center justify-between gap-2",
              caption_label: "hidden",
              chevron: "hidden",
              dropdowns: "flex items-center gap-2",
              dropdown_root: "relative",
              dropdown:
                "h-8 rounded-md border border-border bg-background px-2 pr-7 text-xs font-medium text-foreground outline-none transition-colors hover:border-[#059669]/35 focus-visible:ring-2 focus-visible:ring-[#059669]/25",
              months_dropdown:
                "h-8 rounded-md border border-border bg-background px-2 pr-7 text-xs font-medium text-foreground outline-none transition-colors hover:border-[#059669]/35 focus-visible:ring-2 focus-visible:ring-[#059669]/25",
              years_dropdown:
                "h-8 rounded-md border border-border bg-background px-2 pr-7 text-xs font-medium text-foreground outline-none transition-colors hover:border-[#059669]/35 focus-visible:ring-2 focus-visible:ring-[#059669]/25",
              table: "w-full border-collapse",
              head_row: "flex",
              head_cell: "w-9 text-[11px] text-muted-foreground font-medium",
              row: "mt-1 flex w-full",
              cell: "h-9 w-9 p-0 text-center text-sm",
              day: "h-9 w-9 rounded-md hover:bg-muted",
              day_selected: "bg-[#059669] text-white hover:bg-[#047857]",
              day_range_middle: "bg-[#059669]/15 text-foreground",
              day_today: "border border-[#059669]/30",
            }}
          />

          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <div className="text-xs text-muted-foreground">
              {selected.from
                ? `Từ ${format(selected.from, "dd/MM/yyyy")}${selected.to ? ` đến ${format(selected.to, "dd/MM/yyyy")}` : ""}`
                : "Chưa chọn thời gian"}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChange(undefined, undefined)}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                Xóa
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-[#059669] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#047857]"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScanForm({ onScanDone }: ScanFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<AdsTransparencySearchRequest>({
    text: "",
    platform: undefined,
    creativeFormat: undefined,
    region: "",
    num: 40,
  });

  function set<K extends keyof AdsTransparencySearchRequest>(
    key: K,
    value: AdsTransparencySearchRequest[K]
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.text && !form.advertiserId) {
      toast.error("Nhập domain hoặc Advertiser ID trước khi quét");
      return;
    }
    setLoading(true);
    try {
      const payload: AdsTransparencySearchRequest = {
        ...form,
        platform: form.platform || undefined,
        creativeFormat: form.creativeFormat || undefined,
        region: form.region || undefined,
      };
      await adsTransparentService.search(payload);
      toast.success("Quét xong thành công!");
      setOpen(false);
      onScanDone();
    } catch {
      toast.error("Quét thất bại, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "relative rounded-xl border border-border bg-card",
        open ? "z-30 overflow-visible" : "overflow-hidden"
      )}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#059669]/10">
          <ScanLine size={15} className="text-[#059669]" />
        </div>
        <span className="flex-1 text-left text-sm font-medium">Quét đối thủ mới</span>
        {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="space-y-5 border-t border-border px-4 py-5 sm:px-5">
          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-dashed border-[#059669]/25 bg-[#059669]/[0.03] px-3 py-2 text-xs text-muted-foreground">
              <span>
                <span className="font-semibold text-[#dc2626]">*</span> Trường bắt buộc
              </span>
              <span>Điền ít nhất 1 trong 2 trường: Domain / Tên nhà quảng cáo hoặc Advertiser ID.</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-foreground/90">
                  Domain / Tên nhà quảng cáo <span className="text-[#dc2626]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="shopee.vn"
                  value={form.text ?? ""}
                  onChange={(e) => set("text", e.target.value)}
                  aria-required="true"
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm placeholder:text-muted-foreground/80 transition-colors hover:border-[#059669]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Có thể nhập domain, tên brand hoặc tên nhà quảng cáo.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground/90">
                  Advertiser ID <span className="text-[#dc2626]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="AR01234..."
                  value={form.advertiserId ?? ""}
                  onChange={(e) => set("advertiserId", e.target.value || undefined)}
                  aria-required="true"
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm placeholder:text-muted-foreground/80 transition-colors hover:border-[#059669]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Nếu đã có Advertiser ID, bạn chỉ cần điền trường này.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground/90">
                  Số kết quả
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.num}
                  onChange={(e) => set("num", Number(e.target.value) || 1)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm transition-colors hover:border-[#059669]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3 sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bộ lọc nâng cao
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground/90">
                  Nền tảng
                </label>
                <select
                  value={form.platform ?? ""}
                  onChange={(e) =>
                    set(
                      "platform",
                      (e.target.value as AdsTransparencySearchRequest["platform"]) || undefined
                    )
                  }
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm transition-colors hover:border-[#059669]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
                >
                  {PLATFORM_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground/90">
                  Định dạng
                </label>
                <select
                  value={form.creativeFormat ?? ""}
                  onChange={(e) =>
                    set(
                      "creativeFormat",
                      (e.target.value as AdsTransparencySearchRequest["creativeFormat"]) || undefined
                    )
                  }
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm transition-colors hover:border-[#059669]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
                >
                  {FORMAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground/90">
                  Khu vực
                </label>
                <select
                  value={form.region ?? ""}
                  onChange={(e) => set("region", e.target.value || undefined)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm transition-colors hover:border-[#059669]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
                >
                  {REGION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground/90">
                  Khoảng ngày
                </label>
                <DateRangePicker
                  from={form.startDate}
                  to={form.endDate}
                  onChange={(nextFrom, nextTo) => {
                    set("startDate", nextFrom);
                    set("endDate", nextTo);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/80 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#059669] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#047857] disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <ScanLine size={15} />
              )}
              {loading ? "Đang quét..." : "Bắt đầu quét"}
            </button>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-11 items-center rounded-xl border border-border px-4 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              Huỷ
            </button>

            <p className="ml-auto text-xs text-muted-foreground">
              Mẹo: nhập domain chính để ra kết quả đúng advertiser nhanh hơn
            </p>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdsTransparencyTab() {
  const [view, setView] = useState<"history" | "competitors">("history");
  const [history, setHistory] = useState<AdSearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCreative, setSelectedCreative] = useState<{
    creative: AdCreativeHistoryItem;
    mode: DetailAction;
  } | null>(null);
  const [scannedCounts, setScannedCounts] = useState<Map<string, number>>(new Map());
  const hasFetched = useRef(false);

  // Competitor pagination state
  const [competitorGroups, setCompetitorGroups] = useState<CompetitorGroup[]>([]);
  const [competitorTotal, setCompetitorTotal] = useState(0);
  const [competitorPage, setCompetitorPage] = useState(1);
  const [competitorTotalPages, setCompetitorTotalPages] = useState(0);
  const [loadingCompetitors, setLoadingCompetitors] = useState(false);
  const competitorFetchedRef = useRef(false);

  async function fetchHistory() {
    setLoading(true);
    try {
      const res = await adsTransparentService.getHistory();
      setHistory(res.items);
    } catch {
      toast.error("Không tải được lịch sử quét");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCompetitors(page: number) {
    setLoadingCompetitors(true);
    try {
      const res = await adsTransparentService.getCompetitors(page, 10);
      setCompetitorGroups(res.items);
      setCompetitorTotal(res.total);
      setCompetitorTotalPages(res.totalPages);
    } catch {
      toast.error("Không tải được danh sách đối thủ");
    } finally {
      setLoadingCompetitors(false);
    }
  }

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchHistory();
    }
  }, []);

  // Fetch competitors when switching to that view (once)
  useEffect(() => {
    if (view === "competitors" && !competitorFetchedRef.current) {
      competitorFetchedRef.current = true;
      fetchCompetitors(1);
    }
  }, [view]);

  function handleScanDone() {
    fetchHistory();
    if (competitorFetchedRef.current) {
      fetchCompetitors(competitorPage);
    }
  }

  function handleCompetitorPageChange(newPage: number) {
    setCompetitorPage(newPage);
    fetchCompetitors(newPage);
  }

  function handleRefresh() {
    fetchHistory();
    if (competitorFetchedRef.current) {
      fetchCompetitors(competitorPage);
    }
  }

  const totalAds = history.reduce((s, i) => s + i.creatives.length, 0);

  return (
    <>
      <div className="space-y-4">
        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Lần quét", value: history.length, icon: History },
            { label: "Đối thủ", value: competitorTotal, icon: Users },
            { label: "Quảng cáo", value: totalAds, icon: Tag },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#059669]/10">
                <Icon size={15} className="text-[#059669]" />
              </div>
              <div>
                <p className="text-lg font-bold leading-none">{value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Scan form */}
        <ScanForm onScanDone={handleScanDone} />

        {/* View toggle + refresh */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex rounded-xl border border-border bg-card p-1 gap-1">
            {(["history", "competitors"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  view === v
                    ? "bg-[#059669] text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v === "history" ? <History size={12} /> : <Users size={12} />}
                {v === "history" ? "Lịch sử quét" : "Theo đối thủ"}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading || loadingCompetitors}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={(loading || loadingCompetitors) ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>

        {/* Content */}
        {view === "history" ? (
          loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={28} className="animate-spin text-[#059669]" />
              <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.length === 0 ? (
                <EmptyState />
              ) : (
                history.map((item) => (
                  <HistoryRow
                    key={item.id}
                    item={item}
                    onScanDetail={(creative, mode) => setSelectedCreative({ creative, mode })}
                    scannedCounts={scannedCounts}
                  />
                ))
              )}
            </div>
          )
        ) : (
          loadingCompetitors ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 size={28} className="animate-spin text-[#059669]" />
              <p className="text-sm text-muted-foreground">Đang tải đối thủ...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {competitorGroups.length === 0 ? (
                <EmptyState />
              ) : (
                <>
                  {competitorGroups.map((group) => (
                    <CompetitorGroupCard
                      key={group.advertiserId}
                      group={group}
                      onScanDetail={(creative, mode) => setSelectedCreative({ creative, mode })}
                      scannedCounts={scannedCounts}
                    />
                  ))}

                  {/* Pagination */}
                  {competitorTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-1 pt-2">
                      <button
                        onClick={() => handleCompetitorPageChange(1)}
                        disabled={competitorPage === 1}
                        className="rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        «
                      </button>
                      <button
                        onClick={() => handleCompetitorPageChange(competitorPage - 1)}
                        disabled={competitorPage === 1}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        ‹
                      </button>

                      {Array.from({ length: competitorTotalPages }, (_, i) => i + 1)
                        .filter(
                          (p) =>
                            p === 1 ||
                            p === competitorTotalPages ||
                            Math.abs(p - competitorPage) <= 2
                        )
                        .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                          if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, idx) =>
                          p === "..." ? (
                            <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground">
                              …
                            </span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => handleCompetitorPageChange(p as number)}
                              className={cn(
                                "min-w-[30px] rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                                competitorPage === p
                                  ? "border-[#059669] bg-[#059669] text-white"
                                  : "border-border text-muted-foreground hover:bg-muted"
                              )}
                            >
                              {p}
                            </button>
                          )
                        )}

                      <button
                        onClick={() => handleCompetitorPageChange(competitorPage + 1)}
                        disabled={competitorPage === competitorTotalPages}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        ›
                      </button>
                      <button
                        onClick={() => handleCompetitorPageChange(competitorTotalPages)}
                        disabled={competitorPage === competitorTotalPages}
                        className="rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        »
                      </button>

                      <span className="ml-2 text-xs text-muted-foreground">
                        Trang {competitorPage}/{competitorTotalPages} · {competitorTotal} đối thủ
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        )}
      </div>

      {/* Detail drawer */}
      <DetailDrawer
        creative={selectedCreative?.creative ?? null}
        mode={selectedCreative?.mode ?? "view"}
        onClose={() => setSelectedCreative(null)}
        onScanned={(id) =>
          setScannedCounts((prev) => {
            const next = new Map(prev);
            next.set(id, (next.get(id) ?? 0) + 1);
            return next;
          })
        }
      />
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[#059669]/10">
        <ScanLine size={26} className="text-[#059669]/60" />
      </div>
      <p className="text-sm font-medium">Chưa có dữ liệu</p>
      <p className="mt-1 text-xs text-muted-foreground">Dùng form phía trên để quét đối thủ đầu tiên</p>
    </div>
  );
}
