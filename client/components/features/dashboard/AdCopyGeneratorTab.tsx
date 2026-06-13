"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Copy,
  FileText,
  Link2,
  Loader2,
  Megaphone,
  Sparkles,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { adCopyService } from "@/services/adCopy.service";
import type { AdCopyGenerateResponse } from "@/types/adCopy.types";
import { cn } from "@/lib/utils";

function countClass(length: number, limit: number) {
  if (length > limit) return "text-red-600";
  if (length > limit - 5) return "text-amber-600";
  return "text-muted-foreground";
}

async function copyText(text: string, label = "Nội dung") {
  await navigator.clipboard.writeText(text);
  toast.success(`Đã copy ${label}`);
}

function ResultRow({
  value,
  limit,
  index,
}: {
  value: string;
  limit: number;
  index: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">
        {index}
      </span>
      <p className="min-w-0 flex-1 text-sm">{value}</p>
      <span className={cn("shrink-0 text-[11px] tabular-nums", countClass(value.length, limit))}>
        {value.length}/{limit}
      </span>
      <button
        onClick={() => copyText(value, "dòng này")}
        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        title="Copy"
      >
        <Copy size={14} />
      </button>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  limit,
  items,
}: {
  title: string;
  icon: React.ElementType;
  limit: number;
  items: string[];
}) {
  const joined = items.join("\n");

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[#059669]/10 text-[#059669]">
            <Icon size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="text-[11px] text-muted-foreground">
              {items.length} dòng, giới hạn {limit} ký tự
            </p>
          </div>
        </div>
        <button
          onClick={() => copyText(joined, title)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
        >
          <Copy size={13} />
          Copy tất cả
        </button>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <ResultRow key={`${item}-${index}`} value={item} limit={limit} index={index + 1} />
        ))}
      </div>
    </section>
  );
}

export function AdCopyGeneratorTab() {
  const [landingPageUrl, setLandingPageUrl] = useState("");
  const [keyword, setKeyword] = useState("");
  const [language, setLanguage] = useState<"vi" | "en">("vi");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdCopyGenerateResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!landingPageUrl.trim() || !keyword.trim()) {
      toast.error("Nhập landing page và từ khóa trước");
      return;
    }

    setLoading(true);
    try {
      const data = await adCopyService.generate({
        landingPageUrl,
        keyword,
        language,
      });
      setResult(data);
      toast.success("Đã tạo mẫu quảng cáo");
    } catch {
      toast.error("Tạo mẫu quảng cáo thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-border bg-card p-5"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#059669]/10 text-[#059669]">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold">Tạo mẫu Google Ads</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Nhập link và từ khóa, hệ thống tự quét landing page để tạo asset.
            </p>
          </div>
        </div>

        <label className="space-y-1.5">
          <span className="text-xs font-medium">Landing page URL</span>
          <input
            value={landingPageUrl}
            onChange={(e) => setLandingPageUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#059669]"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium">Từ khóa</span>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Ví dụ: affiliate marketing"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#059669]"
          />
        </label>

        <div className="grid gap-3">
          <label className="space-y-1.5">
            <span className="text-xs font-medium">Ngôn ngữ</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "vi" | "en")}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#059669]"
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#059669] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#047857] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Tạo nội dung
        </button>
      </form>

      <div className="min-w-0 rounded-xl border border-border bg-card p-5">
        {!result ? (
          <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-[#059669]/10 text-[#059669]">
              <Megaphone size={28} />
            </div>
            <h3 className="text-base font-semibold">Chưa có mẫu quảng cáo</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Dán landing page và từ khóa để quét nội dung rồi tạo bộ asset dùng cho Responsive Search Ads.
            </p>
          </div>
        ) : (
          <div className="space-y-7">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nội dung landing page đã quét
              </p>
              {result.landingPageTitle && (
                <h3 className="mt-2 text-sm font-semibold">{result.landingPageTitle}</h3>
              )}
              <p className="mt-1 text-sm text-muted-foreground">{result.landingPageSummary}</p>
            </div>
            <Section title="5 tiêu đề chứa từ khóa" icon={Sparkles} limit={30} items={result.keywordHeadlines} />
            <Section title="15 tiêu đề" icon={Type} limit={30} items={result.headlines} />
            <Section title="4 mô tả" icon={FileText} limit={90} items={result.descriptions} />

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-[#059669]/10 text-[#059669]">
                  <Link2 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">6 sitelink</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Text 25 ký tự, mỗi mô tả 35 ký tự
                  </p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {result.sitelinks.map((item, index) => (
                  <div key={`${item.text}-${index}`} className="rounded-lg border border-border bg-background p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="font-medium text-[#059669]">{item.text}</p>
                      <button
                        onClick={() =>
                          copyText(
                            [item.text, item.description1, item.description2, item.finalUrl ?? ""]
                              .filter(Boolean)
                              .join("\n"),
                            "sitelink"
                          )
                        }
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        title="Copy sitelink"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <p className="text-sm">{item.description1}</p>
                    <p className="text-sm text-muted-foreground">{item.description2}</p>
                    {item.finalUrl && (
                      <p className="mt-2 truncate text-[11px] text-muted-foreground">{item.finalUrl}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <Section title="Callout" icon={Megaphone} limit={25} items={result.callouts} />
            <Section title="Structured snippet" icon={FileText} limit={90} items={result.structuredSnippets} />

            <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-amber-900">
                <AlertTriangle size={17} />
                <h3 className="text-sm font-semibold">Gợi ý nội dung an toàn hơn</h3>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
                    Từ nên tránh
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.wordsToAvoid.map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-white px-2.5 py-1 text-xs text-amber-900 ring-1 ring-amber-200"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
                    Hướng viết an toàn
                  </p>
                  <ul className="space-y-1.5 text-sm text-amber-950">
                    {result.saferContentDirections.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <p className="rounded-lg bg-white p-3 text-sm text-amber-950 ring-1 ring-amber-200">
                {result.sensitiveContentNote}
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
