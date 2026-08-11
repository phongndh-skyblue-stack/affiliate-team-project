"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Bookmark,
  ExternalLink,
  Loader2,
  Pencil,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { keywordPlannerService } from "@/services/keywordPlanner.service";
import type {
  CandidateKeyword,
  CandidateKeywordInput,
  CandidateProject,
  CandidateStatus,
  KeywordIntent,
} from "@/types/keywordPlanner.types";

const STATUS_LABELS: Record<CandidateStatus, string> = {
  new: "Mới",
  researching: "Đang nghiên cứu",
  promising: "Tiềm năng",
  rejected: "Loại bỏ",
  promoted: "Đã thành dự án",
};

const STATUS_CLASSES: Record<CandidateStatus, string> = {
  new: "bg-sky-500/10 text-sky-700",
  researching: "bg-violet-500/10 text-violet-700",
  promising: "bg-emerald-500/10 text-emerald-700",
  rejected: "bg-slate-500/10 text-slate-600",
  promoted: "bg-teal-500/10 text-teal-700",
};

const INTENT_LABELS: Record<KeywordIntent, string> = {
  informational: "Thông tin",
  commercial: "Thương mại",
  transactional: "Giao dịch",
  navigational: "Điều hướng",
  unknown: "Chưa rõ",
};

function toKeywordInput(item: CandidateKeyword): CandidateKeywordInput {
  return {
    sourceResultId: item.sourceResultId,
    keyword: item.keyword,
    avgMonthlySearches: item.avgMonthlySearches,
    competition: item.competition,
    competitionIndex: item.competitionIndex,
    lowTopPageBid: item.lowTopPageBid,
    highTopPageBid: item.highTopPageBid,
    monthlySearches: item.monthlySearches,
    inferredIntent: item.inferredIntent,
    manualIntent: item.manualIntent,
    opportunityScore: item.opportunityScore,
    opportunityTier: item.opportunityTier,
    scoreExplanation: item.scoreExplanation,
    notes: item.notes,
    tags: item.tags,
  };
}

