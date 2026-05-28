"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  SearchCheck,
  ListTree,
  Layers3,
  Globe,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { manualSearchService } from "@/services/manualSearch.service";
import type {
  CompetitorAdItem,
  ManualCompetitorSearchHistoryItem,
  ManualCompetitorSearchRequest,
  ManualKeywordGroup,
} from "@/types/manualSearch.types";

type CodeOption = {
  value: string;
  label: string;
};

const LOCATION_OPTIONS = [
  { value: "Vietnam", label: "Vietnam" },
  { value: "United States", label: "United States" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "Australia", label: "Australia" },
];

const HL_OPTIONS = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "Tiếng Anh" },
  { value: "ja", label: "Tiếng Nhật" },
  { value: "ko", label: "Tiếng Hàn" },
  { value: "fr", label: "Tiếng Pháp" },
  { value: "de", label: "Tiếng Đức" },
  { value: "es", label: "Tiếng Tây Ban Nha" },
  { value: "th", label: "Tiếng Thái" },
] satisfies CodeOption[];

const GL_OPTIONS = [
  { value: "vn", label: "Việt Nam" },
  { value: "us", label: "United States" },
  { value: "uk", label: "United Kingdom" },
  { value: "au", label: "Australia" },
  { value: "sg", label: "Singapore" },
  { value: "ca", label: "Canada" },
  { value: "jp", label: "Nhật Bản" },
  { value: "kr", label: "Hàn Quốc" },
] satisfies CodeOption[];

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AdItemCard({ ad }: { ad: CompetitorAdItem }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold leading-tight">{ad.title || "Không có tiêu đề"}</p>
          <p className="mt-1 text-xs text-muted-foreground break-all">{ad.advertiser}</p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            ad.type === "top_ad"
              ? "bg-[#059669]/10 text-[#059669]"
              : "bg-amber-500/10 text-amber-700"
          )}
        >
          {ad.position}
        </span>
      </div>

      {ad.snippet && <p className="mt-2 text-xs text-muted-foreground">{ad.snippet}</p>}

      {ad.sitelinks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ad.sitelinks.map((sitelink) => (
            <span
              key={`${ad.link}-${sitelink}`}
              className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {sitelink}
            </span>
          ))}
        </div>
      )}

      {ad.link && (
        <a
          href={ad.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#059669] hover:underline"
        >
          Mở quảng cáo
          <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

function SearchHistoryRow({ item }: { item: ManualCompetitorSearchHistoryItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#059669]/10">
          <SearchCheck size={15} className="text-[#059669]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{item.keyword}</p>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin size={11} />{item.location}</span>
            <span className="inline-flex items-center gap-1"><Globe size={11} />{item.gl.toUpperCase()} / {item.hl}</span>
            <span>{formatDateTime(item.createdAt)}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold">{item.totalAdsFound} ads</p>
          <p className="text-[11px] text-muted-foreground">Top {item.topAdsCount} • Bottom {item.bottomAdsCount}</p>
        </div>
        {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>URL: {item.googleUrl || "—"}</span>
            <span>Num: {item.num}</span>
            <span>No cache: {item.noCache ? "true" : "false"}</span>
          </div>

          {item.ads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              Không có ads trong lần search này.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {item.ads.map((ad, index) => (
                <AdItemCard key={`${item.id}-${index}-${ad.link}`} ad={ad} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KeywordGroupCard({ group }: { group: ManualKeywordGroup }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#059669]/10 text-[#059669]">
          <Layers3 size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{group.keyword}</p>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>{group.searches.length} lần search</span>
            <span>{group.totalAdsFound} ads cộng dồn</span>
            <span>{formatDateTime(group.latestSearchedAt)}</span>
          </div>
        </div>
        {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-3">
          {group.searches.map((search) => (
            <SearchHistoryRow key={search.id} item={search} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[#059669]/10">
        <Search size={26} className="text-[#059669]/60" />
      </div>
      <p className="text-sm font-medium">Chưa có lịch sử search</p>
      <p className="mt-1 text-xs text-muted-foreground">Dùng form phía trên để trace đối thủ từ Google Search.</p>
    </div>
  );
}

function CodeSuggestionField({
  label,
  description,
  placeholder,
  value,
  onChange,
  options,
}: {
  label: string;
  description: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: CodeOption[];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-foreground/90">
        {label}
        <span className="ml-1 font-normal text-muted-foreground">({description})</span>
      </label>

      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value.toLowerCase())}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-border bg-background px-3 font-mono text-sm tracking-[0.08em] transition-colors hover:border-[#059669]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = value.toLowerCase() === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                active
                  ? "border-[#059669] bg-[#059669]/10 text-[#047857]"
                  : "border-border bg-background text-muted-foreground hover:border-[#059669]/30 hover:text-foreground"
              )}
            >
              <span className="font-mono font-semibold uppercase">{option.value}</span>
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ManualSearchTab() {
  const [view, setView] = useState<"history" | "keyword">("history");
  const [history, setHistory] = useState<ManualCompetitorSearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const hasFetched = useRef(false);
  const [form, setForm] = useState<ManualCompetitorSearchRequest>({
    keyword: "",
    location: "Vietnam",
    hl: "vi",
    gl: "vn",
    num: 10,
    noCache: true,
  });

  function set<K extends keyof ManualCompetitorSearchRequest>(
    key: K,
    value: ManualCompetitorSearchRequest[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function fetchHistory() {
    setLoading(true);
    try {
      const response = await manualSearchService.getHistory();
      setHistory(response.items);
    } catch {
      toast.error("Không tải được lịch sử Search competitor");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchHistory();
    }
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.keyword.trim()) {
      toast.error("Nhập keyword trước khi search");
      return;
    }

    setSubmitting(true);
    try {
      const response = await manualSearchService.searchCompetitor({
        ...form,
        keyword: form.keyword.trim(),
      });
      toast.success(`Search xong - tìm thấy ${response.totalAdsFound} ads`);
      await fetchHistory();
    } catch {
      toast.error("Search competitor thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  const keywordGroups = useMemo<ManualKeywordGroup[]>(() => {
    const grouped = new Map<string, ManualKeywordGroup>();

    for (const item of history) {
      const key = item.keyword.trim().toLowerCase();
      const existing = grouped.get(key);
      if (existing) {
        existing.searches.push(item);
        existing.totalAdsFound += item.totalAdsFound;
        if (item.createdAt > existing.latestSearchedAt) {
          existing.latestSearchedAt = item.createdAt;
        }
      } else {
        grouped.set(key, {
          keyword: item.keyword,
          searches: [item],
          totalAdsFound: item.totalAdsFound,
          latestSearchedAt: item.createdAt,
        });
      }
    }

    return Array.from(grouped.values()).sort((left, right) =>
      right.latestSearchedAt.localeCompare(left.latestSearchedAt)
    );
  }, [history]);

  const totalAds = history.reduce((sum, item) => sum + item.totalAdsFound, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Lần search", value: history.length, icon: Search },
          { label: "Keyword", value: keywordGroups.length, icon: ListTree },
          { label: "Ads", value: totalAds, icon: SearchCheck },
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

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-foreground/90">Keyword</label>
            <input
              type="text"
              value={form.keyword}
              onChange={(event) => set("keyword", event.target.value)}
              placeholder="vpn"
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm transition-colors hover:border-[#059669]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground/90">Location</label>
            <select
              value={form.location}
              onChange={(event) => set("location", event.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm transition-colors hover:border-[#059669]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
            >
              {LOCATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>


        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

          <CodeSuggestionField
            label="HL"
            description="ngôn ngữ giao diện Google"
            placeholder="vi"
            value={form.hl ?? ""}
            onChange={(value) => set("hl", value)}
            options={HL_OPTIONS}
          />

          <CodeSuggestionField
            label="GL"
            description="mã quốc gia tìm kiếm"
            placeholder="vn"
            value={form.gl ?? ""}
            onChange={(value) => set("gl", value)}
            options={GL_OPTIONS}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground/90">Num</label>
            <input
              type="number"
              min={1}
              max={100}
              value={form.num}
              onChange={(event) => set("num", Number(event.target.value) || 1)}
              className="h-11 w-28 rounded-xl border border-border bg-background px-3 text-sm transition-colors hover:border-[#059669]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
            />
          </div>

          <label className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.noCache}
              onChange={(event) => set("noCache", event.target.checked)}
              className="size-4 rounded border-border text-[#059669]"
            />
            No cache
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="ml-auto inline-flex h-11 items-center gap-2 rounded-xl bg-[#059669] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#047857] disabled:opacity-60"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            {submitting ? "Đang search..." : "Search competitor"}
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {([
            ["history", "Theo lịch sử search"],
            ["keyword", "Gom theo keyword"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setView(value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                view === value
                  ? "bg-[#059669] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Làm mới
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 size={28} className="animate-spin text-[#059669]" />
          <p className="text-sm text-muted-foreground">Đang tải lịch sử search...</p>
        </div>
      ) : history.length === 0 ? (
        <EmptyState />
      ) : view === "history" ? (
        <div className="space-y-2">
          {history.map((item) => (
            <SearchHistoryRow key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {keywordGroups.map((group) => (
            <KeywordGroupCard key={group.keyword.toLowerCase()} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}