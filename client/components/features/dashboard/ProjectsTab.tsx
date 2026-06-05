"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FolderOpen, Info, Loader2, Plus, Radar, SearchCheck } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { affiliateProjectService } from "@/services/affiliateProject.service";
import type {
  AffiliateLinkDetailResponse,
  AffiliateLinkModel,
  ScanAffiliateProjectResponse,
  ScanTrafficResponse,
  TrafficCountryItem,
  TrafficGlobalItem,
  TrafficSocialItem,
  TrafficSourceItem,
} from "@/types/affiliateProject.types";

const CHART_COLORS = ["#059669", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#4b5563"];

function formatVisits(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDuration(seconds?: number | null): string {
  const value = Math.max(0, Math.round(seconds || 0));
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  if (minutes <= 0) return `${rest}s`;
  return `${minutes}m ${rest.toString().padStart(2, "0")}s`;
}

function latestTrafficMonth(): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 2);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function defaultStartPeriodForMonths(months: number): string {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - (Math.max(1, months) + 1));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(period: string, offset: number): string {
  const [yearText, monthText] = period.split("-");
  const date = new Date(Number(yearText), Number(monthText) - 1, 1);
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function requestedPeriodRange(startPeriod: string, months: number): string {
  const latest = latestTrafficMonth();
  const end = addMonths(startPeriod, Math.max(1, months) - 1);
  return `${startPeriod} - ${end > latest ? latest : end}`;
}

function sourceRows(source?: TrafficSourceItem | null) {
  if (!source) return [];
  const labels: Array<[keyof TrafficSourceItem, string]> = [
    ["direct", "Direct"],
    ["organic_search", "Organic"],
    ["paid_search", "Paid"],
    ["referrals", "Referral"],
    ["social", "Social"],
    ["display_ads", "Display"],
    ["email", "Email"],
  ];
  return labels
    .map(([key, label]) => ({
      name: label,
      value: Number(source[key] || 0),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

function socialRows(items?: TrafficSocialItem[] | null) {
  if (!items) return [];
  return items
    .map((item) => ({
      name: item.platform_name,
      value: Number(item.share_percentage || 0),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

function globalRows(
  items?: TrafficGlobalItem[] | null,
  startPeriod?: string,
  months?: number,
) {
  const sorted = [...(items || [])].sort((a, b) => a.period_month.localeCompare(b.period_month));
  if (!startPeriod || !months) return sorted;
  const byPeriod = new Map(sorted.map((item) => [item.period_month, item]));
  const latest = latestTrafficMonth();
  const rows: TrafficGlobalItem[] = [];
  for (let index = 0; index < months; index += 1) {
    const period = addMonths(startPeriod, index);
    if (period > latest) break;
    rows.push(
      byPeriod.get(period) ?? {
        period_month: period,
        total_visits_monthly: 0,
        avg_visits_monthly: 0,
        unique_visits_monthly: 0,
        repeat_visits_monthly: 0,
        pages_per_visit: 0,
        avg_visit_duration: 0,
        bounce_rate_percentage: 0,
      }
    );
  }
  return rows.length > 0 ? rows : sorted;
}

function topCountries(countries?: TrafficCountryItem[]): TrafficCountryItem[] {
  if (!countries || countries.length === 0) return [];
  return [...countries]
    .sort((a, b) => b.traffic_share_percentage - a.traffic_share_percentage)
    .slice(0, 5);
}

function toTrafficResponse(detail: AffiliateLinkDetailResponse): ScanTrafficResponse | null {
  const latest = detail.traffic_scans[0];
  if (!latest) return null;

  return {
    domain: detail.affiliate_link.domain,
    url: detail.affiliate_link.affiliate_url,
    found: latest.found,
    monthly_visits: latest.monthly_visits,
    period_month: latest.period_month,
    traffic_details: latest.traffic_details,
  };
}

function toProjectResponse(
  detail: AffiliateLinkDetailResponse
): ScanAffiliateProjectResponse | null {
  const latest = detail.project_data_scans[0];
  if (!latest) return null;

  return {
    website: detail.affiliate_link.affiliate_url,
    domain: detail.affiliate_link.domain,
    query: latest.query,
    project_name: latest.project_name,
    project_link: latest.project_link,
    event_content: latest.event_content,
    sale_content: latest.sale_content,
    top_countries: latest.top_countries || [],
    answer: latest.answer,
    results: latest.results || [],
  };
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function TrafficPie({
  title,
  data,
}: {
  title: string;
  data: Array<{ name: string; value: number }>;
}) {
  if (data.length === 0) return null;
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="grid gap-3 md:grid-cols-[160px_1fr] md:items-center">
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={36} outerRadius={58} paddingAngle={2}>
                {data.map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1.5">
          {data.slice(0, 7).map((item, index) => (
            <div key={item.name} className="flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="font-medium">{item.value.toFixed(2)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProjectsTab() {
  const [links, setLinks] = useState<AffiliateLinkModel[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [selectedLink, setSelectedLink] = useState<AffiliateLinkModel | null>(null);
  const [detail, setDetail] = useState<AffiliateLinkDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [scanningTraffic, setScanningTraffic] = useState(false);
  const [scanningProject, setScanningProject] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLinkInput, setNewLinkInput] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [trafficMonths, setTrafficMonths] = useState(4);
  const [trafficStartPeriod, setTrafficStartPeriod] = useState(() => defaultStartPeriodForMonths(4));
  const [trafficCustomStart, setTrafficCustomStart] = useState(false);

  const trafficResult = useMemo(() => (detail ? toTrafficResponse(detail) : null), [detail]);
  const projectResult = useMemo(() => (detail ? toProjectResponse(detail) : null), [detail]);
  const topTrafficCountries = useMemo(
    () => topCountries(trafficResult?.traffic_details?.country),
    [trafficResult]
  );
  const effectiveTrafficStartPeriod = trafficCustomStart
    ? trafficStartPeriod
    : defaultStartPeriodForMonths(trafficMonths);
  const globalTraffic = useMemo(
    () => globalRows(trafficResult?.traffic_details?.global, effectiveTrafficStartPeriod, trafficMonths),
    [trafficResult, effectiveTrafficStartPeriod, trafficMonths]
  );
  const latestGlobal = globalTraffic.at(-1);
  const trafficSources = useMemo(
    () => sourceRows(trafficResult?.traffic_details?.source),
    [trafficResult]
  );
  const socialTraffic = useMemo(
    () => socialRows(trafficResult?.traffic_details?.social),
    [trafficResult]
  );
  const trafficPeriodLabel = requestedPeriodRange(effectiveTrafficStartPeriod, trafficMonths);
  const availablePeriodLabel =
    trafficResult?.traffic_details?.global && trafficResult.traffic_details.global.length > 0
      ? `${globalRows(trafficResult.traffic_details.global)[0].period_month} - ${globalRows(trafficResult.traffic_details.global).at(-1)?.period_month}`
      : trafficResult?.period_month ?? "-";
  const isBusy = scanningTraffic || scanningProject || savingLink;

  // Load danh sách links khi mount
  useEffect(() => {
    let cancelled = false;
    async function loadLinks() {
      setLoadingLinks(true);
      try {
        const data = await affiliateProjectService.getAffiliateLinks();
        if (cancelled) return;
        setLinks(data);
        if (data.length > 0) setSelectedLink(data[0]);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingLinks(false);
      }
    }
    void loadLinks();
    return () => { cancelled = true; };
  }, []);

  // Load detail khi đổi link đang chọn
  useEffect(() => {
    if (!selectedLink) return;
    let cancelled = false;
    async function loadDetail() {
      setLoadingDetail(true);
      setDetail(null);
      try {
        const data = await affiliateProjectService.getAffiliateLinkDetail(selectedLink!.affiliate_url);
        if (!cancelled) setDetail(data);
      } catch {
        if (!cancelled) setDetail(null);
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    }
    void loadDetail();
    return () => { cancelled = true; };
  }, [selectedLink]);

  async function handleAddLink() {
    const trimmed = newLinkInput.trim();
    if (!trimmed) return;
    setSavingLink(true);
    try {
      const created = await affiliateProjectService.createAffiliateLink({ website: trimmed });
      const updatedLinks = await affiliateProjectService.getAffiliateLinks();
      setLinks(updatedLinks);
      setSelectedLink(updatedLinks.find((l) => l.id === created.id) ?? created);
      setNewLinkInput("");
      setShowAddForm(false);
      toast.success("Đã thêm affiliate link");
    } catch {
      toast.error("Thêm affiliate link thất bại");
    } finally {
      setSavingLink(false);
    }
  }

  async function handleScanTraffic() {
    if (!detail) return;
    const startPeriod = trafficCustomStart ? trafficStartPeriod : defaultStartPeriodForMonths(trafficMonths);
    setTrafficStartPeriod(startPeriod);
    setScanningTraffic(true);
    const toastId = toast.loading(`Đang quét traffic từ ${startPeriod} (${trafficMonths} tháng)...`);
    try {
      await affiliateProjectService.scanTraffic({
        affiliate_link_id: detail.affiliate_link.id,
        months: trafficMonths,
        start_period: startPeriod || undefined,
      });
      const refreshed = await affiliateProjectService.getAffiliateLinkDetail(detail.affiliate_link.affiliate_url);
      setDetail(refreshed);
      toast.success("Quét traffic thành công", { id: toastId });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Quét traffic thất bại", { id: toastId });
    } finally {
      setScanningTraffic(false);
    }
  }

  async function handleScanProject() {
    if (!detail) return;
    setScanningProject(true);
    try {
      await affiliateProjectService.scanAffiliateProject({
        affiliate_link_id: detail.affiliate_link.id,
        max_results: 10,
        search_depth: "advanced",
        include_raw_content: true,
      });
      const refreshed = await affiliateProjectService.getAffiliateLinkDetail(detail.affiliate_link.affiliate_url);
      setDetail(refreshed);
      toast.success("Quét dữ liệu dự án thành công");
    } catch {
      toast.error("Quét dữ liệu dự án thất bại");
    } finally {
      setScanningProject(false);
    }
  }

  return (
    <div className="flex h-full gap-4">
      {/* ── Cột trái: danh sách links ── */}
      <div className="flex w-52 shrink-0 flex-col gap-2">
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#059669] px-3 py-2 text-sm font-medium text-white hover:bg-[#047857] transition-colors"
        >
          <Plus size={14} />
          Thêm link mới
        </button>

        {showAddForm && (
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <input
              type="text"
              value={newLinkInput}
              onChange={(e) => setNewLinkInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleAddLink()}
              placeholder="https://..."
              autoFocus
              className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
            />
            <div className="flex gap-1.5">
              <button
                onClick={() => void handleAddLink()}
                disabled={savingLink || !newLinkInput.trim()}
                className="flex-1 rounded-lg bg-[#059669] py-1.5 text-xs font-medium text-white hover:bg-[#047857] disabled:opacity-60 transition-colors"
              >
                {savingLink ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Lưu"}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewLinkInput(""); }}
                className="flex-1 rounded-lg border border-border py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                Huỷ
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-1">
          {loadingLinks ? (
            <div className="flex justify-center py-8">
              <Loader2 size={18} className="animate-spin text-[#059669]" />
            </div>
          ) : links.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">Chưa có link nào</p>
          ) : (
            links.map((link) => {
              const isActive = selectedLink?.id === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => setSelectedLink(link)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                    isActive
                      ? "bg-[#059669]/10 ring-1 ring-[#059669]/30"
                      : "hover:bg-muted"
                  }`}
                >
                  <p className={`truncate text-sm font-medium ${isActive ? "text-[#047857]" : ""}`}>
                    {link.domain}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                    {link.affiliate_url}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Cột phải: detail ── */}
      <div className="flex-1 min-w-0 space-y-4 overflow-y-auto">
        {!selectedLink ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-border bg-card text-sm text-muted-foreground">
            <FolderOpen size={18} className="mr-2 opacity-40" />
            Chọn một affiliate link để xem chi tiết
          </div>
        ) : loadingDetail ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-card">
            <Loader2 size={20} className="animate-spin text-[#059669]" />
          </div>
        ) : (
          <>
            {/* Header + nút quét */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#059669]/10">
                      <FolderOpen size={15} className="text-[#059669]" />
                    </div>
                    <h2 className="text-base font-semibold">{selectedLink.domain}</h2>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 ml-10">
                    <a
                      href={selectedLink.affiliate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-xs text-[#059669] hover:underline max-w-sm"
                    >
                      {selectedLink.affiliate_url}
                    </a>
                    <ExternalLink size={10} className="shrink-0 text-[#059669]" />
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-1.5">
                    <label className="text-[11px] text-muted-foreground">
                      Từ tháng
                      <input
                        type="month"
                        value={trafficStartPeriod}
                        max={latestTrafficMonth()}
                        onChange={(event) => {
                          setTrafficCustomStart(true);
                          setTrafficStartPeriod(event.target.value);
                        }}
                        disabled={isBusy}
                        className="ml-2 h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-[#059669]/20"
                      />
                    </label>
                    <select
                      value={trafficMonths}
                      onChange={(event) => {
                        const months = Number(event.target.value);
                        setTrafficMonths(months);
                        setTrafficCustomStart(false);
                        setTrafficStartPeriod(defaultStartPeriodForMonths(months));
                      }}
                      disabled={isBusy}
                      className="h-7 rounded-md border border-border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-[#059669]/20"
                    >
                      {[1, 2, 3, 4, 6, 12].map((value) => (
                        <option key={value} value={value}>{value} tháng</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => void handleScanTraffic()}
                    disabled={isBusy}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#059669] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#047857] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {scanningTraffic ? <Loader2 size={14} className="animate-spin" /> : <Radar size={14} />}
                    Quét lại Traffic
                  </button>
                  <button
                    onClick={() => void handleScanProject()}
                    disabled={isBusy}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#059669]/30 bg-[#059669]/10 px-3.5 py-2 text-sm font-medium text-[#047857] hover:bg-[#059669]/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {scanningProject ? <Loader2 size={14} className="animate-spin" /> : <SearchCheck size={14} />}
                    Quét lại Dự Án
                  </button>
                </div>
              </div>
            </section>

            {/* Traffic */}
            {trafficResult ? (
              <section className="rounded-2xl border border-border bg-card p-5">
                <h3 className="mb-3 text-sm font-semibold">Traffic</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-[11px] text-muted-foreground">Domain</p>
                    <p className="mt-1 text-sm font-semibold">{trafficResult.domain}</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-[11px] text-muted-foreground">Monthly Visits</p>
                    <p className="mt-1 text-sm font-semibold">{formatVisits(trafficResult.monthly_visits)}</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-[11px] text-muted-foreground">Period đã chọn</p>
                    <p className="mt-1 text-sm font-semibold">{trafficPeriodLabel}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Có data: {availablePeriodLabel}</p>
                  </div>
                </div>
                {topTrafficCountries.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Top 5 Quốc Gia Traffic
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {topTrafficCountries.map((item) => (
                        <div key={`${item.country_code}-${item.country_name}`} className="rounded-lg border border-border px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{item.country_name}</span>
                            <span className="text-xs text-muted-foreground">{item.traffic_share_percentage.toFixed(2)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {globalTraffic.length > 0 && (
                  <div className="mt-4 rounded-xl border border-border p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Monthly trend</p>
                      <span className="text-xs text-muted-foreground">
                        {globalTraffic[0].period_month} - {globalTraffic[globalTraffic.length - 1].period_month}
                      </span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <MiniMetric label="Unique Visits" value={formatCompact(latestGlobal?.unique_visits_monthly || 0)} />
                      <MiniMetric label="Repeat Visits" value={formatCompact(latestGlobal?.repeat_visits_monthly || 0)} />
                      <MiniMetric label="Pages / Visit" value={(latestGlobal?.pages_per_visit || 0).toFixed(2)} />
                      <MiniMetric label="Avg Duration" value={formatDuration(latestGlobal?.avg_visit_duration)} />
                    </div>
                    <div className="mt-3 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={globalTraffic} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="period_month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(value) => formatCompact(Number(value))} />
                          <Tooltip
                            formatter={(value, name) => [
                              formatVisits(Number(value)),
                              name === "total_visits_monthly" ? "Total visits" : "Unique visits",
                            ]}
                            labelFormatter={(label) => `Period ${label}`}
                          />
                          <Line type="monotone" dataKey="total_visits_monthly" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="unique_visits_monthly" stroke="#2563eb" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {topTrafficCountries.length > 0 && (
                  <div className="mt-4 rounded-xl border border-border p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Country share chart</p>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topTrafficCountries} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
                          <YAxis type="category" dataKey="country_name" width={96} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                          <Bar dataKey="traffic_share_percentage" radius={[0, 6, 6, 0]} fill="#059669" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {topTrafficCountries.map((item) => (
                        <div key={`${item.country_code}-${item.country_name}-detail`} className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-medium text-foreground">{item.country_name}</span>
                            <span>{item.traffic_share_percentage.toFixed(2)}%</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                            <span>{formatCompact(item.total_visits_monthly || 0)} visits</span>
                            <span>{item.pages_per_visit.toFixed(2)} pages</span>
                            <span>{formatDuration(item.avg_visit_duration)}</span>
                            <span>{item.bounce_rate_percentage.toFixed(2)}% bounce</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(trafficSources.length > 0 || socialTraffic.length > 0) && (
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <TrafficPie title="Traffic sources" data={trafficSources} />
                    <TrafficPie title="Social traffic" data={socialTraffic} />
                  </div>
                )}
              </section>
            ) : (
              <section className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 p-5 text-sm text-muted-foreground">
                <Radar size={15} />
                Chưa có dữ liệu traffic — bấm &quot;Quét lại Traffic&quot; để bắt đầu
              </section>
            )}

            {/* Thông tin dự án */}
            {projectResult ? (
              <section className="rounded-2xl border border-border bg-card p-5">
                <h3 className="mb-3 text-sm font-semibold">Thông Tin Dự Án</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="text-muted-foreground">Project:</span> {projectResult.project_name || "—"}</p>
                  <p>
                    <span className="text-muted-foreground">Project Link:</span>{" "}
                    {projectResult.project_link ? (
                      <a href={projectResult.project_link} target="_blank" rel="noopener noreferrer" className="text-[#059669] hover:underline break-all">
                        {projectResult.project_link}
                      </a>
                    ) : "—"}
                  </p>
                  <p><span className="text-muted-foreground">Event:</span> {projectResult.event_content || "—"}</p>
                  <p><span className="text-muted-foreground">Sale:</span> {projectResult.sale_content || "—"}</p>
                </div>

                {projectResult.top_countries.length > 0 && (
                  <div className="mt-4">
                    <div className="group relative mb-2 inline-flex items-center gap-1.5">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Top 5 Quốc Gia (Tín Hiệu Từ Web)
                      </p>
                      <Info size={13} className="shrink-0 text-muted-foreground/60 cursor-help" />
                      <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-80 rounded-xl border border-border bg-popover p-3.5 text-xs text-popover-foreground shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        <p className="mb-2 font-semibold text-foreground">Cách tính Signal Score</p>
                        <p className="mb-1.5 font-medium text-foreground/80">4 nhóm signal chính:</p>
                        <ul className="space-y-1.5 text-muted-foreground">
                          <li><span className="font-medium text-foreground/80">Text mention</span> (×2) — quét answer, title, content, raw_content; so khớp alias quốc gia (ví dụ: <em>united states, usa, us, vietnam, vn</em>…)</li>
                          <li><span className="font-medium text-foreground/80">ccTLD trong URL</span> (×3) — regex lấy đuôi URL (<em>.vn, .jp, .sg</em>…) rồi map qua bảng <code className="rounded bg-muted px-0.5">_CC_TLD_TO_COUNTRY</code></li>
                          <li><span className="font-medium text-foreground/80">hreflang</span> (×3) — tìm pattern <em>hreflang=en-US, vi-VN</em> trong text, lấy mã quốc gia phía sau</li>
                          <li><span className="font-medium text-foreground/80">Câu trụ sở / chi nhánh</span> (×4) — câu chứa <em>headquarter, head office, based in, branch, office in</em> kèm alias quốc gia</li>
                        </ul>
                        <p className="mt-2 text-muted-foreground/80">Mỗi lần bắt signal → cộng điểm theo trọng số → sort giảm dần → lấy top 5.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {projectResult.top_countries.map((country) => (
                        <div key={country.country} className="rounded-lg border border-border px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{country.country}</span>
                            <span className="text-xs text-muted-foreground">Signal {country.signal_score}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            ) : (
              <section className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 p-5 text-sm text-muted-foreground">
                <SearchCheck size={15} />
                Chưa có dữ liệu dự án — bấm &quot;Quét lại Dự Án&quot; để bắt đầu
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
