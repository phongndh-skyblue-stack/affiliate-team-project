"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Clock3, Database, History, Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { keywordPlannerService } from "@/services/keywordPlanner.service";
import type { JobResponse, JobResultsResponse, KeywordIdeaItem } from "@/types/keywordPlanner.types";
import { KeywordResearchForm } from "./keyword-planner/KeywordResearchForm";
import {
  KeywordResultsWorkspace,
  type CandidateDraft,
} from "./keyword-planner/KeywordResultsWorkspace";
import { candidateKeywordFromIdea } from "./keyword-planner/keywordPlanner.utils";

function HistoryList({
  jobs,
  loading,
  onOpen,
}: {
  jobs: JobResponse[];
  loading: boolean;
  onOpen: (job: JobResponse) => void;
}) {
  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-emerald-600" /></div>;
  }
  if (!jobs.length) {
    return (
      <div className="py-12 text-center">
        <History size={28} className="mx-auto text-muted-foreground/35" />
        <p className="mt-3 text-sm font-medium">Chưa có lịch sử nghiên cứu</p>
        <p className="mt-1 text-xs text-muted-foreground">Bắt đầu với keyword hoặc website ở bảng bên trái.</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-border">
      {jobs.slice(0, 12).map((job) => (
        <button
          key={job.id}
          onClick={() => onOpen(job)}
          disabled={job.status !== "done"}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            {job.inputType === "keywords" ? <Search size={15} /> : <Database size={15} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {job.inputType === "keywords" ? job.keywords?.join(", ") : job.pageUrl}
            </span>
            <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
              <Clock3 size={11} /> {new Date(job.createdAt).toLocaleString("vi-VN")}
              <span>·</span> {job.resultCount.toLocaleString("vi-VN")} keyword
            </span>
          </span>
          <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
            {job.status === "done" ? "Sẵn sàng" : job.status === "error" ? "Lỗi" : "Đang chạy"}
          </span>
          {job.status === "done" && <ArrowRight size={14} className="text-muted-foreground" />}
        </button>
      ))}
    </div>
  );
}

export function KeywordPlannerTab() {
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [result, setResult] = useState<JobResultsResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    keywordPlannerService.listJobs(0, 100)
      .then((response) => {
        if (active) setJobs(response.items);
      })
      .catch(() => active && toast.error("Không tải được lịch sử Keyword Planner"))
      .finally(() => active && setHistoryLoading(false));
    return () => {
      active = false;
    };
  }, []);

  function acceptResult(next: JobResultsResponse) {
    setResult(next);
    setSelectedIds(new Set());
    setJobs((current) => [next.job, ...current.filter((job) => job.id !== next.job.id)]);
  }

  async function openJob(job: JobResponse) {
    try {
      acceptResult(await keywordPlannerService.getJobResults(job.id));
    } catch {
      toast.error("Không thể mở snapshot keyword này");
    }
  }

  async function saveCandidate(items: KeywordIdeaItem[], draft: CandidateDraft) {
    if (!result) return;
    setSaving(true);
    try {
      await keywordPlannerService.createCandidate({
        name: draft.name,
        description: draft.description || undefined,
        notes: draft.notes || undefined,
        tags: draft.tags,
        status: draft.status,
        websiteUrl: draft.websiteUrl || undefined,
        languageId: result.job.languageId,
        locationIds: result.job.locationIds ?? [],
        sourceAdsId: result.job.adsId ?? undefined,
        sourceJobId: result.job.id,
        keywords: items.map(candidateKeywordFromIdea),
      });
      setSelectedIds(new Set());
      toast.success("Đã lưu dự án tiềm năng cùng snapshot keyword");
      window.dispatchEvent(new CustomEvent("keyword-candidate-created"));
    } catch {
      toast.error("Không thể lưu dự án tiềm năng");
      throw new Error("candidate-save-failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.08] via-background to-sky-500/[0.06] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              <Sparkles size={14} /> Google Ads intelligence
            </div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Khám phá cơ hội từ khóa</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Phân tích nhu cầu, cạnh tranh, CPC và xu hướng để tìm dự án affiliate mới đáng nghiên cứu.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background/80 px-3 py-2 text-xs text-muted-foreground shadow-sm">
            <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
            Dữ liệu Google Ads đã ủy quyền
          </div>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]">
        <KeywordResearchForm onDone={acceptResult} />

        {result ? (
          <KeywordResultsWorkspace
            result={result}
            selectedIds={selectedIds}
            onSelectedChange={setSelectedIds}
            onSave={saveCandidate}
            saving={saving}
          />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-gradient-to-r from-muted/50 to-transparent px-5 py-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><History size={15} className="text-emerald-600" /> Nghiên cứu gần đây</h3>
              <p className="mt-1 text-xs text-muted-foreground">Mở lại snapshot hoặc bắt đầu một nghiên cứu mới.</p>
            </div>
            <HistoryList jobs={jobs} loading={historyLoading} onOpen={openJob} />
          </section>
        )}
      </div>

      {result && (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><History size={14} className="text-emerald-600" /> Lịch sử nghiên cứu</h3></div>
          <HistoryList jobs={jobs} loading={historyLoading} onOpen={openJob} />
        </section>
      )}
    </div>
  );
}
