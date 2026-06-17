"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Globe,
  Hash,
  Layers3,
  Link2,
  Loader2,
  RefreshCw,
  ScanLine,
  TrendingUp,
  X,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { keywordPlannerService } from "@/services/keywordPlanner.service";
import type {
  AdsAccountResponse,
  JobResponse,
  JobResultsResponse,
  KeywordIdeaItem,
} from "@/types/keywordPlanner.types";

// ─── Constants ────────────────────────────────────────────────────────────────

const LANGUAGE_OPTIONS = [
  { value: 1000, label: "English" },
  { value: 1019, label: "Tiếng Việt" },
  { value: 1023, label: "日本語" },
  { value: 1012, label: "한국어" },
  { value: 1002, label: "中文 (简体)" },
];

const MONTH_LABELS = ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtSearches(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString("vi-VN");
}

// ── Competition badge with fixed width ────────────────────────────────────────
const COMPETITION_STYLE: Record<string, { bar: string; badge: string }> = {
  "Thấp":            { bar: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-700" },
  "Trung bình":      { bar: "bg-amber-500",   badge: "bg-amber-500/10 text-amber-700" },
  "Cao":             { bar: "bg-red-500",      badge: "bg-red-500/10 text-red-700" },
  "Không xác định":  { bar: "bg-muted",        badge: "bg-muted text-muted-foreground" },
};

function CompetitionCell({ competition, index }: { competition: string; index?: number | null }) {
  const style = COMPETITION_STYLE[competition] ?? COMPETITION_STYLE["Không xác định"];
  const pct = index != null ? Math.round(index) : null;
  return (
    <div className="shrink-0 w-28 flex flex-col gap-1">
      <div className="flex items-center justify-between gap-1">
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap", style.badge)}>
          {competition}
        </span>
        {pct != null && <span className="text-[10px] tabular-nums text-muted-foreground">{pct}</span>}
      </div>
      {pct != null && (
        <div className="h-1 w-full rounded-full bg-border overflow-hidden">
          <div className={cn("h-full rounded-full", style.bar)} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

// ── Sparkline chart using recharts ────────────────────────────────────────────
function Sparkline({ data }: { data: { year: number; month: number; searches: number }[] }) {
  const chartData = data.map((d) => ({
    name: `${MONTH_LABELS[(d.month - 1) % 12]} ${d.year}`,
    v: d.searches,
  }));

  return (
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#059669" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={{ fontSize: 11, padding: "4px 8px", borderRadius: 6 }}
            formatter={(v) => [Number(v || 0).toLocaleString("vi-VN"), "Lượt"]}
            labelStyle={{ fontWeight: 600, fontSize: 11 }}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke="#059669"
            strokeWidth={1.5}
            fill="url(#spark-grad)"
            dot={false}
            activeDot={{ r: 3, fill: "#059669" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Keyword row ──────────────────────────────────────────────────────────────
function KeywordRow({ item }: { item: KeywordIdeaItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        {/* Keyword */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.keyword}</p>
        </div>

        {/* Avg monthly */}
        <div className="shrink-0 w-24 text-right">
          <p className="text-sm font-bold tabular-nums">
            {fmtSearches(item.avgMonthlySearches)}
          </p>
          <p className="text-[10px] text-muted-foreground">lượt / tháng</p>
        </div>

        {/* Competition (fixed width) */}
        <CompetitionCell competition={item.competition} index={item.competitionIndex} />

        {/* CPC */}
        <div className="shrink-0 w-28 text-right hidden sm:block">
          <p className="text-xs font-medium">
            {item.lowTopPageBid != null
              ? `$${item.lowTopPageBid.toFixed(2)} – $${(item.highTopPageBid ?? 0).toFixed(2)}`
              : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground">CPC top page</p>
        </div>

        {/* Sparkline preview */}
        {item.monthlySearches && item.monthlySearches.length > 0 && (
          <div className="shrink-0 w-24 hidden lg:block opacity-70">
            <Sparkline data={item.monthlySearches} />
          </div>
        )}

        {open ? (
          <ChevronUp size={14} className="shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Lượt TB / tháng</p>
              <p className="text-base font-bold tabular-nums">{item.avgMonthlySearches.toLocaleString("vi-VN")}</p>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Cạnh tranh</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={cn("text-sm font-semibold",
                  (COMPETITION_STYLE[item.competition] ?? COMPETITION_STYLE["Không xác định"]).badge.replace("bg-", "text-").replace("/10", "")
                )}>{item.competition}</span>
                {item.competitionIndex != null && (
                  <span className="text-xs text-muted-foreground">({item.competitionIndex})</span>
                )}
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">CPC thấp nhất</p>
              <p className="text-sm font-semibold">
                {item.lowTopPageBid != null ? `$${item.lowTopPageBid.toFixed(3)}` : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">CPC cao nhất</p>
              <p className="text-sm font-semibold">
                {item.highTopPageBid != null ? `$${item.highTopPageBid.toFixed(3)}` : "—"}
              </p>
            </div>
          </div>

          {/* Chart */}
          {item.monthlySearches && item.monthlySearches.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Xu hướng 12 tháng gần nhất
              </p>
              <Sparkline data={item.monthlySearches} />
              <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                <span>{MONTH_LABELS[(item.monthlySearches[0].month - 1) % 12]} {item.monthlySearches[0].year}</span>
                <span>{MONTH_LABELS[(item.monthlySearches[item.monthlySearches.length - 1].month - 1) % 12]} {item.monthlySearches[item.monthlySearches.length - 1].year}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// ─── Job result panel ─────────────────────────────────────────────────────────

function JobResultPanel({
  result,
  onClose,
}: {
  result: JobResultsResponse;
  onClose: () => void;
}) {
  const { job, results } = result;
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? results.filter((r) =>
        r.keyword.toLowerCase().includes(search.trim().toLowerCase())
      )
    : results;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-3xl bg-background border-l border-border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <div>
            <h3 className="text-sm font-semibold">Kết quả Keyword Ideas</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {job.inputType === "keywords"
                ? `Keywords: ${(job.keywords ?? []).join(", ")}`
                : `URL: ${job.pageUrl}`}
              {" · "}
              {results.length} từ khóa
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-muted transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border shrink-0">
          <input
            type="text"
            placeholder="Lọc theo tên keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-muted/40 px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
          />
        </div>

        {/* Table header */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/30 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
          <span className="flex-1">Keyword</span>
          <span className="w-24 text-right">Avg / tháng</span>
          <span className="w-28">Cạnh tranh</span>
          <span className="w-28 hidden sm:block text-right">CPC top page</span>
          <span className="w-24 hidden lg:block">Xu hướng</span>
          <span className="w-4" />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Không có kết quả
            </div>
          ) : (
            filtered.map((item) => <KeywordRow key={item.id} item={item} />)
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Job history row ──────────────────────────────────────────────────────────

function JobHistoryRow({
  job,
  onView,
}: {
  job: JobResponse;
  onView: (job: JobResponse) => void;
}) {
  const isKeyword = job.inputType === "keywords";
  const statusColor =
    job.status === "done"
      ? "border border-emerald-500 bg-emerald-50 text-emerald-700"
      : job.status === "error"
      ? "border border-red-500 bg-red-50 text-red-700"
      : "border border-amber-500 bg-amber-50 text-amber-700";
  const statusLabel =
    job.status === "done" ? "Xong" : job.status === "error" ? "Lỗi" : "Đang chạy";

  return (
    <div className="rounded-xl border border-border bg-card flex items-center gap-3 px-4 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#059669]/10 text-[#059669]">
        {isKeyword ? <Hash size={16} /> : <Globe size={16} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {isKeyword
            ? (job.keywords ?? []).join(", ") || "(keywords)"
            : job.pageUrl ?? "(url)"}
        </p>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          <span>{formatDate(job.createdAt)}</span>
          <span>{job.resultCount} từ khóa</span>
          {job.pageUrl && isKeyword && <span>{job.pageUrl}</span>}
        </div>
      </div>
      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", statusColor)}>
        {statusLabel}
      </span>
      {job.status === "done" && (
        <button
          onClick={() => onView(job)}
          className="shrink-0 rounded-lg bg-[#059669]/10 px-3 py-1.5 text-xs font-medium text-[#059669] hover:bg-[#059669]/20 transition-colors"
        >
          Xem kết quả
        </button>
      )}
    </div>
  );
}

// ─── CustomSelect component ───────────────────────────────────────────────────

interface CustomSelectOption {
  value: string | number;
  label: string;
}

interface CustomSelectProps {
  label?: string;
  value: string | number;
  onChange: (value: any) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
  clearable?: boolean;
  clearText?: string;
}

function CustomSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Chọn...",
  showSearch = false,
  searchPlaceholder = "Tìm kiếm...",
  clearable = false,
  clearText = "Xóa lựa chọn",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredOptions = useMemo(() => {
    if (!showSearch) return options;
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((opt: CustomSelectOption) =>
      opt.label.toLowerCase().includes(query)
    );
  }, [options, search, showSearch]);

  const selectedOption = options.find((opt: CustomSelectOption) => opt.value === value);

  return (
    <div className="relative flex flex-col" ref={containerRef}>
      {label && <span className="text-sm font-medium mb-1 text-foreground">{label}</span>}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none hover:border-[#059669]/50 focus-within:border-[#059669] transition min-h-[38px] text-foreground"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="text-xs text-muted-foreground">▼</span>
      </div>
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 flex w-full flex-col rounded-lg border border-border bg-card p-2 shadow-lg max-h-[300px]">
          {showSearch && (
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="mb-2 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-[#059669] text-foreground placeholder:text-muted-foreground"
              autoFocus
            />
          )}
          <div className="overflow-y-auto flex-1 space-y-0.5 max-h-[200px]">
            {clearable && value && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                  setIsOpen(false);
                  setSearch("");
                }}
                className="flex w-full items-center px-3 py-2 text-left text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition"
              >
                {clearText}
              </button>
            )}
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Không tìm thấy kết quả
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted ${
                      isSelected ? "bg-[#059669]/10 font-medium text-[#059669]" : "text-foreground"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check size={14} className="text-[#059669]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Scan form ────────────────────────────────────────────────────────────────

function ScanForm({ onDone }: { onDone: (result: JobResultsResponse) => void }) {
  const [mode, setMode] = useState<"keywords" | "url">("keywords");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Account selector
  const [accounts, setAccounts] = useState<AdsAccountResponse[]>([]);
  const [selectedAdsId, setSelectedAdsId] = useState("");

  useEffect(() => {
    if (open && accounts.length === 0) {
      keywordPlannerService.listAccounts().then((res) => {
        setAccounts(res.items);
        if (res.items.length > 0 && !selectedAdsId) {
          setSelectedAdsId(res.items[0].adsId);
        }
      }).catch(() => {});
    }
  }, [open]);

  // Keyword mode
  const [keywordsRaw, setKeywordsRaw] = useState("");
  const [pageUrlKw, setPageUrlKw] = useState("");

  // URL mode
  const [pageUrl, setPageUrl] = useState("");
  const [useEntireSite, setUseEntireSite] = useState(true);

  // Common
  const [languageId, setLanguageId] = useState(1000);
  const [limitVal, setLimitVal] = useState(500);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAdsId) {
      toast.error("Chọn tài khoản Google Ads trước");
      return;
    }
    setLoading(true);
    try {
      let result: JobResultsResponse;
      if (mode === "keywords") {
        const kws = keywordsRaw
          .split(/[\n,]+/)
          .map((k) => k.trim())
          .filter(Boolean);
        if (!kws.length) {
          toast.error("Nhập ít nhất 1 keyword");
          return;
        }
        result = await keywordPlannerService.scanByKeywords({
          adsId: selectedAdsId,
          keywords: kws,
          pageUrl: pageUrlKw.trim() || undefined,
          languageId,
          resultLimit: limitVal,
        });
      } else {
        if (!pageUrl.trim()) {
          toast.error("Nhập URL trước khi quét");
          return;
        }
        result = await keywordPlannerService.scanByUrl({
          adsId: selectedAdsId,
          pageUrl: pageUrl.trim(),
          useEntireSite,
          languageId,
          resultLimit: limitVal,
        });
      }
      toast.success(`Quét xong — ${result.results.length} keyword ideas`);
      setOpen(false);
      onDone(result);
    } catch {
      toast.error("Quét thất bại, kiểm tra Google Ads credentials trong .env");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card",
        open ? "z-30 overflow-visible" : "overflow-hidden"
      )}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#059669]/10">
          <ScanLine size={15} className="text-[#059669]" />
        </div>
        <span className="flex-1 text-left text-sm font-medium">Quét Keyword Ideas mới</span>
        {open ? (
          <ChevronUp size={15} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={15} className="text-muted-foreground" />
        )}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="border-t border-border px-4 py-5 space-y-4">
          {/* Account selector */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground/90">
              Tài khoản Google Ads <span className="text-red-500">*</span>
            </label>
            <CustomSelect
              value={selectedAdsId}
              onChange={setSelectedAdsId}
              options={accounts.map((a) => ({
                value: a.adsId,
                label: `${a.adsName} (${a.adsId})`,
              }))}
              placeholder={accounts.length === 0 ? "Không có tài khoản nào — hãy import trước" : "Chọn tài khoản..."}
            />
          </div>

          {/* Mode toggle */}
          <div className="flex rounded-xl border border-border overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setMode("keywords")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 font-medium transition-colors",
                mode === "keywords"
                  ? "bg-[#059669] text-white"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Hash size={14} /> Từ khóa
            </button>
            <button
              type="button"
              onClick={() => setMode("url")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 font-medium transition-colors",
                mode === "url"
                  ? "bg-[#059669] text-white"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Link2 size={14} /> URL / Domain
            </button>
          </div>

          {mode === "keywords" ? (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground/90">
                  Keywords <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder={"mua laptop\ngaming chair\ntai nghe bluetooth"}
                  value={keywordsRaw}
                  onChange={(e) => setKeywordsRaw(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25 resize-none"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Mỗi dòng hoặc cách nhau bằng dấu phẩy
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground/90">
                  URL kết hợp{" "}
                  <span className="font-normal text-muted-foreground">(tuỳ chọn)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/product"
                  value={pageUrlKw}
                  onChange={(e) => setPageUrlKw(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground/90">
                  URL / Domain <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="https://shopee.vn hoặc shopee.vn"
                  value={pageUrl}
                  onChange={(e) => setPageUrl(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="useEntireSite"
                  checked={useEntireSite}
                  onChange={(e) => setUseEntireSite(e.target.checked)}
                  className="size-4 rounded border-border accent-[#059669]"
                />
                <label htmlFor="useEntireSite" className="text-sm text-foreground cursor-pointer">
                  Quét toàn bộ domain{" "}
                  <span className="text-muted-foreground text-xs">(bỏ check = quét 1 trang)</span>
                </label>
              </div>
            </>
          )}

          {/* Common options */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground/90">
                Ngôn ngữ
              </label>
              <CustomSelect
                value={languageId}
                onChange={(val) => setLanguageId(Number(val))}
                options={LANGUAGE_OPTIONS}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-foreground/90">
                Giới hạn kết quả
              </label>
              <input
                type="number"
                min={10}
                max={2000}
                value={limitVal}
                onChange={(e) => setLimitVal(Number(e.target.value) || 500)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-border pt-1">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#059669] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#047857] disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ScanLine size={14} />
              )}
              {loading ? "Đang quét..." : "Bắt đầu quét"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm text-muted-foreground hover:bg-muted"
            >
              Huỷ
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function KeywordPlannerTab() {
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [viewResult, setViewResult] = useState<JobResultsResponse | null>(null);
  const hasFetched = useRef(false);

  async function fetchJobs() {
    setLoading(true);
    try {
      const res = await keywordPlannerService.listJobs();
      setJobs(res.items);
      setTotal(res.total);
    } catch {
      toast.error("Không tải được danh sách jobs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchJobs();
    }
  }, []);

  async function handleViewJob(job: JobResponse) {
    try {
      const res = await keywordPlannerService.getJobResults(job.id);
      setViewResult(res);
    } catch {
      toast.error("Không lấy được kết quả job");
    }
  }

  function handleScanDone(result: JobResultsResponse) {
    setJobs((prev) => [result.job, ...prev]);
    setTotal((prev) => prev + 1);
    setViewResult(result);
  }

  const totalKeywords = jobs.reduce((s, j) => s + j.resultCount, 0);

  return (
    <>
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Lần quét", value: total, icon: Layers3 },
            { label: "Keyword ideas", value: totalKeywords.toLocaleString("vi-VN"), icon: TrendingUp },
            {
              label: "Thành công",
              value: jobs.filter((j) => j.status === "done").length,
              icon: ScanLine,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#059669]/10">
                <Icon size={17} className="text-[#059669]" />
              </div>
              <div>
                <p className="text-lg font-bold leading-tight">{value}</p>
                <p className="text-[11px] text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Scan form */}
        <ScanForm onDone={handleScanDone} />

        {/* Jobs list */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">
            Lịch sử quét{" "}
            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
              {total}
            </span>
          </p>
          <button
            onClick={fetchJobs}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={cn(loading && "animate-spin")} />
            Làm mới
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[#059669]" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[#059669]/10">
              <TrendingUp size={26} className="text-[#059669]/60" />
            </div>
            <p className="text-sm font-medium">Chưa có lịch sử quét</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Dùng form phía trên để quét keyword ideas từ Google Ads.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <JobHistoryRow key={job.id} job={job} onView={handleViewJob} />
            ))}
          </div>
        )}
      </div>

      {viewResult && (
        <JobResultPanel result={viewResult} onClose={() => setViewResult(null)} />
      )}
    </>
  );
}
