"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
  Hash,
  Clapperboard,
  Image as ImageIcon,
  Link2,
  Database,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import socialCaptionService from "@/services/socialCaption.service";
import seoContentService from "@/services/seoContent.service";
import { searchAdsService } from "@/services/searchAds.service";
import type {
  CaptionVariant,
  PlatformOption,
  GoalOption,
  LanguageOption,
} from "@/types/socialCaption.types";
import type { SeoContentResponse } from "@/types/seoContent.types";
import type { SearchAdsHistoryItem } from "@/types/searchAds.types";

const FALLBACK_PLATFORMS: PlatformOption[] = [
  { value: "facebook", label: "Facebook", charLimit: 63206, hookCutoff: 477 },
  { value: "instagram", label: "Instagram", charLimit: 2200, hookCutoff: 125 },
  { value: "tiktok", label: "TikTok", charLimit: 2200, hookCutoff: 100 },
  { value: "linkedin", label: "LinkedIn", charLimit: 3000, hookCutoff: 210 },
  { value: "threads", label: "Threads", charLimit: 500, hookCutoff: 500 },
  { value: "x", label: "X (Twitter)", charLimit: 280, hookCutoff: 280 },
];
const FALLBACK_GOALS: GoalOption[] = [
  { value: "sales", label: "Bán hàng" },
  { value: "education", label: "Giáo dục" },
  { value: "community", label: "Cộng đồng" },
  { value: "engagement", label: "Tăng tương tác" },
  { value: "announcement", label: "Thông báo" },
];
const FALLBACK_LANGUAGES: LanguageOption[] = [
  { value: "auto", label: "Tự động (theo thị trường)" },
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "Tiếng Anh" },
];

const selectClass =
  "w-full rounded-lg border border-border bg-background py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30";
const inputClass = selectClass;

