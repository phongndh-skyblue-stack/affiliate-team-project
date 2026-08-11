"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownUp,
  BarChart3,
  BookmarkPlus,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CandidateStatus,
  JobResultsResponse,
  KeywordIdeaItem,
  KeywordIntent,
  OpportunityTier,
} from "@/types/keywordPlanner.types";
import {
  filterKeywordIdeas,
  sortKeywordIdeas,
  summarizeKeywordIdeas,
  type KeywordFilters,
  type KeywordSort,
} from "./keywordPlanner.utils";

export interface CandidateDraft {
  name: string;
  description: string;
  notes: string;
  tags: string[];
  status: CandidateStatus;
  websiteUrl: string;
}

interface KeywordResultsWorkspaceProps {
  result: JobResultsResponse;
  selectedIds: Set<string>;
  onSelectedChange: (ids: Set<string>) => void;
  onSave: (items: KeywordIdeaItem[], draft: CandidateDraft) => Promise<void>;
  saving: boolean;
}

const INITIAL_FILTERS: KeywordFilters = {
  query: "",
  intents: [],
  competition: [],
  tiers: [],
  minVolume: null,
  maxCpc: null,
};

const INTENT_LABELS: Record<KeywordIntent, string> = {
  informational: "Thông tin",
  commercial: "Thương mại",
  transactional: "Giao dịch",
  navigational: "Điều hướng",
  unknown: "Chưa rõ",
};

const TIER_LABELS: Record<OpportunityTier, string> = {
  high: "Cơ hội cao",
  medium: "Trung bình",
  low: "Cơ hội thấp",
};

