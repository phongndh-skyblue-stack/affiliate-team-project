"use client";

import { useEffect, useState, useRef } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Eye,
  Hash,
  HelpCircle,
  Loader2,
  Monitor,
  Plus,
  RefreshCw,
  Save,
  Smartphone,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PolicyWatchPanel } from "@/components/features/dashboard/PolicyWatchPanel";
import seoContentService from "@/services/seoContent.service";
import type {
  SeoContentCreate,
  SeoContentUpdate,
  SeoContentResponse,
  SeoScoreResponse,
  SeoResearchResponse,
} from "@/types/seoContent.types";

// Suggested default projects from Gemini Conversations for the user to pick easily
const PRESET_PROJECTS = [
  "Elfsight",
  "MagicSlides",
  "GEPRC",
  "Careerflow",
  "Demio",
  "iClosed",
  "ActivTrades",
  "Nexlev",
];

export function SeoContentTab() {
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [researchLoading, setResearchLoading] = useState(false);
  const [savedItems, setSavedItems] = useState<SeoContentResponse[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [userPersona, setUserPersona] = useState("");

  // Form states
  const [projectName, setProjectName] = useState("");
  const [finalUrl, setFinalUrl] = useState("https://example.com");
  const [displayPath1, setDisplayPath1] = useState("");
  const [displayPath2, setDisplayPath2] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [headlines, setHeadlines] = useState<string[]>(["", "", ""]);
  const [descriptions, setDescriptions] = useState<string[]>(["", ""]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [bodyContent, setBodyContent] = useState("");

  // Preview Mode
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(
    "mobile"
  );
  const [previewMode, setPreviewMode] = useState<"ad" | "organic">("ad");

  // SEO Score & Breakdown from API
  const [seoScoreData, setSeoScoreData] = useState<SeoScoreResponse>({
    score: 0,
    warnings: ["Chưa nhập nội dung để tính điểm"],
    keywordBreakdown: [],
  });

  const debouncingRef = useRef<NodeJS.Timeout | null>(null);

  // Load Saved History
  async function fetchHistory() {
    setHistoryLoading(true);
    try {
      const res = await seoContentService.list();
      setSavedItems(res.items);
    } catch {
      toast.error("Không tải được danh sách SEO Content đã lưu");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    fetchHistory();
  }, []);

  // Recalculate Score when inputs change
  useEffect(() => {
    if (debouncingRef.current) {
      clearTimeout(debouncingRef.current);
    }

    debouncingRef.current = setTimeout(async () => {
      // Calculate score on the fly
      try {
        const res = await seoContentService.getScore({
          seoTitle,
          metaDescription,
          headlines: headlines.filter((h) => h.trim()),
          descriptions: descriptions.filter((d) => d.trim()),
          keywords,
          bodyContent,
        });
        setSeoScoreData(res);
      } catch (err) {
        console.error("Score calc error", err);
      }
    }, 400);

    return () => {
      if (debouncingRef.current) clearTimeout(debouncingRef.current);
    };
  }, [
    seoTitle,
    metaDescription,
    headlines,
    descriptions,
    keywords,
    bodyContent,
  ]);

  // Load detailed preset/history item
  async function handleLoadItem(item: SeoContentResponse) {
    setSelectedItemId(item.id);
    setProjectName(item.projectName || "");
    setFinalUrl(item.finalUrl || "");
    
    // Parse display path
    const paths = (item.displayPath || "").split("/");
    setDisplayPath1(paths[0] || "");
    setDisplayPath2(paths[1] || "");
    
    setSeoTitle(item.seoTitle || "");
    setMetaDescription(item.metaDescription || "");
    
    // Fill headlines & descriptions ensuring minimum sizes
    const hl = [...item.headlines];
    while (hl.length < 3) hl.push("");
    setHeadlines(hl);

    const ds = [...item.descriptions];
    while (ds.length < 2) ds.push("");
    setDescriptions(ds);

    setKeywords(item.keywords || []);
    setBodyContent(item.bodyContent || "");
    setUserPersona(item.userPersona || "");
    toast.success(`Đã tải dự án: ${item.projectName || "Không tên"}`);
  }

  // Save current progress (Create or Update)
  async function handleSave() {
    if (!projectName.trim()) {
      toast.error("Vui lòng nhập tên dự án");
      return;
    }

    setLoading(true);
    const displayPath = [displayPath1.trim(), displayPath2.trim()]
      .filter(Boolean)
      .join("/");

    const payload = {
      projectName: projectName.trim(),
      finalUrl: finalUrl.trim(),
      displayPath,
      seoTitle: seoTitle.trim(),
      metaDescription: metaDescription.trim(),
      headlines: headlines.filter((h) => h.trim()),
      descriptions: descriptions.filter((d) => d.trim()),
      keywords,
      bodyContent: bodyContent.trim(),
      userPersona: userPersona.trim() || null,
    };

    try {
      if (selectedItemId) {
        const updated = await seoContentService.update(selectedItemId, payload);
        toast.success("Cập nhật SEO Content thành công!");
        setSavedItems((prev) =>
          prev.map((item) => (item.id === selectedItemId ? updated : item))
        );
      } else {
        const created = await seoContentService.create(payload);
        toast.success("Lưu SEO Content thành công!");
        setSelectedItemId(created.id);
        setSavedItems((prev) => [created, ...prev]);
      }
    } catch {
      toast.error("Lỗi khi lưu dữ liệu. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  // Delete saved SEO content
  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Bạn có chắc muốn xóa bản ghi SEO này không?")) return;

    try {
      await seoContentService.delete(id);
      toast.success("Đã xóa bản ghi");
      if (selectedItemId === id) {
        handleReset();
      }
      setSavedItems((prev) => prev.filter((item) => item.id !== id));
    } catch {
      toast.error("Lỗi khi xóa bản ghi");
    }
  }

  // Clear current form inputs
  function handleReset() {
    setSelectedItemId(null);
    setProjectName("");
    setFinalUrl("https://example.com");
    setDisplayPath1("");
    setDisplayPath2("");
    setSeoTitle("");
    setMetaDescription("");
    setHeadlines(["", "", ""]);
    setDescriptions(["", ""]);
    setKeywords([]);
    setBodyContent("");
    setUserPersona("");
  }

  // AI Deep Research — Gemini + Tavily
  async function handleAiResearch() {
    if (!projectName.trim()) {
      toast.error("Vui lòng nhập tên dự án trước khi Research");
      return;
    }
    if (!finalUrl.trim() || finalUrl === "https://example.com") {
      toast.error("Vui lòng nhập Affiliate URL trước khi Research");
      return;
    }

    setResearchLoading(true);
    const toastId = toast.loading(
      "🤖 Gemini đang phân tích dự án... (15-30 giây)"
    );

    try {
      const result: SeoResearchResponse = await seoContentService.research({
        projectName: projectName.trim(),
        affiliateUrl: finalUrl.trim(),
      });

      // Auto-fill tất cả form fields
      setKeywords(result.keywords);
      setSeoTitle(result.seoTitle);
      setMetaDescription(result.metaDescription);

      // Fill headlines — đảm bảo ít nhất 3
      const hl = [...result.headlines];
      while (hl.length < 3) hl.push("");
      setHeadlines(hl);

      // Fill descriptions — đảm bảo ít nhất 2
      const ds = [...result.descriptions];
      while (ds.length < 2) ds.push("");
      setDescriptions(ds);

      // Display path từ AI
      if (result.displayPath) {
        setDisplayPath1(result.displayPath);
        setDisplayPath2("");
      }

      // Body content
      if (result.bodyContent) setBodyContent(result.bodyContent);

      // User persona
      if (result.userPersona) setUserPersona(result.userPersona);

      // Reset selected item vì đây là content mới
      setSelectedItemId(null);

      toast.dismiss(toastId);
      toast.success(
        `✨ Research hoàn tất! Đã tạo ${result.keywords.length} keywords, ${result.headlines.length} headlines và full SEO content.`
      );
    } catch (err: unknown) {
      toast.dismiss(toastId);
      const msg =
        err instanceof Error ? err.message : "Lỗi không xác định";
      toast.error(`Research thất bại: ${msg}`);
    } finally {
      setResearchLoading(false);
    }
  }

  // Helper keyword features
  function handleAddKeyword() {
    const kw = newKeyword.trim().toLowerCase();
    if (kw && !keywords.includes(kw)) {
      setKeywords((prev) => [...prev, kw]);
      setNewKeyword("");
    }
  }

  function handleRemoveKeyword(kw: string) {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  }

  // Dynamic content highlights helper
  function highlightText(text: string | null) {
    if (!text) return "";
    if (keywords.length === 0) return text;
    
    // Create regex pattern to match any keywords case-insensitively
    const escapedKws = keywords.map((kw) =>
      kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")
    );
    const pattern = new RegExp(`\\b(${escapedKws.join("|")})\\b`, "gi");

    const parts = text.split(pattern);
    return (
      <>
        {parts.map((part, i) => {
          const isMatch = keywords.includes(part.toLowerCase());
          return isMatch ? (
            <mark
              key={i}
              className="bg-emerald-100 text-emerald-800 font-semibold px-0.5 rounded dark:bg-emerald-900/60 dark:text-emerald-300"
            >
              {part}
            </mark>
          ) : (
            part
          );
        })}
      </>
    );
  }

  // Extract display domain
  function getDisplayDomain() {
    try {
      const url = new URL(finalUrl);
      return url.hostname;
    } catch {
      return "example.com";
    }
  }

  // Circular progress SVG variables
  const radius = 45;
  const strokeWidth = 9;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (seoScoreData.score / 100) * circumference;

  const scoreColor =
    seoScoreData.score >= 80
      ? "text-emerald-500 stroke-emerald-500"
      : seoScoreData.score >= 50
      ? "text-amber-500 stroke-amber-500"
      : "text-red-500 stroke-red-500";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      
      {/* ─── Left Side: Form Controls (2 Columns) ─── */}
      <div className="xl:col-span-2 flex flex-col gap-5">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Sparkles size={16} className="text-[#059669]" /> Xây dựng Content & Quảng cáo chuẩn SEO
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Nhập tên dự án + Affiliate URL rồi nhấn <span className="font-semibold text-violet-500">Research AI</span> để tự động điền toàn bộ.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {/* AI Research Button */}
              <button
                onClick={handleAiResearch}
                disabled={researchLoading || !projectName.trim() || !finalUrl.trim() || finalUrl === "https://example.com"}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-all duration-200 shadow-sm",
                  researchLoading
                    ? "bg-violet-100 text-violet-400 dark:bg-violet-950/30 dark:text-violet-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 hover:shadow-md hover:shadow-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                {researchLoading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <BrainCircuit size={13} />
                )}
                {researchLoading ? "Đang Research..." : "Research AI"}
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition"
              >
                Làm mới
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-1.5 text-xs font-medium text-white bg-[#059669] hover:bg-[#047857] rounded-lg shadow-sm transition inline-flex items-center gap-1.5"
              >
                {loading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Save size={13} />
                )}
                {selectedItemId ? "Cập nhật" : "Lưu bản ghi"}
              </button>
            </div>
          </div>

          {/* AI Research Loading Overlay */}
          {researchLoading && (
            <div className="flex items-center gap-3 rounded-xl bg-violet-50 border border-violet-200 p-3 dark:bg-violet-950/20 dark:border-violet-900/40">
              <div className="shrink-0 size-8 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                <BrainCircuit size={16} className="text-violet-600 dark:text-violet-400 animate-pulse" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">Gemini đang phân tích...</p>
                <p className="text-[11px] text-violet-500 dark:text-violet-400">
                  Crawl trang web → Tavily research → Gemini AI → Tạo content SEO
                </p>
              </div>
              <div className="ml-auto flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 rounded-full bg-violet-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* User Persona (shown after research) */}
          {userPersona && !researchLoading && (
            <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 p-3 dark:bg-emerald-950/20 dark:border-emerald-900/40">
              <Cpu size={14} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Target Persona (AI)</p>
                <p className="text-xs text-emerald-800 dark:text-emerald-200 mt-0.5">{userPersona}</p>
              </div>
              <button
                onClick={() => setUserPersona("")}
                className="ml-auto shrink-0 text-emerald-400 hover:text-emerald-600 dark:text-emerald-600 dark:hover:text-emerald-400"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Project Selection */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Tên Dự án / Chiến dịch
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Nhập hoặc chọn dự án..."
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
                />
                {/* Quick preset chips */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {PRESET_PROJECTS.map((name) => (
                    <button
                      key={name}
                      onClick={() => setProjectName(name)}
                      className={cn(
                        "px-2 py-0.5 text-[10px] rounded border border-border bg-muted/40 hover:bg-muted transition text-muted-foreground",
                        projectName === name && "border-[#059669] bg-[#059669]/10 text-[#059669] font-medium"
                      )}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Target Keywords */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Từ khóa mục tiêu (SEO Keywords)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Thêm từ khóa..."
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddKeyword())}
                  className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
                />
                <button
                  type="button"
                  onClick={handleAddKeyword}
                  className="px-3 bg-muted border border-border rounded-xl text-xs hover:bg-muted-hover font-semibold transition"
                >
                  Thêm
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto">
                {keywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-xs border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50"
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(kw)}
                      className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Google Ads URL & Paths */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">URL & Google Ads Paths</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-foreground">Final URL</label>
              <input
                type="url"
                value={finalUrl}
                onChange={(e) => setFinalUrl(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Display Path (Google Ads)</label>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="truncate">{getDisplayDomain()}/</span>
                <input
                  type="text"
                  maxLength={15}
                  value={displayPath1}
                  placeholder="path1"
                  onChange={(e) => setDisplayPath1(e.target.value)}
                  className="h-9 w-16 text-center rounded-lg border border-border bg-background px-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
                />
                <span>/</span>
                <input
                  type="text"
                  maxLength={15}
                  value={displayPath2}
                  placeholder="path2"
                  onChange={(e) => setDisplayPath2(e.target.value)}
                  className="h-9 w-16 text-center rounded-lg border border-border bg-background px-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Title & Description Fields */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Thẻ Meta & Thân Bài (SEO Organic)</h4>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-foreground">SEO Title</label>
              <span className={cn(
                "text-[10px] font-semibold tabular-nums",
                seoTitle.length >= 40 && seoTitle.length <= 60 ? "text-emerald-500" : "text-amber-500"
              )}>
                {seoTitle.length}/60 ký tự (khuyên dùng: 40-60)
              </span>
            </div>
            <input
              type="text"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder="Nhập tiêu đề hiển thị chuẩn SEO trên Google..."
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-foreground">Meta Description</label>
              <span className={cn(
                "text-[10px] font-semibold tabular-nums",
                metaDescription.length >= 120 && metaDescription.length <= 160 ? "text-emerald-500" : "text-amber-500"
              )}>
                {metaDescription.length}/160 ký tự (khuyên dùng: 120-160)
              </span>
            </div>
            <textarea
              rows={3}
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              placeholder="Nhập đoạn mô tả hiển thị trên trang kết quả Google..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25 resize-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">Nội dung thân bài (SEO Content Body)</label>
            <textarea
              rows={6}
              value={bodyContent}
              onChange={(e) => setBodyContent(e.target.value)}
              placeholder="Dán hoặc viết bài viết của bạn tại đây để kiểm tra mật độ từ khóa..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25 resize-y"
            />
          </div>
        </div>

        {/* Google Ads Assets (Headlines & Descriptions) */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Google Ads Responsive Search Ad Assets</h4>
            <span className="text-[10px] text-muted-foreground">Tự động kết hợp ngẫu nhiên khi hiển thị</span>
          </div>

          {/* Headlines (Max 15) */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-foreground">Tiêu đề quảng cáo (Headlines - Tối thiểu 3, tối đa 15)</span>
              <button
                type="button"
                onClick={() => setHeadlines([...headlines, ""])}
                className="text-[11px] font-semibold text-[#059669] hover:underline inline-flex items-center gap-0.5"
              >
                <Plus size={11} /> Thêm tiêu đề
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {headlines.map((hl, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground w-4">{index + 1}</span>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      maxLength={30}
                      value={hl}
                      placeholder={`Tiêu đề ${index + 1}`}
                      onChange={(e) => {
                        const newHL = [...headlines];
                        newHL[index] = e.target.value;
                        setHeadlines(newHL);
                      }}
                      className="h-9 w-full rounded-lg border border-border bg-background pl-3 pr-12 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
                    />
                    <span className="absolute right-2 top-2.5 text-[9px] tabular-nums font-mono text-muted-foreground">
                      {hl.length}/30
                    </span>
                  </div>
                  {headlines.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setHeadlines(headlines.filter((_, idx) => idx !== index))}
                      className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Descriptions (Max 4) */}
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-foreground">Mô tả quảng cáo (Descriptions - Tối thiểu 2, tối đa 4)</span>
              {descriptions.length < 4 && (
                <button
                  type="button"
                  onClick={() => setDescriptions([...descriptions, ""])}
                  className="text-[11px] font-semibold text-[#059669] hover:underline inline-flex items-center gap-0.5"
                >
                  <Plus size={11} /> Thêm mô tả
                </button>
              )}
            </div>
            <div className="space-y-2">
              {descriptions.map((descText, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground w-4">{index + 1}</span>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      maxLength={90}
                      value={descText}
                      placeholder={`Mô tả ${index + 1}`}
                      onChange={(e) => {
                        const newDS = [...descriptions];
                        newDS[index] = e.target.value;
                        setDescriptions(newDS);
                      }}
                      className="h-9 w-full rounded-lg border border-border bg-background pl-3 pr-12 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
                    />
                    <span className="absolute right-2 top-2.5 text-[9px] tabular-nums font-mono text-muted-foreground">
                      {descText.length}/90
                    </span>
                  </div>
                  {descriptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setDescriptions(descriptions.filter((_, idx) => idx !== index))}
                      className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Right Side: Google Ads Live Preview & SEO Gauge ─── */}
      <div className="flex flex-col gap-5">

        {/* Google Ads Policy Watch */}
        <PolicyWatchPanel />

        {/* SEO Analyzer Panel */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Cpu size={15} className="text-[#059669]" /> Điểm SEO & Phân Tích
          </h3>

          <div className="flex items-center gap-5 bg-muted/40 p-4 rounded-xl border border-border">
            {/* Score circle */}
            <div className="relative size-24 shrink-0 flex items-center justify-center">
              <svg className="size-full -rotate-90">
                <circle
                  cx={48}
                  cy={48}
                  r={radius}
                  className="stroke-border"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
                <circle
                  cx={48}
                  cy={48}
                  r={radius}
                  className={scoreColor}
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold leading-none">{seoScoreData.score}</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">/100</span>
              </div>
            </div>

            {/* Score Summary Text */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">
                {seoScoreData.score >= 80
                  ? "Tối ưu hóa tuyệt vời!"
                  : seoScoreData.score >= 50
                  ? "Có thể tối ưu thêm"
                  : "SEO quá thấp"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Điểm SEO được chấm tự động dựa trên thẻ meta, mật độ từ khóa và chất lượng phân phối quảng cáo Google Ads.
              </p>
            </div>
          </div>

          {/* Keyword density breakdown */}
          {seoScoreData.keywordBreakdown.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mật độ Từ Khóa Mục Tiêu</p>
              <div className="max-h-36 overflow-y-auto space-y-1.5 border border-border rounded-lg p-2.5 bg-muted/20">
                {seoScoreData.keywordBreakdown.map((item) => (
                  <div key={item.keyword} className="text-xs border-b border-border/40 pb-1.5 last:border-b-0 last:pb-0">
                    <div className="flex justify-between items-center font-medium">
                      <span className="text-[#059669] font-mono">{item.keyword}</span>
                      <span className="text-muted-foreground text-[10px]">{item.bodyDensity}% mật độ body</span>
                    </div>
                    <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[9px] mt-1 text-muted-foreground">
                      <span className={cn("inline-flex items-center gap-0.5", item.foundInTitle ? "text-emerald-500 font-semibold" : "text-slate-400")}>
                        ● Title
                      </span>
                      <span className={cn("inline-flex items-center gap-0.5", item.foundInDescription ? "text-emerald-500 font-semibold" : "text-slate-400")}>
                        ● Description
                      </span>
                      <span className={cn("inline-flex items-center gap-0.5", item.foundInHeadlines ? "text-emerald-500 font-semibold" : "text-slate-400")}>
                        ● Ads assets
                      </span>
                      <span className={cn("inline-flex items-center gap-0.5", item.foundInBody ? "text-emerald-500 font-semibold" : "text-slate-400")}>
                        ● Body
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings & Suggestions */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cảnh báo & Đề xuất</p>
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {seoScoreData.warnings.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40">
                  <CheckCircle2 size={13} className="shrink-0" />
                  <span>Không phát hiện lỗi tối ưu SEO nào. Tuyệt vời!</span>
                </div>
              ) : (
                seoScoreData.warnings.map((warning, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 p-2.5 rounded-lg dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-500" />
                    <span>{warning}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Realtime SERP & Google Ads Search Preview */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 pb-3 border-b border-border/40">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 whitespace-nowrap">
              <Eye size={16} className="text-[#059669]" /> Live Google Search Preview
            </h3>
            
            {/* View Config Controls */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex rounded-lg border border-border bg-muted/40 p-0.5 text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setPreviewMode("ad")}
                  className={cn(
                    "px-3 py-1 rounded-md transition-all duration-150",
                    previewMode === "ad" ? "bg-[#059669] text-white shadow-sm" : "hover:text-foreground text-muted-foreground"
                  )}
                >
                  Ad
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("organic")}
                  className={cn(
                    "px-3 py-1 rounded-md transition-all duration-150",
                    previewMode === "organic" ? "bg-[#059669] text-white shadow-sm" : "hover:text-foreground text-muted-foreground"
                  )}
                >
                  SEO
                </button>
              </div>

              <div className="flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  className={cn(
                    "p-1 px-1.5 rounded-md transition-all duration-150",
                    previewDevice === "mobile" ? "bg-[#059669] text-white shadow-sm" : "hover:text-foreground text-muted-foreground"
                  )}
                >
                  <Smartphone size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("desktop")}
                  className={cn(
                    "p-1 px-1.5 rounded-md transition-all duration-150",
                    previewDevice === "desktop" ? "bg-[#059669] text-white shadow-sm" : "hover:text-foreground text-muted-foreground"
                  )}
                >
                  <Monitor size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Device Mockup Shell */}
          <div className="bg-muted/20 border border-border rounded-xl p-3 flex items-center justify-center overflow-auto min-h-[220px]">
            {previewDevice === "mobile" ? (
              // Mobile Mockup Shell
              <div className="w-[300px] border-[6px] border-slate-700 rounded-[24px] bg-background shadow-lg overflow-hidden flex flex-col shrink-0">
                {/* Mobile top status bar */}
                <div className="bg-slate-700 h-4 px-4 flex justify-between items-center text-[8px] text-white font-mono">
                  <span>9:41 AM</span>
                  <div className="flex items-center gap-1">
                    <span>LTE</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* Google Mobile result content */}
                <div className="p-3 font-sans text-left space-y-2.5">
                  {/* Google Logo / Searchbox bar */}
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <span className="text-sm font-extrabold tracking-tight text-blue-500 font-mono">G<span className="text-red-500">o</span><span className="text-yellow-500">o</span><span className="text-blue-500">g</span><span className="text-green-500">l</span><span className="text-red-500">e</span></span>
                    <div className="h-6 flex-1 rounded-full border border-border bg-muted/40 px-2 flex items-center justify-between">
                      <span className="text-[9px] text-muted-foreground truncate">{keywords[0] || "search..."}</span>
                      <span className="text-[8px] text-slate-400">🔍</span>
                    </div>
                  </div>

                  {/* Search Result */}
                  <div className="space-y-1">
                    {/* Header info */}
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-700 dark:text-slate-300">
                      {previewMode === "ad" ? (
                        <span className="font-bold text-[9px] border border-slate-400 px-1 py-0.2 rounded shrink-0">Sponsored</span>
                      ) : (
                        <div className="size-4 rounded-full bg-slate-100 flex items-center justify-center text-[7px] text-slate-600 font-bold shrink-0">
                          {getDisplayDomain().slice(0,2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-[9px] truncate">{projectName || "Advertiser"}</p>
                        <p className="text-[8px] text-slate-500 truncate">
                          {getDisplayDomain()}
                          {displayPath1 && `/${displayPath1}`}
                          {displayPath2 && `/${displayPath2}`}
                        </p>
                      </div>
                    </div>

                    {/* Result Title */}
                    <h5 className="text-xs text-[#1a0dab] hover:underline cursor-pointer leading-snug font-medium dark:text-[#8ab4f8]">
                      {previewMode === "ad" ? (
                        highlightText(
                          headlines.filter((h) => h.trim()).join(" | ") || "Tiêu đề mẫu Google Ads 1 | Tiêu đề mẫu 2"
                        )
                      ) : (
                        highlightText(seoTitle || "Tiêu đề SEO hiển thị trên kết quả tự nhiên Google")
                      )}
                    </h5>

                    {/* Snippet Description */}
                    <p className="text-[10px] text-slate-600 leading-normal dark:text-slate-400">
                      {previewMode === "ad" ? (
                        highlightText(
                          descriptions.filter((d) => d.trim()).join(" ") || "Đây là đoạn mô tả mẫu khi quảng cáo hiển thị trên Google Search..."
                        )
                      ) : (
                        highlightText(metaDescription || "Đoạn meta description hiển thị của trang khi được Google index tự nhiên. Vui lòng nhập để xem trước...")
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              // Desktop Preview
              <div className="w-full max-w-[500px] border border-border rounded-lg bg-background p-4 shadow-sm text-left font-sans shrink-0">
                <div className="space-y-1">
                  {/* Header info */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-800 dark:text-slate-200">
                    {previewMode === "ad" && (
                      <span className="font-bold text-[9px] border border-slate-400 px-1.5 py-0.2 rounded shrink-0">Sponsored</span>
                    )}
                    <span className="truncate">
                      {finalUrl}
                      {displayPath1 && `/${displayPath1}`}
                      {displayPath2 && `/${displayPath2}`}
                    </span>
                  </div>

                  {/* Title */}
                  <h5 className="text-sm text-[#1a0dab] hover:underline cursor-pointer font-medium leading-tight dark:text-[#8ab4f8]">
                    {previewMode === "ad" ? (
                      highlightText(
                        headlines.filter((h) => h.trim()).join(" | ") || "Tiêu đề mẫu Google Ads 1 | Tiêu đề mẫu 2"
                      )
                    ) : (
                      highlightText(seoTitle || "Tiêu đề SEO hiển thị trên kết quả tự nhiên Google")
                    )}
                  </h5>

                  {/* Snippet */}
                  <p className="text-xs text-slate-600 leading-relaxed dark:text-slate-400">
                    {previewMode === "ad" ? (
                      highlightText(
                        descriptions.filter((d) => d.trim()).join(" ") || "Đây là đoạn mô tả mẫu khi quảng cáo hiển thị trên Google Search..."
                      )
                    ) : (
                      highlightText(metaDescription || "Đoạn meta description hiển thị của trang khi được Google index tự nhiên. Vui lòng nhập để xem trước...")
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Saved SEO Content Records */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lịch sử bản ghi đã lưu ({savedItems.length})</h4>
            <button
              onClick={fetchHistory}
              disabled={historyLoading}
              className="p-1 rounded text-muted-foreground hover:bg-muted"
            >
              <RefreshCw size={11} className={cn(historyLoading && "animate-spin")} />
            </button>
          </div>
          
          <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
            {savedItems.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4">Chưa có bản ghi nào được lưu</div>
            ) : (
              savedItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleLoadItem(item)}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-lg border border-border/60 hover:bg-muted/40 cursor-pointer transition text-xs",
                    selectedItemId === item.id && "bg-[#059669]/10 border-[#059669]/40 text-[#059669]"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{item.projectName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{item.seoTitle || "Không có tiêu đề"}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-bold">Score: {item.seoScore}</span>
                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default SeoContentTab;