function DeleteCandidateButton({ candidate, onDeleted }: { candidate: CandidateProject; onDeleted: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="rounded-lg p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-600" aria-label={`Xóa ${candidate.name}`}>
          <Trash2 size={15} />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xóa dự án tiềm năng?</AlertDialogTitle>
          <AlertDialogDescription>
            Snapshot keyword của “{candidate.name}” sẽ bị xóa. Dữ liệu Google Ads gốc và dự án đã chuyển đổi không bị ảnh hưởng.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-10 rounded-xl border border-border px-4 text-sm">Hủy</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              void keywordPlannerService.deleteCandidate(candidate.id).then(onDeleted);
            }}
            className="h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white"
          >
            Xóa snapshot
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CandidateDetail({
  candidate,
  onClose,
  onUpdated,
}: {
  candidate: CandidateProject;
  onClose: () => void;
  onUpdated: (candidate: CandidateProject) => void;
}) {
  const [name, setName] = useState(candidate.name);
  const [description, setDescription] = useState(candidate.description ?? "");
  const [notes, setNotes] = useState(candidate.notes ?? "");
  const [status, setStatus] = useState<CandidateStatus>(candidate.status);
  const [tags, setTags] = useState(candidate.tags.join(", "));
  const [websiteUrl, setWebsiteUrl] = useState(candidate.websiteUrl ?? "");
  const [keywords, setKeywords] = useState(candidate.keywords);
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const updated = await keywordPlannerService.updateCandidate(candidate.id, {
        name,
        description,
        notes,
        status,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        websiteUrl: websiteUrl || null,
        keywords: keywords.map(toKeywordInput),
      });
      onUpdated(updated);
      toast.success("Đã cập nhật dự án tiềm năng");
    } catch {
      toast.error("Không thể cập nhật dự án");
    } finally {
      setSaving(false);
    }
  }

  async function promote() {
    if (!websiteUrl.trim()) {
      toast.error("Nhập website/affiliate URL trước khi chuyển thành dự án");
      return;
    }
    setPromoting(true);
    try {
      const updated = await keywordPlannerService.promoteCandidate(candidate.id, websiteUrl);
      onUpdated(updated);
      toast.success("Đã chuyển thành dự án chính thức");
    } catch {
      toast.error("Không thể chuyển dự án. Hãy kiểm tra URL.");
    } finally {
      setPromoting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/40 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-3xl flex-col border-l border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div><p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Candidate research</p><h3 className="mt-1 text-lg font-bold">{candidate.name}</h3></div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Đóng"><X size={17} /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold">Tên dự án</span><input value={name} onChange={(event) => setName(event.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label>
            <label><span className="mb-1 block text-xs font-semibold">Trạng thái</span><select value={status} onChange={(event) => setStatus(event.target.value as CandidateStatus)} disabled={candidate.status === "promoted"} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"><option value="new">Mới</option><option value="researching">Đang nghiên cứu</option><option value="promising">Tiềm năng</option><option value="rejected">Loại bỏ</option><option value="promoted">Đã thành dự án</option></select></label>
            <label><span className="mb-1 block text-xs font-semibold">Tags</span><input value={tags} onChange={(event) => setTags(event.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label>
            <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold">Website/affiliate URL</span><input value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://example.com/affiliate" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label>
            <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold">Mô tả</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" /></label>
            <label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold">Ghi chú</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" /></label>
          </div>

          <section className="overflow-hidden rounded-2xl border border-border">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3"><div><h4 className="text-sm font-semibold">Keyword đã lưu</h4><p className="text-[11px] text-muted-foreground">Có thể sửa intent thủ công hoặc loại keyword khỏi candidate.</p></div><span className="rounded-full bg-background px-2 py-1 text-xs font-semibold">{keywords.length}</span></div>
            <div className="max-h-80 divide-y divide-border overflow-y-auto">
              {keywords.map((item) => (
                <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_120px_70px_32px] items-center gap-2 px-4 py-3">
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{item.keyword}</p><p className="text-[10px] text-muted-foreground">{item.avgMonthlySearches.toLocaleString("vi-VN")} lượt/tháng · {item.competition}</p></div>
                  <select value={item.manualIntent ?? item.inferredIntent} onChange={(event) => setKeywords((current) => current.map((keyword) => keyword.id === item.id ? { ...keyword, manualIntent: event.target.value as KeywordIntent } : keyword))} className="h-8 rounded-lg border border-border bg-background px-2 text-[11px]">{(Object.keys(INTENT_LABELS) as KeywordIntent[]).map((intent) => <option key={intent} value={intent}>{INTENT_LABELS[intent]}</option>)}</select>
                  <span className="text-right text-xs font-bold text-emerald-700">{item.opportunityScore}/100</span>
                  <button onClick={() => setKeywords((current) => current.filter((keyword) => keyword.id !== item.id))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-600" aria-label={`Bỏ ${item.keyword}`}><X size={13} /></button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-5 py-4">
          <DeleteCandidateButton candidate={candidate} onDeleted={() => { toast.success("Đã xóa dự án tiềm năng"); onClose(); window.dispatchEvent(new CustomEvent("keyword-candidate-created")); }} />
          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={() => void save()} disabled={saving || !name.trim() || keywords.length === 0} className="flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />} Lưu thay đổi</button>
            {candidate.status === "promoted" ? (
              <button onClick={() => window.location.assign("/dashboard?tab=projects")} className="flex h-10 items-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white"><ExternalLink size={14} /> Mở Projects</button>
            ) : (
              <button onClick={() => void promote()} disabled={promoting} className="flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{promoting ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpRight size={14} />} Chuyển thành dự án</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CandidateProjectsView({ onCountChange }: { onCountChange: (count: number) => void }) {
  const [candidates, setCandidates] = useState<CandidateProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CandidateStatus | "">("");
  const [selected, setSelected] = useState<CandidateProject | null>(null);

  function load() {
    setLoading(true);
    keywordPlannerService.listCandidates()
      .then((response) => {
        setCandidates(response.items);
        onCountChange(response.total);
      })
      .catch(() => toast.error("Không tải được dự án tiềm năng"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let active = true;
    keywordPlannerService.listCandidates()
      .then((response) => {
        if (!active) return;
        setCandidates(response.items);
        onCountChange(response.total);
      })
      .catch(() => active && toast.error("Không tải được dự án tiềm năng"))
      .finally(() => active && setLoading(false));
    const refresh = () => {
      if (!active) return;
      setLoading(true);
      keywordPlannerService.listCandidates()
        .then((response) => {
          if (!active) return;
          setCandidates(response.items);
          onCountChange(response.total);
        })
        .finally(() => active && setLoading(false));
    };
    window.addEventListener("keyword-candidate-created", refresh);
    return () => {
      active = false;
      window.removeEventListener("keyword-candidate-created", refresh);
    };
  }, [onCountChange]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("vi");
    return candidates.filter((candidate) => {
      if (statusFilter && candidate.status !== statusFilter) return false;
      if (!needle) return true;
      return `${candidate.name} ${candidate.description ?? ""} ${candidate.tags.join(" ")}`.toLocaleLowerCase("vi").includes(needle);
    });
  }, [candidates, query, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên, mô tả hoặc tag…" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-emerald-500" /></div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as CandidateStatus | "")} className="h-10 rounded-xl border border-border bg-background px-3 text-sm"><option value="">Tất cả trạng thái</option>{(Object.keys(STATUS_LABELS) as CandidateStatus[]).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-emerald-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-20 text-center"><Bookmark size={30} className="mx-auto text-muted-foreground/40" /><p className="mt-3 text-sm font-semibold">Chưa có dự án tiềm năng</p><p className="mt-1 text-xs text-muted-foreground">Chọn keyword trong tab Khám phá và lưu lại để bắt đầu.</p></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((candidate) => {
            const totalVolume = candidate.keywords.reduce((sum, keyword) => sum + keyword.avgMonthlySearches, 0);
            const bestScore = Math.max(0, ...candidate.keywords.map((keyword) => keyword.opportunityScore));
            return (
              <article key={candidate.id} className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500/30 hover:shadow-md">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className={cn("inline-flex rounded-full px-2 py-1 text-[10px] font-semibold", STATUS_CLASSES[candidate.status])}>{STATUS_LABELS[candidate.status]}</span><h3 className="mt-2 truncate font-semibold">{candidate.name}</h3><p className="mt-1 line-clamp-2 min-h-8 text-xs leading-relaxed text-muted-foreground">{candidate.description || "Chưa có mô tả nghiên cứu."}</p></div><DeleteCandidateButton candidate={candidate} onDeleted={load} /></div>
                <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-muted/50 p-2"><p className="text-sm font-bold">{candidate.keywords.length}</p><p className="text-[9px] uppercase text-muted-foreground">Keyword</p></div><div className="rounded-xl bg-muted/50 p-2"><p className="text-sm font-bold">{new Intl.NumberFormat("vi-VN", { notation: "compact" }).format(totalVolume)}</p><p className="text-[9px] uppercase text-muted-foreground">Volume</p></div><div className="rounded-xl bg-emerald-500/10 p-2"><p className="text-sm font-bold text-emerald-700">{bestScore}/100</p><p className="text-[9px] uppercase text-emerald-700/70">Cơ hội</p></div></div>
                {candidate.tags.length > 0 && <div className="mt-3 flex items-center gap-1.5 overflow-hidden text-[10px] text-muted-foreground"><Tags size={11} />{candidate.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-full bg-muted px-2 py-0.5">{tag}</span>)}</div>}
                <button onClick={() => setSelected(candidate)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2 text-xs font-semibold transition hover:border-emerald-500/30 hover:bg-emerald-500/5 hover:text-emerald-700"><BarChart3 size={13} /> Mở nghiên cứu</button>
              </article>
            );
          })}
        </div>
      )}

      {selected && <CandidateDetail key={selected.id} candidate={selected} onClose={() => setSelected(null)} onUpdated={(updated) => { setSelected(updated); setCandidates((current) => current.map((item) => item.id === updated.id ? updated : item)); }} />}
    </div>
  );
}