function formatCompact(value: number) {
  return new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function tierClass(tier: OpportunityTier) {
  if (tier === "high") return "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20";
  if (tier === "medium") return "bg-amber-500/10 text-amber-700 ring-amber-500/20";
  return "bg-slate-500/10 text-slate-600 ring-slate-500/20";
}

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function SaveCandidateDialog({
  count,
  saving,
  onClose,
  onSubmit,
}: {
  count: number;
  saving: boolean;
  onClose: () => void;
  onSubmit: (draft: CandidateDraft) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [status, setStatus] = useState<CandidateStatus>("new");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({
            name: name.trim(),
            description: description.trim(),
            notes: notes.trim(),
            websiteUrl: websiteUrl.trim(),
            status,
            tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
          });
        }}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <h3 className="font-semibold">Lưu dự án tiềm năng</h3>
            <p className="mt-1 text-xs text-muted-foreground">Lưu snapshot của {count} keyword đã chọn.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Đóng">
            <X size={16} />
          </button>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold">Tên dự án *</span>
            <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: VPN SaaS — US" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-emerald-500" />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-semibold">Trạng thái</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as CandidateStatus)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">
              <option value="new">Mới</option>
              <option value="researching">Đang nghiên cứu</option>
              <option value="promising">Tiềm năng</option>
              <option value="rejected">Loại bỏ</option>
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-semibold">Tags</span>
            <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="saas, recurring, us" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-emerald-500" />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold">Website <span className="font-normal text-muted-foreground">(có thể bổ sung sau)</span></span>
            <input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://example.com/affiliate" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-emerald-500" />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold">Mô tả</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-emerald-500" />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold">Ghi chú nghiên cứu</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-emerald-500" />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-6 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted">Hủy</button>
          <button disabled={saving || !name.trim()} className="h-10 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? "Đang lưu…" : "Lưu dự án"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function KeywordResultsWorkspace({
  result,
  selectedIds,
  onSelectedChange,
  onSave,
  saving,
}: KeywordResultsWorkspaceProps) {
  const [filters, setFilters] = useState<KeywordFilters>(INITIAL_FILTERS);
  const [sort, setSort] = useState<KeywordSort>("score-desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);
  const filtered = useMemo(
    () => sortKeywordIdeas(filterKeywordIdeas(result.results, filters), sort),
    [filters, result.results, sort]
  );
  const summary = useMemo(() => summarizeKeywordIdeas(result.results), [result.results]);
  const selectedItems = result.results.filter((item) => selectedIds.has(item.id));
  const allVisibleSelected = filtered.length > 0 && filtered.every((item) => selectedIds.has(item.id));

  function selectVisible() {
    const next = new Set(selectedIds);
    filtered.forEach((item) => {
      if (allVisibleSelected) next.delete(item.id);
      else next.add(item.id);
    });
    onSelectedChange(next);
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Keyword ideas", value: summary.count.toLocaleString("vi-VN"), icon: Search, accent: "text-sky-600 bg-sky-500/10" },
          { label: "Tổng nhu cầu", value: formatCompact(summary.totalVolume), icon: BarChart3, accent: "text-violet-600 bg-violet-500/10" },
          { label: "Cạnh tranh TB", value: `${summary.averageCompetitionIndex}/100`, icon: Target, accent: "text-amber-600 bg-amber-500/10" },
          { label: "Cơ hội mạnh nhất", value: summary.strongestKeyword ? `${summary.strongestKeyword.opportunityScore ?? 0}/100` : "—", icon: Sparkles, accent: "text-emerald-600 bg-emerald-500/10" },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className={cn("mb-3 flex size-8 items-center justify-center rounded-xl", accent)}><Icon size={15} /></div>
            <p className="text-xl font-bold tracking-tight">{value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="Lọc trong kết quả…" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-emerald-500" />
            </div>
            <div className="flex items-center gap-2">
              <ArrowDownUp size={14} className="text-muted-foreground" />
              <select value={sort} onChange={(event) => setSort(event.target.value as KeywordSort)} className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-medium">
                <option value="score-desc">Điểm cơ hội cao nhất</option>
                <option value="volume-desc">Lượng tìm kiếm cao nhất</option>
                <option value="competition-asc">Cạnh tranh thấp nhất</option>
                <option value="cpc-desc">CPC cao nhất</option>
                <option value="trend-desc">Xu hướng tăng mạnh</option>
                <option value="keyword-asc">Keyword A–Z</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"><Filter size={12} /> Phân loại</span>
            {(["high", "medium", "low"] as OpportunityTier[]).map((tier) => (
              <button key={tier} onClick={() => setFilters({ ...filters, tiers: toggleValue(filters.tiers, tier) })} className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium transition", filters.tiers.includes(tier) ? tierClass(tier) : "border-border text-muted-foreground hover:bg-muted")}>
                {TIER_LABELS[tier]}
              </button>
            ))}
            {(["commercial", "transactional", "informational"] as KeywordIntent[]).map((intent) => (
              <button key={intent} onClick={() => setFilters({ ...filters, intents: toggleValue(filters.intents, intent) })} className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium transition", filters.intents.includes(intent) ? "border-sky-500/30 bg-sky-500/10 text-sky-700" : "border-border text-muted-foreground hover:bg-muted")}>
                {INTENT_LABELS[intent]}
              </button>
            ))}
            <input type="number" min={0} value={filters.minVolume ?? ""} onChange={(event) => setFilters({ ...filters, minVolume: event.target.value ? Number(event.target.value) : null })} placeholder="Volume tối thiểu" className="h-7 w-32 rounded-full border border-border bg-background px-3 text-[11px] outline-none" />
            <input type="number" min={0} step="0.1" value={filters.maxCpc ?? ""} onChange={(event) => setFilters({ ...filters, maxCpc: event.target.value ? Number(event.target.value) : null })} placeholder="CPC tối đa" className="h-7 w-28 rounded-full border border-border bg-background px-3 text-[11px] outline-none" />
            {(filters.query || filters.intents.length || filters.tiers.length || filters.minVolume != null || filters.maxCpc != null) && (
              <button onClick={() => setFilters(INITIAL_FILTERS)} className="text-[11px] font-medium text-red-600 hover:underline">Xóa bộ lọc</button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-12 px-4 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={selectVisible} aria-label="Chọn tất cả kết quả đang lọc" className="size-4 accent-emerald-600" /></th>
                <th className="px-2 py-3">Keyword</th>
                <th className="px-3 py-3 text-right">Tìm kiếm/tháng</th>
                <th className="px-3 py-3">Mục đích</th>
                <th className="px-3 py-3">Cạnh tranh</th>
                <th className="px-3 py-3 text-right">CPC top page</th>
                <th className="px-3 py-3 text-center">Điểm cơ hội</th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((item) => {
                const tier = item.opportunityTier ?? "low";
                const expanded = expandedId === item.id;
                return (
                  <tr key={item.id} className={cn("group transition hover:bg-muted/30", selectedIds.has(item.id) && "bg-emerald-500/[0.04]")}>
                    <td className="px-4 py-3 align-top"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => { const next = new Set(selectedIds); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); onSelectedChange(next); }} aria-label={`Chọn ${item.keyword}`} className="mt-1 size-4 accent-emerald-600" /></td>
                    <td className="px-2 py-3 align-top"><p className="max-w-xs font-medium">{item.keyword}</p>{expanded && <p className="mt-2 max-w-md text-[11px] leading-relaxed text-muted-foreground">{item.scoreExplanation || "Chưa có giải thích điểm."}</p>}</td>
                    <td className="px-3 py-3 text-right align-top"><p className="font-semibold tabular-nums">{item.avgMonthlySearches.toLocaleString("vi-VN")}</p><p className={cn("text-[10px]", (item.trendPercentage ?? 0) >= 0 ? "text-emerald-600" : "text-red-600")}>{(item.trendPercentage ?? 0) >= 0 ? "+" : ""}{item.trendPercentage ?? 0}%</p></td>
                    <td className="px-3 py-3 align-top"><span className="rounded-full bg-sky-500/10 px-2 py-1 text-[10px] font-medium text-sky-700">{INTENT_LABELS[item.intent ?? "unknown"]}</span></td>
                    <td className="px-3 py-3 align-top"><p className="text-xs font-medium">{item.competition}</p><div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-amber-500" style={{ width: `${item.competitionIndex ?? 50}%` }} /></div></td>
                    <td className="px-3 py-3 text-right align-top text-xs"><span className="font-medium">{item.lowTopPageBid != null ? `$${item.lowTopPageBid.toFixed(2)}` : "—"}</span><span className="text-muted-foreground"> – {item.highTopPageBid != null ? `$${item.highTopPageBid.toFixed(2)}` : "—"}</span></td>
                    <td className="px-3 py-3 text-center align-top"><span className={cn("inline-flex min-w-20 items-center justify-center rounded-full px-2 py-1 text-[10px] font-bold ring-1", tierClass(tier))}>{item.opportunityScore ?? 0} · {TIER_LABELS[tier]}</span></td>
                    <td className="px-3 py-3 align-top"><button onClick={() => setExpandedId(expanded ? null : item.id)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Xem giải thích điểm">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="px-6 py-16 text-center"><Search size={28} className="mx-auto text-muted-foreground/40" /><p className="mt-3 text-sm font-medium">Không có keyword phù hợp</p><p className="mt-1 text-xs text-muted-foreground">Thử nới lỏng bộ lọc hoặc thực hiện nghiên cứu mới.</p></div>
        )}

        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          <span>Hiển thị {filtered.length.toLocaleString("vi-VN")} / {result.results.length.toLocaleString("vi-VN")} keyword</span>
          <span>Snapshot: {new Date(result.job.updatedAt).toLocaleString("vi-VN")}</span>
        </div>
      </section>

      {selectedIds.size > 0 && (
        <div className="sticky bottom-4 z-20 flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-background/95 px-4 py-3 shadow-xl backdrop-blur">
          <div><p className="text-sm font-semibold">Đã chọn {selectedIds.size} keyword</p><p className="text-[11px] text-muted-foreground">Có thể lưu thành dự án tiềm năng mà chưa cần website.</p></div>
          <div className="flex gap-2"><button onClick={() => onSelectedChange(new Set())} className="rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted">Bỏ chọn</button><button onClick={() => setShowSave(true)} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"><BookmarkPlus size={14} /> Lưu dự án</button></div>
        </div>
      )}

      {showSave && (
        <SaveCandidateDialog
          count={selectedItems.length}
          saving={saving}
          onClose={() => setShowSave(false)}
          onSubmit={async (draft) => {
            await onSave(selectedItems, draft);
            setShowSave(false);
          }}
        />
      )}
    </div>
  );
}
