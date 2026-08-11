"use client";

import { useEffect, useState } from "react";
import { Globe2, Hash, Link2, Loader2, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { CustomSelect } from "@/components/common/CustomSelect";
import { affiliateProjectService } from "@/services/affiliateProject.service";
import { keywordPlannerService } from "@/services/keywordPlanner.service";
import type { AffiliateLinkModel } from "@/types/affiliateProject.types";
import type { AdsAccountResponse, JobResultsResponse } from "@/types/keywordPlanner.types";
import { cn } from "@/lib/utils";

const LANGUAGE_OPTIONS = [
  { value: 1000, label: "English" },
  { value: 1019, label: "Tiếng Việt" },
  { value: 1023, label: "日本語" },
  { value: 1012, label: "한국어" },
  { value: 1002, label: "中文（简体）" },
];

const LOCATION_OPTIONS = [
  { value: "", label: "Tất cả thị trường" },
  { value: "2704", label: "Việt Nam" },
  { value: "2840", label: "Hoa Kỳ" },
  { value: "2826", label: "Vương quốc Anh" },
  { value: "2124", label: "Canada" },
  { value: "2036", label: "Úc" },
];

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

interface KeywordResearchFormProps {
  onDone: (result: JobResultsResponse) => void;
}

export function KeywordResearchForm({ onDone }: KeywordResearchFormProps) {
  const [accounts, setAccounts] = useState<AdsAccountResponse[]>([]);
  const [projects, setProjects] = useState<AffiliateLinkModel[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"keywords" | "url">("keywords");
  const [adsId, setAdsId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [keywords, setKeywords] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [useEntireSite, setUseEntireSite] = useState(true);
  const [languageId, setLanguageId] = useState(1000);
  const [locationId, setLocationId] = useState("");
  const [resultLimit, setResultLimit] = useState(500);

  useEffect(() => {
    let active = true;
    Promise.all([
      keywordPlannerService.listAccounts(),
      affiliateProjectService.getAffiliateLinks(),
    ])
      .then(([accountResponse, projectResponse]) => {
        if (!active) return;
        setAccounts(accountResponse.items);
        setProjects(projectResponse);
        setAdsId((current) => current || accountResponse.items[0]?.adsId || "");
      })
      .catch(() => active && toast.error("Không tải được tài khoản Google Ads"))
      .finally(() => active && setLoadingData(false));
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!adsId) {
      toast.error("Hãy ủy quyền và chọn một tài khoản Google Ads trước");
      return;
    }
    const locationIds = locationId ? [Number(locationId)] : [];
    setLoading(true);
    try {
      const result = mode === "keywords"
        ? await keywordPlannerService.scanByKeywords({
            adsId,
            keywords: keywords.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean),
            pageUrl: normalizeUrl(pageUrl) || undefined,
            languageId,
            locationIds,
            resultLimit,
            projectId: projectId || undefined,
          })
        : await keywordPlannerService.scanByUrl({
            adsId,
            pageUrl: normalizeUrl(pageUrl),
            useEntireSite,
            languageId,
            locationIds,
            resultLimit,
            projectId: projectId || undefined,
          });
      onDone(result);
      toast.success(`Đã tìm thấy ${result.results.length.toLocaleString("vi-VN")} keyword`);
    } catch {
      toast.error("Không thể lấy dữ liệu Keyword Planner. Hãy kiểm tra quyền Google Ads.");
    } finally {
      setLoading(false);
    }
  }

  const noAccounts = !loadingData && accounts.length === 0;

  return (
    <aside className="h-fit rounded-2xl border border-border bg-card shadow-sm lg:sticky lg:top-4">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <SlidersHorizontal size={16} />
          </span>
          Thiết lập nghiên cứu
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Dữ liệu trực tiếp từ tài khoản Google Ads đã ủy quyền.</p>
      </div>

      <form onSubmit={submit} className="space-y-4 p-5">
        <div>
          <label className="mb-1.5 block text-xs font-semibold">Tài khoản Google Ads</label>
          <CustomSelect
            value={adsId}
            onChange={setAdsId}
            options={accounts.map((account) => ({
              value: account.adsId,
              label: `${account.adsName} · ${account.adsId}`,
            }))}
            placeholder={loadingData ? "Đang tải tài khoản…" : "Chưa có tài khoản"}
            showSearch
            disabled={loadingData || noAccounts}
          />
          {noAccounts && (
            <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              Chưa có tài khoản khả dụng. Mở tab Ủy quyền Mail để kết nối Google Ads.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold">Gắn dự án hiện có</label>
          <CustomSelect
            value={projectId}
            onChange={(value) => {
              const next = String(value || "");
              setProjectId(next);
              const project = projects.find((item) => item.id === next);
              if (project) setPageUrl(project.affiliate_url);
            }}
            options={projects.map((project) => ({
              value: project.id,
              label: project.name || project.domain,
            }))}
            placeholder="Nghiên cứu dự án mới"
            clearable
            clearText="Không gắn dự án"
          />
        </div>

        <div className="grid grid-cols-2 rounded-xl bg-muted p-1">
          {([
            ["keywords", "Từ khóa", Hash],
            ["url", "Website", Link2],
          ] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition",
                mode === value ? "bg-background text-emerald-700 shadow-sm" : "text-muted-foreground"
              )}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {mode === "keywords" && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold">Keyword gốc</label>
            <textarea
              value={keywords}
              onChange={(event) => setKeywords(event.target.value)}
              rows={5}
              required
              placeholder={"vpn affiliate\nbest password manager\ncloud storage"}
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Mỗi dòng hoặc phân tách bằng dấu phẩy.</p>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-semibold">
            URL {mode === "keywords" && <span className="font-normal text-muted-foreground">(tùy chọn)</span>}
          </label>
          <input
            value={pageUrl}
            onChange={(event) => setPageUrl(event.target.value)}
            required={mode === "url"}
            placeholder="example.com hoặc URL sản phẩm"
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
          />
          {mode === "url" && (
            <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={useEntireSite}
                onChange={(event) => setUseEntireSite(event.target.checked)}
                className="size-4 accent-emerald-600"
              />
              Phân tích toàn bộ website
            </label>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold">Ngôn ngữ</label>
            <CustomSelect value={languageId} onChange={(value) => setLanguageId(Number(value))} options={LANGUAGE_OPTIONS} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold">Thị trường</label>
            <CustomSelect value={locationId} onChange={setLocationId} options={LOCATION_OPTIONS} />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
            <span>Giới hạn kết quả</span>
            <span className="font-mono text-emerald-700">{resultLimit}</span>
          </div>
          <input
            type="range"
            min={50}
            max={2000}
            step={50}
            value={resultLimit}
            onChange={(event) => setResultLimit(Number(event.target.value))}
            className="w-full accent-emerald-600"
          />
        </div>

        <button
          type="submit"
          disabled={loading || noAccounts}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          {loading ? "Đang lấy dữ liệu…" : "Khám phá keyword"}
        </button>

        <div className="flex items-start gap-2 rounded-xl bg-sky-500/10 px-3 py-2 text-[11px] leading-relaxed text-sky-700">
          <Globe2 size={14} className="mt-0.5 shrink-0" />
          Keyword Planner chỉ đọc dữ liệu nghiên cứu; không tạo chiến dịch hoặc sử dụng ngân sách Ads.
        </div>
      </form>
    </aside>
  );
}