export function SocialCaptionTab() {
  const [platforms, setPlatforms] = useState<PlatformOption[]>(FALLBACK_PLATFORMS);
  const [goals, setGoals] = useState<GoalOption[]>(FALLBACK_GOALS);
  const [languages, setLanguages] = useState<LanguageOption[]>(FALLBACK_LANGUAGES);

  const [platform, setPlatform] = useState("facebook");
  const [goal, setGoal] = useState("sales");
  const [language, setLanguage] = useState("auto");
  const [variants, setVariants] = useState(1);
  const [idea, setIdea] = useState("");
  const [segment, setSegment] = useState("");
  const [brandName, setBrandName] = useState("");
  const [tone, setTone] = useState("");
  const [affiliateUrl, setAffiliateUrl] = useState("");

  // Giai đoạn 2 — nối ống dữ liệu
  const [keywords, setKeywords] = useState<string[]>([]);
  const [competitorAngles, setCompetitorAngles] = useState<string[]>([]);
  const [seoProjects, setSeoProjects] = useState<SeoContentResponse[]>([]);
  const [selectedSeoId, setSelectedSeoId] = useState("");
  const [adScans, setAdScans] = useState<SearchAdsHistoryItem[]>([]);
  const [selectedScanId, setSelectedScanId] = useState("");

  const [loading, setLoading] = useState(false);
  const [captions, setCaptions] = useState<CaptionVariant[]>([]);
  const [complianceNotes, setComplianceNotes] = useState<string[]>([]);
  const [detectedIndustries, setDetectedIndustries] = useState<string[]>([]);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    socialCaptionService
      .getOptions()
      .then((res) => {
        if (res.platforms?.length) setPlatforms(res.platforms);
        if (res.goals?.length) setGoals(res.goals);
        if (res.languages?.length) setLanguages(res.languages);
      })
      .catch(() => {});
    // Nối ống: nạp dự án SEO (Research AI) + lịch sử quét đối thủ
    seoContentService.list().then((res) => setSeoProjects(res.items)).catch(() => {});
    searchAdsService.getHistory("all").then((res) => setAdScans(res.items)).catch(() => {});
  }, []);

  function handleLoadSeoProject(id: string) {
    setSelectedSeoId(id);
    if (!id) return;
    const p = seoProjects.find((x) => x.id === id);
    if (!p) return;
    if (p.projectName) {
      setBrandName(p.projectName);
      setIdea((prev) => prev.trim() || `Giới thiệu ${p.projectName}`);
    }
    if (p.userPersona) setSegment(p.userPersona);
    if (p.finalUrl) setAffiliateUrl(p.finalUrl);
    if (p.keywords?.length) setKeywords(p.keywords);
    toast.success(`Đã nạp persona & keyword từ "${p.projectName || "dự án"}"`);
  }

  function handleLoadCompetitors(scanId: string) {
    setSelectedScanId(scanId);
    if (!scanId) return;
    const scan = adScans.find((x) => x.id === scanId);
    if (!scan) return;
    const angles = Array.from(
      new Set((scan.ads || []).map((a) => (a.title || "").trim()).filter(Boolean))
    ).slice(0, 10);
    if (angles.length === 0) {
      toast.error("Lần quét này chưa có tiêu đề quảng cáo đối thủ");
      return;
    }
    setCompetitorAngles(angles);
    toast.success(`Đã nạp ${angles.length} góc đối thủ từ "${scan.keyword}"`);
  }

  async function handleGenerate() {
    if (!idea.trim()) {
      toast.error("Vui lòng nhập ý tưởng/chủ đề cần viết");
      return;
    }
    setLoading(true);
    const toastId = toast.loading("Đang viết caption với AI...");
    try {
      const res = await socialCaptionService.generate({
        platform,
        goal,
        idea: idea.trim(),
        segment: segment.trim() || null,
        brandName: brandName.trim() || null,
        language,
        tone: tone.trim() || null,
        affiliateUrl: affiliateUrl.trim() || null,
        variants,
        keywords,
        competitorAngles,
      });
      setCaptions(res.captions);
      setComplianceNotes(res.complianceNotes);
      setDetectedIndustries(res.detectedIndustries);
      setPlaceholders(res.placeholders);
      toast.dismiss(toastId);
      toast.success(`Đã tạo ${res.captions.length} caption!`);
    } catch (err: unknown) {
      toast.dismiss(toastId);
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Vui lòng thử lại.";
      toast.error(`Tạo caption thất bại: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(c: CaptionVariant, idx: number) {
    const hashtagLine = c.hashtags.length ? "\n\n" + c.hashtags.map((h) => `#${h}`).join(" ") : "";
    const text = c.content + hashtagLine;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      toast.success("Đã copy caption");
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      {/* ─── Form ─── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
            <Sparkles size={16} className="text-[#059669]" /> Social Caption Writer
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Sinh caption đa nền tảng đúng format & char-limit, tự kiểm tra compliance, giữ nguyên affiliate link.
          </p>
        </div>

        {/* Nguồn dữ liệu — nối ống từ Research AI & Quét quảng cáo */}
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 space-y-2.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Nguồn dữ liệu (tùy chọn)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Database size={11} /> Nạp từ dự án SEO
              </label>
              <select
                value={selectedSeoId}
                onChange={(e) => handleLoadSeoProject(e.target.value)}
                className={cn(selectClass, "py-1.5 text-xs")}
              >
                <option value="">— Chọn dự án (persona, keyword) —</option>
                {seoProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.projectName || "Không tên"}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Users size={11} /> Nạp góc đối thủ
              </label>
              <select
                value={selectedScanId}
                onChange={(e) => handleLoadCompetitors(e.target.value)}
                className={cn(selectClass, "py-1.5 text-xs")}
              >
                <option value="">— Chọn lần quét quảng cáo —</option>
                {adScans.map((s) => (
                  <option key={s.id} value={s.id}>{s.keyword} · {s.ads?.length || 0} ads</option>
                ))}
              </select>
            </div>
          </div>

          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 rounded-md bg-[#059669]/10 text-[#059669] px-2 py-0.5 text-[11px]">
                  <Hash size={10} />{k}
                  <button onClick={() => setKeywords((prev) => prev.filter((x) => x !== k))}><X size={10} /></button>
                </span>
              ))}
            </div>
          )}
          {competitorAngles.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground">Góc đối thủ (AI sẽ tạo khác biệt):</p>
              <div className="flex flex-wrap gap-1.5">
                {competitorAngles.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 px-2 py-0.5 text-[11px] max-w-[220px] truncate">
                    {a}
                    <button onClick={() => setCompetitorAngles((prev) => prev.filter((_, idx) => idx !== i))}><X size={10} /></button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nền tảng</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={selectClass}>
              {platforms.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Mục tiêu</label>
            <select value={goal} onChange={(e) => setGoal(e.target.value)} className={selectClass}>
              {goals.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Ngôn ngữ</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className={selectClass}>
              {languages.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Số biến thể (A/B)</label>
            <select value={variants} onChange={(e) => setVariants(Number(e.target.value))} className={selectClass}>
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Ý tưởng / chủ đề / sản phẩm <span className="text-red-500">*</span></label>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={3}
            placeholder="Vd: Khóa học tiếng Anh online cho người đi làm bận rộn..."
            className={cn(inputClass, "resize-y")}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Đối tượng / persona</label>
          <input value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="Vd: Nhân viên văn phòng 25-35, ít thời gian" className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Thương hiệu</label>
            <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Tên brand" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tone (tùy chọn)</label>
            <input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Vd: thân thiện, chuyên nghiệp" className={inputClass} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Affiliate URL (giữ nguyên trong CTA)</label>
          <input value={affiliateUrl} onChange={(e) => setAffiliateUrl(e.target.value)} placeholder="https://...?ref=..." className={inputClass} />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !idea.trim()}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#059669] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#047857] disabled:opacity-60 transition-colors"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          Viết caption
        </button>
      </div>

      {/* ─── Kết quả ─── */}
      <div className="flex flex-col gap-4">
        {detectedIndustries.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <AlertTriangle size={13} /> Ngành nhạy cảm: {detectedIndustries.join(", ")}
            </p>
            {complianceNotes.length > 0 && (
              <ul className="mt-2 space-y-1">
                {complianceNotes.map((n, i) => (
                  <li key={i} className="text-[11px] text-amber-800 dark:text-amber-300 flex gap-1.5">
                    <ShieldCheck size={12} className="mt-0.5 shrink-0" /> {n}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {placeholders.length > 0 && (
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
            <span className="font-semibold">Cần điền thêm:</span> {placeholders.join(" · ")}
          </div>
        )}

        {captions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <Sparkles size={26} className="mx-auto mb-2 opacity-40" />
            Nhập ý tưởng và bấm "Viết caption" để bắt đầu.
          </div>
        ) : (
          captions.map((c, idx) => (
            <div key={idx} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <span className="rounded-md bg-[#059669]/10 text-[#059669] px-2 py-0.5 font-medium">
                    Variant {idx + 1}
                  </span>
                  {c.segment && <span className="text-muted-foreground">{c.segment}</span>}
                  <span className={cn(
                    "rounded-md px-2 py-0.5 font-medium",
                    c.withinLimit ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-red-100 text-red-700"
                  )}>
                    {c.charCount}/{c.charLimit} ký tự
                  </span>
                  {!c.withinHookCutoff && (
                    <span className="rounded-md bg-amber-100 text-amber-700 px-2 py-0.5" title={`Hook nên ≤ ${c.hookCutoff} ký tự`}>
                      ⚠ Hook hơi dài
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleCopy(c, idx)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted transition-colors"
                >
                  {copiedIdx === idx ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  Copy
                </button>
              </div>

              {c.hookOnScreen && (
                <div className="rounded-lg bg-violet-50 dark:bg-violet-950/30 px-3 py-2 text-xs text-violet-800 dark:text-violet-200 flex items-center gap-1.5">
                  <Clapperboard size={13} /> <span className="font-semibold">Hook on-screen:</span> {c.hookOnScreen}
                </div>
              )}

              <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">{c.content}</p>

              {c.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {c.hashtags.map((h) => (
                    <span key={h} className="text-[11px] text-[#059669] inline-flex items-center">
                      <Hash size={10} />{h}
                    </span>
                  ))}
                </div>
              )}

              {c.visualSuggestion && (
                <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <ImageIcon size={12} className="mt-0.5 shrink-0" /> {c.visualSuggestion}
                </p>
              )}
              {c.ctaLink && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                  <Link2 size={12} className="shrink-0" /> {c.ctaLink}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default SocialCaptionTab;
