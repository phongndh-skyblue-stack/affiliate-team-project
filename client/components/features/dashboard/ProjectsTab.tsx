"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Copy,
  ExternalLink,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  Radar,
  SearchCheck,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  XCircle,
  Check,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { affiliateProjectService } from "@/services/affiliateProject.service";
import { CustomSelect } from "@/components/common/CustomSelect";
import type {
  AffiliateLinkDetailResponse,
  AffiliateLinkModel,
  RestrictedCountryInsight,
  ScanAffiliateProjectResponse,
  ScanTrafficResponse,
  TopCountryInsight,
  TrafficCountryItem,
  TrafficGlobalItem,
  TrafficSourceItem,
  TrafficSocialItem,
  AffiliateLinkTrafficModel,
} from "@/types/affiliateProject.types";

type CheckStatus = "good" | "warn" | "missing";

interface LaunchInsight {
  readinessScore: number;
  priorityCountries: TrafficCountryItem[];
  excludedTrafficCountries: TrafficCountryItem[];
  checks: Array<{
    label: string;
    status: CheckStatus;
    text: string;
  }>;
}

interface AdCopy {
  finalUrl?: string;
  brandKeywords: string[];
  headlines: string[];
  descriptions: string[];
  sitelinks: Array<{
    text: string;
    url: string;
    description1: string;
    description2: string;
  }>;
}

const RESTRICTION_TOKENS = [
  "restricted",
  "banned",
  "prohibited",
  "not available",
  "ineligible",
  "not allowed",
  "blocked",
  "excluded",
];

const SCAN_SLOW_WARNING_MS = 30_000;
const TRAFFIC_SCAN_TIMEOUT_MS = 75_000;
const PROJECT_SCAN_TIMEOUT_MS = 90_000;
const TOP_TRAFFIC_COUNTRY_LIMIT = 10;
const MAINTENANCE_MESSAGE = "Tính năng đang bảo trì, vui lòng thử lại sau.";

function isCanceledRequest(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; name?: string };
  return candidate.code === "ERR_CANCELED" || candidate.name === "CanceledError";
}

const GENERIC_PHRASES = new Set([
  "privacy policy",
  "terms of use",
  "log in",
  "sign up",
  "cookie policy",
]);

const FEATURE_PHRASES = [
  "AI video generator",
  "online video editor",
  "video editor",
  "image editor",
  "photo editor",
  "background remover",
  "auto captions",
  "text to speech",
  "speech to text",
  "video templates",
  "design templates",
  "team collaboration",
  "cloud storage",
  "copy trading",
  "futures trading",
  "spot trading",
  "crypto exchange",
  "affiliate program",
  "referral program",
  "mobile app",
  "desktop app",
];

function formatVisits(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value || 0);
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function formatPercent(value: number, digits = 2): string {
  return `${new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value || 0)}%`;
}

function toChartNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}


function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeCountry(value: string): string {
  return normalizeText(value).replace(/[^a-z\s]/g, "");
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function titleCase(value: string): string {
  return value
    .split(/[\s.-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function truncate(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  const shortened = trimmed.slice(0, max + 1);
  const wordBoundary = shortened.lastIndexOf(" ");
  return shortened.slice(0, wordBoundary > max * 0.65 ? wordBoundary : max).trimEnd();
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const cleaned = value.replace(/\s+/g, " ").trim();
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
  }
  return output;
}

function getResultText(result: Record<string, unknown>): string {
  return [
    result.title,
    result.content,
    result.raw_content,
    result.snippet,
  ]
    .filter((item) => typeof item === "string")
    .join(" ");
}

function resultString(result: Record<string, unknown>, key: string): string | null {
  const value = result[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function aggregateTrafficScans(detail: AffiliateLinkDetailResponse, selectedPeriods: string[]): ScanTrafficResponse | null {
  const scans = detail.traffic_scans.filter(s => selectedPeriods.includes(s.period_month));
  if (!scans.length) return null;

  const base = scans[0];
  const totalMonthlyVisits = scans.reduce((sum, s) => sum + (s.monthly_visits || 0), 0);

  let totalUnique = 0;
  let totalRepeat = 0;
  let sumPages = 0;
  let sumDuration = 0;
  let sumBounce = 0;

  const countryMap = new Map<string, TrafficCountryItem>();
  const countryMetricMap = new Map<string, {
    visits: number;
    pages: number;
    duration: number;
    bounce: number;
  }>();
  const socialMap = new Map<string, number>();

  const sourceSum: TrafficSourceItem = {
    period_month: selectedPeriods.join(", "),
    organic_search: 0,
    social: 0,
    email: 0,
    display_ads: 0,
    direct: 0,
    referrals: 0,
    paid_search: 0,
  };

  for (const s of scans) {
    const weight = s.monthly_visits || 0;

    const g = s.traffic_details?.global?.[0];
    if (g) {
      totalUnique += g.unique_visits_monthly || 0;
      totalRepeat += g.repeat_visits_monthly || 0;
      sumPages += (g.pages_per_visit || 0) * weight;
      sumDuration += (g.avg_visit_duration || 0) * weight;
      sumBounce += (g.bounce_rate_percentage || 0) * weight;
    }

    for (const c of s.traffic_details?.country || []) {
      const countryVisits =
        c.total_visits_monthly || (weight > 0 ? weight * ((c.traffic_share_percentage || 0) / 100) : 0);
      const existing = countryMap.get(c.country_code) || {
        country_code: c.country_code,
        country_name: c.country_name,
        traffic_share_percentage: 0,
        total_visits_monthly: 0,
        pages_per_visit: 0,
        avg_visit_duration: 0,
        bounce_rate_percentage: 0,
      };
      existing.total_visits_monthly = (existing.total_visits_monthly || 0) + countryVisits;
      countryMap.set(c.country_code, existing);

      const metrics = countryMetricMap.get(c.country_code) || {
        visits: 0,
        pages: 0,
        duration: 0,
        bounce: 0,
      };
      metrics.visits += countryVisits;
      metrics.pages += (c.pages_per_visit || 0) * countryVisits;
      metrics.duration += (c.avg_visit_duration || 0) * countryVisits;
      metrics.bounce += (c.bounce_rate_percentage || 0) * countryVisits;
      countryMetricMap.set(c.country_code, metrics);
    }

    const src = s.traffic_details?.source;
    if (src) {
      const srcWeight = weight / 100;
      sourceSum.organic_search += (src.organic_search || 0) * srcWeight;
      sourceSum.social += (src.social || 0) * srcWeight;
      sourceSum.email += (src.email || 0) * srcWeight;
      sourceSum.display_ads += (src.display_ads || 0) * srcWeight;
      sourceSum.direct += (src.direct || 0) * srcWeight;
      sourceSum.referrals += (src.referrals || 0) * srcWeight;
      sourceSum.paid_search += (src.paid_search || 0) * srcWeight;
    }

    for (const soc of s.traffic_details?.social || []) {
      const share = soc.share_percentage || 0;
      const current = socialMap.get(soc.platform_name) || 0;
      socialMap.set(soc.platform_name, current + share * weight);
    }
  }

  const aggregatedCountries = Array.from(countryMap.values()).map(c => {
    const metrics = countryMetricMap.get(c.country_code);
    const visits = metrics?.visits || 0;

    return {
      ...c,
      traffic_share_percentage: totalMonthlyVisits > 0 ? ((c.total_visits_monthly || 0) / totalMonthlyVisits) * 100 : 0,
      pages_per_visit: visits > 0 ? (metrics?.pages || 0) / visits : c.pages_per_visit,
      avg_visit_duration: visits > 0 ? (metrics?.duration || 0) / visits : c.avg_visit_duration,
      bounce_rate_percentage: visits > 0 ? (metrics?.bounce || 0) / visits : c.bounce_rate_percentage,
    };
  });

  if (totalMonthlyVisits > 0) {
    sourceSum.organic_search = (sourceSum.organic_search / totalMonthlyVisits) * 100;
    sourceSum.social = (sourceSum.social / totalMonthlyVisits) * 100;
    sourceSum.email = (sourceSum.email / totalMonthlyVisits) * 100;
    sourceSum.display_ads = (sourceSum.display_ads / totalMonthlyVisits) * 100;
    sourceSum.direct = (sourceSum.direct / totalMonthlyVisits) * 100;
    sourceSum.referrals = (sourceSum.referrals / totalMonthlyVisits) * 100;
    sourceSum.paid_search = (sourceSum.paid_search / totalMonthlyVisits) * 100;
  }

  const globalItem: TrafficGlobalItem = {
    period_month: selectedPeriods.join(", "),
    total_visits_monthly: totalMonthlyVisits,
    avg_visits_monthly: totalMonthlyVisits / scans.length,
    unique_visits_monthly: totalUnique,
    repeat_visits_monthly: totalRepeat,
    pages_per_visit: totalMonthlyVisits > 0 ? sumPages / totalMonthlyVisits : 0,
    avg_visit_duration: totalMonthlyVisits > 0 ? sumDuration / totalMonthlyVisits : 0,
    bounce_rate_percentage: totalMonthlyVisits > 0 ? sumBounce / totalMonthlyVisits : 0,
  };

  const socialStats: TrafficSocialItem[] = Array.from(socialMap.entries()).map(([platform_name, totalWeightedShare]) => ({
    platform_name,
    share_percentage: totalMonthlyVisits > 0 ? totalWeightedShare / totalMonthlyVisits : 0
  }));

  return {
    domain: detail.affiliate_link.domain,
    url: detail.affiliate_link.affiliate_url,
    found: base.found,
    monthly_visits: totalMonthlyVisits,
    period_month: selectedPeriods.join(", "),
    traffic_details: {
      global: [globalItem],
      country: aggregatedCountries,
      source: sourceSum,
      social: socialStats
    }
  };
}

function toProjectResponse(detail: AffiliateLinkDetailResponse): ScanAffiliateProjectResponse | null {
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
    restricted_countries: latest.restricted_countries || [],
    top_countries: latest.top_countries || [],
    answer: latest.answer,
    results: latest.results || [],
    ad_copy: latest.ad_copy,
  };
}

function getTopTrafficCountries(countries?: TrafficCountryItem[]): TrafficCountryItem[] {
  return [...(countries || [])]
    .sort((a, b) => b.traffic_share_percentage - a.traffic_share_percentage)
    .slice(0, TOP_TRAFFIC_COUNTRY_LIMIT);
}

function getTrafficCountryChartData(countries: TrafficCountryItem[]) {
  return countries.map((country) => ({
    name: country.country_name,
    share: country.traffic_share_percentage,
    visits: country.total_visits_monthly || 0,
    pages: country.pages_per_visit || 0,
    duration: country.avg_visit_duration || 0,
    bounce: country.bounce_rate_percentage || 0,
  }));
}

function getLatestTrafficGlobal(traffic: ScanTrafficResponse | null) {
  const rows = traffic?.traffic_details?.global || [];
  return [...rows].sort((a, b) => b.period_month.localeCompare(a.period_month))[0] || null;
}

function getTrafficSourceData(traffic: ScanTrafficResponse | null) {
  const source = traffic?.traffic_details?.source;
  if (!source) return [];

  const rows = [
    { name: "Truy cập trực tiếp", share: toChartNumber(source.direct) },
    { name: "Tìm kiếm tự nhiên", share: toChartNumber(source.organic_search) },
    { name: "Tìm kiếm trả phí", share: toChartNumber(source.paid_search) },
    { name: "Giới thiệu", share: toChartNumber(source.referrals) },
    { name: "Quảng cáo hiển thị", share: toChartNumber(source.display_ads) },
    { name: "Mạng xã hội", share: toChartNumber(source.social) },
    { name: "Email", share: toChartNumber(source.email) },
  ];
  const total = rows.reduce((sum, item) => sum + item.share, 0);
  if (total > 100.5) {
    return rows.map((item) => ({
      ...item,
      share: total > 0 ? (item.share / total) * 100 : 0,
    }));
  }

  return rows;
}

function getTrafficSocialData(traffic: ScanTrafficResponse | null) {
  const rows = [...(traffic?.traffic_details?.social || [])]
    .map((item) => {
      const rawShare = item.share_percentage ?? 0;
      const share = rawShare > 0 && rawShare <= 1 ? rawShare * 100 : rawShare;
      return {
        name: item.platform_name,
        share: toChartNumber(share),
      };
    })
    .filter((item) => item.name && item.share > 0)
    .sort((a, b) => b.share - a.share);
  return rows.slice(0, 6);
}

function isRestrictedCountry(countryName: string, restricted: RestrictedCountryInsight[]): boolean {
  const normalized = normalizeCountry(countryName);
  return restricted.some((item) => {
    const restrictedName = normalizeCountry(item.country);
    return (
      restrictedName === normalized ||
      restrictedName.includes(normalized) ||
      normalized.includes(restrictedName)
    );
  });
}

function buildLaunchInsight(
  traffic: ScanTrafficResponse | null,
  project: ScanAffiliateProjectResponse | null
): LaunchInsight {
  const topTraffic = getTopTrafficCountries(traffic?.traffic_details?.country);
  const restricted = project?.restricted_countries || [];
  const priorityCountries = topTraffic.filter((country) => !isRestrictedCountry(country.country_name, restricted)).slice(0, 4);
  const excludedTrafficCountries = topTraffic.filter((country) => isRestrictedCountry(country.country_name, restricted)).slice(0, 4);

  const hasTraffic = (traffic?.monthly_visits || 0) > 0;
  const hasPriorityCountries = priorityCountries.length > 0;
  const hasOffer = Boolean(project?.event_content || project?.sale_content);
  const hasRestrictions = restricted.length > 0;

  const score = clamp(
    (traffic?.monthly_visits || 0) >= 100000 ? 30 : hasTraffic ? 18 : 0,
  )
    + (hasPriorityCountries ? 25 : 0)
    + (hasOffer ? 20 : 0)
    + (hasRestrictions ? 15 : 0)
    + (project?.project_link ? 10 : 0)
    - (excludedTrafficCountries.length > 0 ? 10 : 0);

  return {
    readinessScore: clamp(score),
    priorityCountries,
    excludedTrafficCountries,
    checks: [
      {
        label: "Market ưu tiên",
        status: hasPriorityCountries ? "good" : "missing",
        text: hasPriorityCountries
          ? priorityCountries.map((country) => country.country_name).join(", ")
          : "Chưa có traffic country đủ an toàn để ưu tiên.",
      },
      {
        label: "Loại trừ địa lý",
        status: hasRestrictions ? "good" : "warn",
        text: hasRestrictions
          ? `${restricted.length} quốc gia cần kiểm tra hoặc loại trừ.`
          : "Chưa phát hiện restriction, vẫn nên kiểm tra Terms thủ công.",
      },
      {
        label: "Offer để chạy ads",
        status: hasOffer ? "good" : "missing",
        text: hasOffer ? "Có event hoặc sale content để biến thành thông điệp ads." : "Chưa có offer rõ ràng.",
      },
      {
        label: "Rủi ro traffic bị loại",
        status: excludedTrafficCountries.length > 0 ? "warn" : hasTraffic ? "good" : "missing",
        text:
          excludedTrafficCountries.length > 0
            ? excludedTrafficCountries.map((country) => country.country_name).join(", ")
            : hasTraffic
              ? "Top traffic chưa trùng restriction đã phát hiện."
              : "Chưa có dữ liệu traffic để đánh giá.",
      },
    ],
  };
}

function fallbackEvidence(country: RestrictedCountryInsight, project: ScanAffiliateProjectResponse): NonNullable<RestrictedCountryInsight["evidence_links"]> {
  const countryKey = normalizeText(country.country);
  const links: NonNullable<RestrictedCountryInsight["evidence_links"]> = [];
  const seenUrls = new Set<string>();

  for (const result of project.results || []) {
    const text = getResultText(result);
    const lowered = normalizeText(text);
    const url = resultString(result, "url");
    if (!url || seenUrls.has(url)) continue;
    if (!lowered.includes(countryKey)) continue;
    if (!RESTRICTION_TOKENS.some((token) => lowered.includes(token))) continue;

    const index = lowered.indexOf(countryKey);
    const start = Math.max(0, index - 140);
    const snippet = text.slice(start, start + 300).replace(/\s+/g, " ").trim();
    links.push({
      title: resultString(result, "title"),
      url,
      snippet,
    });
    seenUrls.add(url);
    if (links.length >= 3) break;
  }

  return links;
}

function getEvidence(country: RestrictedCountryInsight, project: ScanAffiliateProjectResponse) {
  return country.evidence_links?.length ? country.evidence_links : fallbackEvidence(country, project);
}

function getDomainBrand(project: ScanAffiliateProjectResponse): string {
  const host = project.domain.replace(/^www\./, "").toLowerCase();
  const parts = host.split(".").filter(Boolean);
  if (parts.length === 0) return "Project";

  const secondLevelTlds = new Set(["co", "com", "net", "org", "ac", "gov"]);
  const beforeTld = parts[parts.length - 2];
  if (parts.length >= 3 && secondLevelTlds.has(beforeTld)) {
    return titleCase(parts[parts.length - 3] || beforeTld);
  }

  return titleCase(beforeTld || parts[0] || "Project");
}

function getBrand(project: ScanAffiliateProjectResponse): string {
  const domainBrand = getDomainBrand(project);
  const name = project.project_name?.trim();
  if (!name || name.length > 22) return domainBrand;

  const normalizedName = normalizeText(name);
  const normalizedDomainBrand = normalizeText(domainBrand);
  const isSameBrand =
    normalizedName.includes(normalizedDomainBrand) ||
    normalizedDomainBrand.includes(normalizedName);

  return isSameBrand ? titleCase(name) : domainBrand;
}

function extractPhrases(project: ScanAffiliateProjectResponse): string[] {
  const text = [
    project.project_name,
    project.answer,
    project.event_content,
    project.sale_content,
    ...project.results.map(getResultText),
  ]
    .filter(Boolean)
    .join(" ");

  const normalized = normalizeText(text);
  const featureMatches = FEATURE_PHRASES.filter((phrase) => normalized.includes(phrase));
  const offerMatches = text.match(
    /\b(?:commission rate|sign up bonus|free trial|limited time offer|[\d.]+%|[\d.]+\s?(?:USDT|USD|APR)|\d+x)\b/gi
  ) || [];

  return dedupe([...featureMatches, ...offerMatches])
    .filter((phrase) => phrase.length >= 3 && phrase.length <= 28)
    .filter((phrase) => !GENERIC_PHRASES.has(phrase.toLowerCase()))
    .slice(0, 24);
}

function hasContext(project: ScanAffiliateProjectResponse, tokens: string[]): boolean {
  const haystack = normalizeText([
    project.project_name,
    project.answer,
    project.event_content,
    project.sale_content,
    ...project.results.map(getResultText),
  ].filter(Boolean).join(" "));
  return tokens.some((token) => haystack.includes(token));
}

function buildSitelinks(
  project: ScanAffiliateProjectResponse,
  finalUrl?: string
): AdCopy["sitelinks"] {
  const rules = [
    {
      tokens: ["feature", "product", "tool"],
      text: "Features & Tools",
      description1: "Explore key product features",
      description2: "Find the right tools for you",
    },
    {
      tokens: ["template"],
      text: "Explore Templates",
      description1: "Browse ready-made templates",
      description2: "Start creating more quickly",
    },
    {
      tokens: ["pricing", "price", "plan"],
      text: "Pricing & Plans",
      description1: "Compare available plans",
      description2: "Choose an option that fits",
    },
    {
      tokens: ["download", "desktop", "mobile", "app"],
      text: "Download The App",
      description1: "Get the official app",
      description2: "Create or work on the go",
    },
    {
      tokens: ["event", "webinar", "campaign", "promotion", "offer", "sale"],
      text: "Events & Offers",
      description1: "See current events and offers",
      description2: "Check terms and eligibility",
    },
    {
      tokens: ["learn", "tutorial", "academy", "help", "support"],
      text: "Help & Learning",
      description1: "Read guides and tutorials",
      description2: "Get help when you need it",
    },
    {
      tokens: ["affiliate", "partner", "referral"],
      text: "Partner Program",
      description1: "Explore partner opportunities",
      description2: "Review program requirements",
    },
    {
      tokens: ["signup", "sign-up", "register", "join"],
      text: "Create An Account",
      description1: "Open the registration page",
      description2: "Review requirements and join",
    },
  ];

  const domain = project.domain.replace(/^www\./, "").toLowerCase();
  const candidates = project.results.flatMap((result) => {
    const url = resultString(result, "url");
    if (!url) return [];

    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
      if (host !== domain && !host.endsWith(`.${domain}`)) return [];

      const haystack = normalizeText(`${parsed.pathname} ${resultString(result, "title") || ""}`);
      const ruleIndex = rules.findIndex((rule) => rule.tokens.some((token) => haystack.includes(token)));
      if (ruleIndex < 0) return [];
      return [{ ...rules[ruleIndex], url: parsed.toString(), score: rules.length - ruleIndex }];
    } catch {
      return [];
    }
  });

  const seenLabels = new Set<string>();
  const seenUrls = new Set<string>();
  const sitelinks = candidates
    .sort((a, b) => b.score - a.score)
    .filter((item) => {
      const normalizedUrl = item.url.replace(/\/$/, "");
      if (seenLabels.has(item.text) || seenUrls.has(normalizedUrl)) return false;
      seenLabels.add(item.text);
      seenUrls.add(normalizedUrl);
      return true;
    })
    .slice(0, 6)
    .map((item) => ({
      text: item.text,
      url: item.url,
      description1: item.description1,
      description2: item.description2,
    }));

  if (sitelinks.length < 4 && finalUrl) {
    const fallback = {
      text: "Visit Official Site",
      url: finalUrl,
      description1: "Explore the official website",
      description2: "Review features and sign up",
    };
    if (!seenUrls.has(finalUrl.replace(/\/$/, ""))) sitelinks.push(fallback);
  }

  return sitelinks;
}

function generateAdCopy(project: ScanAffiliateProjectResponse | null, affiliateUrl?: string): AdCopy {
  if (!project) return { brandKeywords: [], headlines: [], descriptions: [], sitelinks: [] };

  const brand = truncate(getBrand(project), 20);
  const brandShort = truncate(brand, 16);
  const phrases = extractPhrases(project);
  const featurePhrases = phrases.filter((phrase) => !/[%\d]/.test(phrase)).slice(0, 6);
  const hasOffer = Boolean(project.sale_content || project.event_content);
  const hasApp = hasContext(project, ["app", "mobile", "desktop", "download"]);

  const brandKeywords = dedupe([
    `[${brand}]`,
    `"${brand}"`,
    `"${brand} sign up"`,
    `"${brand} register"`,
    `"${brand} official"`,
    `"${brand} features"`,
    hasApp ? `"${brand} app"` : "",
    hasOffer ? `"${brand} offer"` : "",
    ...featurePhrases.slice(0, 4).map((phrase) => `"${brand} ${phrase}"`),
    project.domain ? `"${project.domain}"` : "",
  ])
    .filter(Boolean)
    .slice(0, 15);

  const rawHeadlines = [
    `${brand} Official`,
    `${brand} Sign Up`,
    `Join ${brandShort} Today`,
    `Create ${brandShort} Account`,
    `Explore ${brandShort} Features`,
    `Discover ${brandShort}`,
    `Start With ${brandShort}`,
    `${brandShort} Tools & Features`,
    `Why Choose ${brandShort}`,
    `${brandShort} Online`,
    `${brandShort} Platform`,
    hasApp ? `${brandShort} Official App` : "",
    hasOffer ? `${brandShort} Latest Offers` : "",
    hasOffer ? `${brandShort} Events` : "",
    ...featurePhrases.map((phrase) => `${brandShort} ${titleCase(phrase)}`),
    ...featurePhrases.map(titleCase),
    "Explore All Features",
    "Create Your Account",
    "Get Started Today",
    "Visit The Official Site",
  ];

  const headlines = dedupe(rawHeadlines)
    .filter(Boolean)
    .filter((headline) => headline.length <= 30)
    .slice(0, 15);

  const featureSummary = featurePhrases.slice(0, 3).map(titleCase).join(", ");
  const rawDescriptions = [
    featureSummary
      ? `Explore ${featureSummary} and more from ${brand}. Visit the official site to get started.`
      : `Explore ${brand} features, tools, and services. Visit the official site to get started.`,
    hasOffer
      ? `See the latest ${brand} events, campaigns, and offers. Check current terms and eligibility.`
      : `Discover what you can do with ${brand}, review the details, and create your account today.`,
    `Access the official ${brand} website, compare key features, and choose what works for you.`,
    `Ready to try ${brand}? Review availability and requirements, then register through this link.`,
  ];

  return {
    finalUrl: affiliateUrl,
    brandKeywords,
    headlines,
    descriptions: rawDescriptions.map((item) => truncate(item, 90)).slice(0, 4),
    sitelinks: buildSitelinks(project, affiliateUrl),
  };
}

async function copyText(text: string, message = "Đã copy") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(message);
  } catch {
    toast.error("Copy thất bại");
  }
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "good") return <CheckCircle2 size={16} className="text-emerald-600" />;
  if (status === "warn") return <AlertTriangle size={16} className="text-amber-600" />;
  return <XCircle size={16} className="text-slate-400" />;
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Target; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon size={16} className="text-emerald-600" />
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
  );
}

function PillList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
          {item}
        </span>
      ))}
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
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectSearch, setNewProjectSearch] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);
  const [openEvidenceKey, setOpenEvidenceKey] = useState<string | null>(null);
  const [trafficMonths, setTrafficMonths] = useState(4);

  const [editingLink, setEditingLink] = useState<AffiliateLinkModel | null>(null);
  const [editLinkInput, setEditLinkInput] = useState("");
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectSearch, setEditProjectSearch] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);

  useEffect(() => {
    if (detail?.traffic_scans?.length) {
      const latestPeriod = detail.traffic_scans[0].period_month;
      setSelectedPeriods(prev => prev.length > 0 ? prev : [latestPeriod]);
    } else {
      setSelectedPeriods([]);
    }
  }, [detail]);

  const trafficResult = useMemo(() => {
    return detail && selectedPeriods.length > 0 ? aggregateTrafficScans(detail, selectedPeriods) : null;
  }, [detail, selectedPeriods]);
  const projectResult = useMemo(() => (detail ? toProjectResponse(detail) : null), [detail]);
  const topTrafficCountries = useMemo(() => getTopTrafficCountries(trafficResult?.traffic_details?.country), [trafficResult]);
  const trafficCountryChartData = useMemo(() => getTrafficCountryChartData(topTrafficCountries), [topTrafficCountries]);
  const latestTrafficGlobal = useMemo(() => getLatestTrafficGlobal(trafficResult), [trafficResult]);
  const trafficSourceData = useMemo(() => getTrafficSourceData(trafficResult), [trafficResult]);
  const trafficSocialData = useMemo(() => getTrafficSocialData(trafficResult), [trafficResult]);
  const launchInsight = useMemo(() => buildLaunchInsight(trafficResult, projectResult), [trafficResult, projectResult]);
  const adCopy = useMemo(() => {
    if (projectResult && projectResult.ad_copy) {
      return {
        finalUrl: detail?.affiliate_link.affiliate_url,
        brandKeywords: projectResult.ad_copy.brandKeywords || [],
        headlines: projectResult.ad_copy.headlines || [],
        descriptions: projectResult.ad_copy.descriptions || [],
        sitelinks: (projectResult.ad_copy.sitelinks || []).map((s) => ({
          text: s.text || "",
          url: s.url || detail?.affiliate_link.affiliate_url || "",
          description1: s.description1 || "",
          description2: s.description2 || "",
        })),
      };
    }
    return generateAdCopy(projectResult, detail?.affiliate_link.affiliate_url);
  }, [detail?.affiliate_link.affiliate_url, projectResult]);
  const isBusy = scanningTraffic || scanningProject || savingLink || Boolean(deletingLinkId) || savingEdit;

  useEffect(() => {
    if (editingLink) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [editingLink]);

  function openEditModal(link: AffiliateLinkModel) {
    setEditingLink(link);
    setEditLinkInput(link.affiliate_url);
    setEditProjectName(link.name || "");
    setEditProjectSearch(link.search_query || "");
  }

  async function handleSaveEdit() {
    if (!editingLink) return;
    const trimmedLink = editLinkInput.trim();
    if (!trimmedLink) {
      toast.error("Vui lòng nhập affiliate URL");
      return;
    }
    setSavingEdit(true);
    try {
      const updated = await affiliateProjectService.updateAffiliateLink(editingLink.id, {
        website: trimmedLink,
        name: editProjectName.trim() || null,
        search: editProjectSearch.trim() || null,
      });

      const updatedLinks = links.map((link) => (link.id === updated.id ? updated : link));
      setLinks(updatedLinks);

      if (selectedLink?.id === updated.id) {
        setSelectedLink(updated);
        const refreshed = await affiliateProjectService.getAffiliateLinkDetail(updated.affiliate_url);
        setDetail(refreshed);
      }

      setEditingLink(null);
      toast.success("Đã cập nhật dự án");
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || "Cập nhật dự án thất bại";
      toast.error(errorMsg);
    } finally {
      setSavingEdit(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadLinks() {
      setLoadingLinks(true);
      try {
        const data = await affiliateProjectService.getAffiliateLinks();
        if (cancelled) return;
        setLinks(data);
        setSelectedLink(data[0] ?? null);
      } catch {
        toast.error("Không tải được danh sách affiliate link");
      } finally {
        if (!cancelled) setLoadingLinks(false);
      }
    }
    void loadLinks();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedLink) return;
    const link = selectedLink;

    let cancelled = false;
    async function loadDetail() {
      setLoadingDetail(true);
      setDetail(null);
      try {
        const data = await affiliateProjectService.getAffiliateLinkDetail(link.affiliate_url);
        if (!cancelled) setDetail(data);
      } catch {
        if (!cancelled) setDetail(null);
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    }
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedLink]);

  async function refreshDetail(link = detail?.affiliate_link) {
    if (!link) return;
    const refreshed = await affiliateProjectService.getAffiliateLinkDetail(link.affiliate_url);
    setDetail(refreshed);
  }

  async function handleAddLink() {
    const trimmed = newLinkInput.trim();
    if (!trimmed) return;
    setSavingLink(true);
    try {
      const created = await affiliateProjectService.createAffiliateLink({
        website: trimmed,
        name: newProjectName.trim() || null,
        search: newProjectSearch.trim() || null,
      });
      const updatedLinks = await affiliateProjectService.getAffiliateLinks();
      setLinks(updatedLinks);
      setSelectedLink(updatedLinks.find((link) => link.id === created.id) ?? created);
      setNewLinkInput("");
      setNewProjectName("");
      setNewProjectSearch("");
      setShowAddForm(false);
      toast.success("Đã thêm affiliate link");
    } catch {
      toast.error("Thêm affiliate link thất bại");
    } finally {
      setSavingLink(false);
    }
  }

  async function handleDeleteLink(link: AffiliateLinkModel) {
    const confirmed = window.confirm(
      `Xóa dự án ${link.domain}? Toàn bộ dữ liệu scan traffic, project data và ads copy đã lưu của dự án này cũng sẽ bị xóa.`
    );
    if (!confirmed) return;

    setDeletingLinkId(link.id);
    try {
      await affiliateProjectService.deleteAffiliateLink(link.id);
      const nextLinks = links.filter((item) => item.id !== link.id);
      setLinks(nextLinks);

      if (selectedLink?.id === link.id) {
        setSelectedLink(nextLinks[0] ?? null);
        setDetail(null);
      }
      toast.success("Đã xóa dự án");
    } catch {
      toast.error("Xóa dự án thất bại");
    } finally {
      setDeletingLinkId(null);
    }
  }

  async function handleScanTraffic() {
    if (!detail) return;
    setScanningTraffic(true);
    const toastId = toast.loading("Đang quét traffic...");
    const controller = new AbortController();
    const slowWarning = window.setTimeout(() => {
      toast.warning("Quét traffic phản hồi chậm", {
        id: toastId,
        description: "Dịch vụ có thể đang bảo trì. Hệ thống sẽ tự dừng nếu tiếp tục quá lâu.",
      });
    }, SCAN_SLOW_WARNING_MS);
    const timeout = window.setTimeout(() => controller.abort(), TRAFFIC_SCAN_TIMEOUT_MS);
    try {
      await affiliateProjectService.scanTraffic(
        {
          affiliate_link_id: detail.affiliate_link.id,
          months: trafficMonths,
        },
        controller.signal
      );
      await refreshDetail();
      toast.success("Quét traffic thành công", { id: toastId });
    } catch (error) {
      toast.error(MAINTENANCE_MESSAGE, {
        id: toastId,
        description: isCanceledRequest(error)
          ? "Yêu cầu đã tự dừng vì thời gian quét quá lâu."
          : "Dịch vụ quét traffic hiện không khả dụng.",
      });
    } finally {
      window.clearTimeout(slowWarning);
      window.clearTimeout(timeout);
      setScanningTraffic(false);
    }
  }

  async function handleScanProject() {
    if (!detail) return;
    setScanningProject(true);
    const toastId = toast.loading("Đang quét dữ liệu dự án...");
    const controller = new AbortController();
    const slowWarning = window.setTimeout(() => {
      toast.warning("Quét dữ liệu phản hồi chậm", {
        id: toastId,
        description: "Dịch vụ có thể đang bảo trì. Hệ thống sẽ tự dừng nếu tiếp tục quá lâu.",
      });
    }, SCAN_SLOW_WARNING_MS);
    const timeout = window.setTimeout(() => controller.abort(), PROJECT_SCAN_TIMEOUT_MS);
    try {
      await affiliateProjectService.scanAffiliateProject(
        {
          affiliate_link_id: detail.affiliate_link.id,
          max_results: 15,
          search_depth: "advanced",
          include_raw_content: true,
        },
        controller.signal
      );
      await refreshDetail();
      toast.success("Quét dữ liệu dự án thành công", { id: toastId });
    } catch {
      toast.error(MAINTENANCE_MESSAGE, {
        id: toastId,
        description: "Yêu cầu lỗi hoặc mất quá nhiều thời gian phản hồi.",
      });
    } finally {
      window.clearTimeout(slowWarning);
      window.clearTimeout(timeout);
      setScanningProject(false);
    }
  }

  const excludedCountries = projectResult?.restricted_countries.map((item) => item.country) || [];
  const fullAdCopyText = [
    "Final URL",
    adCopy.finalUrl || "",
    "",
    "Brand keywords",
    ...adCopy.brandKeywords,
    "",
    "Headlines",
    ...adCopy.headlines,
    "",
    "Descriptions",
    ...adCopy.descriptions,
    "",
    "Sitelinks",
    ...adCopy.sitelinks.flatMap((sitelink) => [
      sitelink.text,
      sitelink.url,
      sitelink.description1,
      sitelink.description2,
      "",
    ]),
  ].join("\n");

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col gap-3">
        <button
          onClick={() => setShowAddForm((value) => !value)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
          disabled={isBusy}
        >
          <Plus size={15} />
          Thêm link mới
        </button>

        {showAddForm && (
          <div className="rounded-md border border-border bg-card p-3">
            <input
              value={newLinkInput}
              onChange={(event) => setNewLinkInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void handleAddLink()}
              placeholder="https://example.com/ref"
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
              disabled={savingLink}
              autoFocus
            />
            <input
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder="Tên dự án"
              className="mt-2 h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
              disabled={savingLink}
            />
            <input
              value={newProjectSearch}
              onChange={(event) => setNewProjectSearch(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void handleAddLink()}
              placeholder="Search dùng chung, ví dụ: xm trading"
              className="mt-2 h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
              disabled={savingLink}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => void handleAddLink()}
                disabled={savingLink || !newLinkInput.trim()}
                className="inline-flex h-8 items-center justify-center rounded-md bg-emerald-600 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {savingLink ? <Loader2 size={13} className="animate-spin" /> : "Lưu"}
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewLinkInput("");
                  setNewProjectName("");
                  setNewProjectSearch("");
                }}
                className="h-8 rounded-md border border-border text-xs text-muted-foreground hover:bg-muted"
              >
                Hủy
              </button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border bg-card p-2">
          {loadingLinks ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 size={20} className="animate-spin text-emerald-600" />
            </div>
          ) : links.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <FolderOpen size={22} className="opacity-50" />
              Chưa có affiliate link nào
            </div>
          ) : (
            <div className="space-y-1">
              {links.map((link) => {
                const isActive = selectedLink?.id === link.id;
                return (
                  <div
                    key={link.id}
                    onClick={() => setSelectedLink(link)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") setSelectedLink(link);
                    }}
                    className={`group flex w-full items-start gap-2 rounded-md px-3 py-2.5 text-left transition-colors ${isActive ? "bg-emerald-50 ring-1 ring-emerald-200" : "hover:bg-muted"
                      }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-semibold ${isActive ? "text-emerald-700" : "text-foreground"}`}>
                        {link.domain}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{link.affiliate_url}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditModal(link);
                      }}
                      disabled={isBusy}
                      title={`Sửa ${link.domain}`}
                      className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-40 group-hover:opacity-100 group-focus-within:opacity-100 mr-1"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDeleteLink(link);
                      }}
                      disabled={isBusy}
                      title={`Xóa ${link.domain}`}
                      className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 group-hover:opacity-100 group-focus-within:opacity-100"
                    >
                      {deletingLinkId === link.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <main className="min-h-0 overflow-y-auto">
        {!selectedLink ? (
          <div className="flex h-80 items-center justify-center rounded-md border border-dashed border-border bg-card text-sm text-muted-foreground">
            Chọn hoặc thêm affiliate link để bắt đầu.
          </div>
        ) : loadingDetail ? (
          <div className="flex h-80 items-center justify-center rounded-md border border-border bg-card">
            <Loader2 size={24} className="animate-spin text-emerald-600" />
          </div>
        ) : (
          <div className="space-y-4">
            <section className="rounded-md border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-md bg-emerald-50">
                      <FolderOpen size={16} className="text-emerald-600" />
                    </div>
                    <h2 className="truncate text-base font-semibold">{selectedLink.domain}</h2>
                  </div>
                  <a
                    href={selectedLink.affiliate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate pl-10 text-xs text-emerald-700 hover:underline"
                  >
                    <span className="truncate">{selectedLink.affiliate_url}</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-[130px]">
                    <CustomSelect
                      value={String(trafficMonths)}
                      onChange={(val) => setTrafficMonths(Number(val))}
                      disabled={isBusy}
                      options={[1, 2, 3, 4].map((month) => ({
                        value: String(month),
                        label: `${month} tháng`,
                      }))}
                    />
                  </div>
                  <button
                    onClick={() => void handleScanTraffic()}
                    disabled={isBusy || !detail}
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {scanningTraffic ? <Loader2 size={15} className="animate-spin" /> : <Radar size={15} />}
                    Quét lại Traffic
                  </button>
                  <button
                    onClick={() => void handleScanProject()}
                    disabled={isBusy || !detail}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                  >
                    {scanningProject ? <Loader2 size={15} className="animate-spin" /> : <SearchCheck size={15} />}
                    Quét lại Dự án
                  </button>
                </div>
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-4">
                <section className="rounded-md border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="mb-0">
                      <SectionTitle icon={Radar} title="Traffic summary" />
                    </div>
                    {detail?.traffic_scans && detail.traffic_scans.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Kỳ dữ liệu:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {detail.traffic_scans.map(scan => {
                            const isSelected = selectedPeriods.includes(scan.period_month);
                            return (
                              <button
                                key={scan.period_month}
                                onClick={() => {
                                  setSelectedPeriods(prev => {
                                    if (prev.includes(scan.period_month)) {
                                      const next = prev.filter(p => p !== scan.period_month);
                                      return next.length === 0 ? prev : next;
                                    }
                                    return [...prev, scan.period_month];
                                  });
                                }}
                                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${isSelected
                                  ? "bg-emerald-100 border-emerald-500 text-emerald-800 font-medium"
                                  : "bg-background border-border text-muted-foreground hover:bg-muted"
                                  }`}
                              >
                                {scan.period_month}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  {trafficResult ? (
                    <>
                      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{trafficResult.domain}</span>
                        <span>{formatVisits(trafficResult.monthly_visits)} lượt truy cập</span>
                        <span>{trafficResult.period_month || "-"}</span>
                      </div>
                      {latestTrafficGlobal && (
                        <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                          <div className="rounded-md bg-muted/40 px-3 py-2">
                            <p className="text-[11px] uppercase text-muted-foreground">Lượt truy cập duy nhất</p>
                            <p className="mt-1 text-sm font-semibold">{formatCompact(latestTrafficGlobal.unique_visits_monthly)}</p>
                          </div>
                          <div className="rounded-md bg-muted/40 px-3 py-2">
                            <p className="text-[11px] uppercase text-muted-foreground">Lượt quay lại</p>
                            <p className="mt-1 text-sm font-semibold">{formatCompact(latestTrafficGlobal.repeat_visits_monthly)}</p>
                          </div>
                          <div className="rounded-md bg-muted/40 px-3 py-2">
                            <p className="text-[11px] uppercase text-muted-foreground">Trang / lượt</p>
                            <p className="mt-1 text-sm font-semibold">{latestTrafficGlobal.pages_per_visit.toFixed(2)}</p>
                          </div>
                          <div className="rounded-md bg-muted/40 px-3 py-2">
                            <p className="text-[11px] uppercase text-muted-foreground">Thời lượng TB</p>
                            <p className="mt-1 text-sm font-semibold">{formatDuration(latestTrafficGlobal.avg_visit_duration)}</p>
                          </div>
                          <div className="rounded-md bg-muted/40 px-3 py-2">
                            <p className="text-[11px] uppercase text-muted-foreground">Tỉ lệ thoát</p>
                            <p className="mt-1 text-sm font-semibold">{formatPercent(latestTrafficGlobal.bounce_rate_percentage)}</p>
                          </div>
                        </div>
                      )}
                      <div className="grid gap-4">
                        <div className="min-h-0 rounded-md border border-border p-3">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <BarChart3 size={14} className="text-sky-600" />
                              <p className="text-xs font-semibold uppercase text-muted-foreground">Top 10 quốc gia traffic</p>
                            </div>
                            <p className="text-xs text-muted-foreground">{trafficCountryChartData.length} markets</p>
                          </div>
                          <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={trafficCountryChartData} layout="vertical" margin={{ top: 4, right: 18, left: 8, bottom: 0 }}>
                                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
                                <XAxis
                                  type="number"
                                  domain={[0, "dataMax"]}
                                  tick={{ fontSize: 11 }}
                                  tickLine={false}
                                  axisLine={false}
                                  tickFormatter={(value: number) => formatPercent(value, 0)}
                                />
                                <YAxis
                                  dataKey="name"
                                  type="category"
                                  width={82}
                                  tick={{ fontSize: 11 }}
                                  tickLine={false}
                                  axisLine={false}
                                />
                                <Tooltip
                                  contentStyle={{ fontSize: 12, borderRadius: 6 }}
                                  formatter={(value, name) => [
                                    name === "share" ? formatPercent(toChartNumber(value)) : formatVisits(toChartNumber(value)),
                                    name === "share" ? "Tỉ trọng traffic" : "Lượt truy cập",
                                  ]}
                                  labelStyle={{ fontWeight: 600 }}
                                />
                                <Bar dataKey="share" radius={[0, 4, 4, 0]} barSize={16}>
                                  {trafficCountryChartData.map((entry) => (
                                    <Cell
                                      key={entry.name}
                                      fill={isRestrictedCountry(entry.name, projectResult?.restricted_countries || []) ? "#dc2626" : "#0ea5e9"}
                                    />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="mt-3 space-y-1.5">
                            {trafficCountryChartData.map((country) => (
                              <div key={country.name} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2 text-xs">
                                <span className="truncate font-medium">{country.name}</span>
                                <span className="tabular-nums text-muted-foreground">{formatCompact(country.visits)} lượt</span>
                                <span className="tabular-nums text-muted-foreground">{formatDuration(country.duration)} ở lại</span>
                                <span className="tabular-nums text-muted-foreground">{formatPercent(country.bounce, 1)} thoát</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      {(trafficSourceData.length > 0 || trafficSocialData.length > 0) && (
                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          {trafficSourceData.length > 0 && (
                            <div className="rounded-md border border-border p-3 lg:col-span-2">
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <BarChart3 size={14} className="text-blue-600" />
                                  <p className="text-xs font-semibold uppercase text-muted-foreground">Kênh marketing</p>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {trafficResult.period_month || "-"} · Toàn cầu · Toàn bộ traffic
                                </p>
                              </div>
                              <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={trafficSourceData} margin={{ top: 26, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                                    <YAxis
                                      width={42}
                                      domain={[0, 100]}
                                      tick={{ fontSize: 11 }}
                                      tickLine={false}
                                      axisLine={false}
                                      tickFormatter={(value: number) => formatPercent(value, 0)}
                                    />
                                    <Tooltip
                                      contentStyle={{ fontSize: 12, borderRadius: 6 }}
                                      formatter={(value) => [formatPercent(toChartNumber(value)), "Tỉ trọng"]}
                                      labelStyle={{ fontWeight: 600 }}
                                    />
                                    <Bar dataKey="share" fill="#3b73f6" radius={[4, 4, 0, 0]} barSize={28}>
                                      <LabelList
                                        dataKey="share"
                                        position="top"
                                        className="fill-muted-foreground text-[11px]"
                                        formatter={(value: unknown) => formatPercent(toChartNumber(value))}
                                      />
                                      {trafficSourceData.map((entry) => (
                                        <Cell key={entry.name} fill="#3b73f6" />
                                      ))}
                                    </Bar>
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          )}

                          {trafficSocialData.length > 0 && (
                            <div className="rounded-md border border-border p-3">
                              <div className="mb-3 flex items-center gap-2">
                                <Sparkles size={14} className="text-sky-600" />
                                <p className="text-xs font-semibold uppercase text-muted-foreground">Nguồn mạng xã hội</p>
                              </div>
                              <div className="space-y-3">
                                {trafficSocialData.map((item) => (
                                  <div key={item.name}>
                                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                                      <span className="truncate font-medium">{item.name}</span>
                                      <span className="tabular-nums text-muted-foreground">{formatPercent(item.share)}</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                                      <div className="h-full rounded-full bg-sky-500" style={{ width: `${clamp(item.share)}%` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Chưa có dữ liệu traffic. Bấm “Quét lại Traffic” để bắt đầu.</p>
                  )}
                </section>

                <section className="rounded-md border border-border bg-card p-4">
                  <SectionTitle icon={Sparkles} title="Launch insight" />
                  <div className="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)]">
                    <div className="flex flex-col items-center justify-center rounded-md border border-border p-4">
                      <div className="text-4xl font-bold text-emerald-700">{launchInsight.readinessScore}</div>
                      <p className="mt-1 text-xs uppercase text-muted-foreground">Readiness</p>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {launchInsight.checks.map((check) => (
                        <div key={check.label} className="rounded-md border border-border p-3">
                          <div className="flex items-center gap-2">
                            <StatusIcon status={check.status} />
                            <p className="text-sm font-semibold">{check.label}</p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{check.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Market ưu tiên</p>
                      <PillList
                        items={launchInsight.priorityCountries.map((country) => country.country_name)}
                        empty="Chưa có market ưu tiên."
                      />
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Cần tránh</p>
                      <PillList items={excludedCountries} empty="Chưa phát hiện quốc gia cần loại trừ." />
                    </div>
                  </div>
                </section>

                <section className="rounded-md border border-border bg-card p-4">
                  <SectionTitle icon={SearchCheck} title="Thông tin dự án" />
                  {projectResult ? (
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Project name</p>
                        <p className="font-semibold">{projectResult.project_name || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Project link</p>
                        {projectResult.project_link ? (
                          <a href={projectResult.project_link} target="_blank" rel="noopener noreferrer" className="break-all text-emerald-700 hover:underline">
                            {projectResult.project_link}
                          </a>
                        ) : (
                          <p>-</p>
                        )}
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-md bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground">Event content</p>
                          <p className="mt-1">{projectResult.event_content || "-"}</p>
                        </div>
                        <div className="rounded-md bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground">Sale content</p>
                          <p className="mt-1">{projectResult.sale_content || "-"}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Chưa có dữ liệu dự án. Bấm “Quét lại Dự án” để bắt đầu.</p>
                  )}
                </section>

                {projectResult && (
                  <section className="rounded-md border border-border bg-card p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <SectionTitle icon={ShieldAlert} title="Restricted countries" />
                      <button
                        onClick={() => void copyText(excludedCountries.join(", "), "Đã copy danh sách loại trừ")}
                        disabled={excludedCountries.length === 0}
                        className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                      >
                        <Clipboard size={13} />
                        Copy loại trừ
                      </button>
                    </div>
                    {projectResult.restricted_countries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Chưa phát hiện restricted countries. Kết quả tự động vẫn cần kiểm tra lại Terms.</p>
                    ) : (
                      <div className="space-y-2">
                        {projectResult.restricted_countries.map((country) => {
                          const key = `${country.country}-${country.restriction_type}`;
                          const evidence = getEvidence(country, projectResult);
                          const open = openEvidenceKey === key;
                          return (
                            <div key={key} className="rounded-md border border-border p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">{country.country}</span>
                                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${country.restriction_type === "banned"
                                    ? "bg-red-50 text-red-700"
                                    : "bg-amber-50 text-amber-700"
                                    }`}>
                                    {country.restriction_type === "banned" ? "Cấm" : "Hạn chế"}
                                  </span>
                                  {country.confidence && (
                                    <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                      {country.confidence}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => setOpenEvidenceKey(open ? null : key)}
                                  className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-muted"
                                >
                                  Minh chứng
                                  {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>
                              </div>
                              {country.signals?.[0] && <p className="mt-2 text-xs text-muted-foreground">{country.signals[0]}</p>}
                              {open && (
                                <div className="mt-3 space-y-2 border-t border-border pt-3">
                                  {evidence.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">{country.verification_note || "Không có evidence link trực tiếp."}</p>
                                  ) : (
                                    evidence.map((link) => (
                                      <a
                                        key={link.url || link.title || link.snippet}
                                        href={link.url || "#"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block rounded-md bg-muted/50 p-2 text-xs hover:bg-muted"
                                      >
                                        <span className="font-medium text-emerald-700">{link.title || link.url}</span>
                                        {link.snippet && <span className="mt-1 block text-muted-foreground">{link.snippet}</span>}
                                      </a>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}
              </div>

              <aside className="space-y-4">
                <section className="rounded-md border border-border bg-card p-4">
                  <SectionTitle icon={Target} title="Top countries từ web" />
                  {projectResult?.top_countries.length ? (
                    <div className="space-y-2">
                      {projectResult.top_countries.slice(0, 5).map((country: TopCountryInsight) => (
                        <div key={country.country} className="rounded-md border border-border p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">{country.country}</p>
                            <span className="text-xs text-muted-foreground">Signal {country.signal_score}</span>
                          </div>
                          {country.signals?.length > 0 && (
                            <p className="mt-1 truncate text-xs text-muted-foreground">{country.signals.join(", ")}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Chưa có tín hiệu quốc gia từ web.</p>
                  )}
                </section>

                <section className="rounded-md border border-border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <SectionTitle icon={Sparkles} title="Google Search Ads copy" />
                    <button
                      onClick={() => void copyText(fullAdCopyText, "Đã copy toàn bộ ads copy")}
                      disabled={adCopy.headlines.length === 0}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-xs hover:bg-muted disabled:opacity-50"
                    >
                      <Copy size={13} />
                      Copy all
                    </button>
                  </div>
                  {adCopy.headlines.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Quét dữ liệu dự án để sinh ads copy.</p>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Final URL</p>
                        <button
                          onClick={() => adCopy.finalUrl && void copyText(adCopy.finalUrl)}
                          disabled={!adCopy.finalUrl}
                          className="w-full rounded-md border border-border px-2.5 py-2 text-left text-xs hover:bg-muted disabled:opacity-50"
                        >
                          <span className="block truncate">{adCopy.finalUrl || "-"}</span>
                        </button>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Brand keywords</p>
                        <div className="space-y-1.5">
                          {adCopy.brandKeywords.map((keyword) => (
                            <button
                              key={keyword}
                              onClick={() => void copyText(keyword)}
                              className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2 text-left text-xs hover:bg-muted"
                            >
                              <span className="truncate">{keyword}</span>
                              <span className="shrink-0 text-muted-foreground">brand</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{adCopy.headlines.length} headlines</p>
                        <div className="space-y-1.5">
                          {adCopy.headlines.map((headline) => (
                            <button
                              key={headline}
                              onClick={() => void copyText(headline)}
                              className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2 text-left text-xs hover:bg-muted"
                            >
                              <span className="truncate">{headline}</span>
                              <span className="shrink-0 text-muted-foreground">{headline.length}/30</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{adCopy.descriptions.length} descriptions</p>
                        <div className="space-y-1.5">
                          {adCopy.descriptions.map((description) => (
                            <button
                              key={description}
                              onClick={() => void copyText(description)}
                              className="w-full rounded-md border border-border px-2.5 py-2 text-left text-xs hover:bg-muted"
                            >
                              <span className="block">{description}</span>
                              <span className="mt-1 block text-right text-muted-foreground">{description.length}/90</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                          Sitelinks
                        </p>
                        {adCopy.sitelinks.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Chưa tìm thấy trang con phù hợp trong dữ liệu quét.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {adCopy.sitelinks.map((sitelink) => (
                              <button
                                key={`${sitelink.text}-${sitelink.url}`}
                                onClick={() =>
                                  void copyText(
                                    [
                                      sitelink.text,
                                      sitelink.url,
                                      sitelink.description1,
                                      sitelink.description2,
                                    ].join("\n")
                                  )
                                }
                                className="w-full rounded-md border border-border px-2.5 py-2 text-left text-xs hover:bg-muted"
                              >
                                <span className="block font-medium">
                                  {sitelink.text}{" "}
                                  <span className="font-normal text-muted-foreground">
                                    ({sitelink.text.length}/25)
                                  </span>
                                </span>
                                <span className="mt-1 block truncate text-muted-foreground">
                                  {sitelink.url}
                                </span>
                                <span className="mt-1 block">
                                  {sitelink.description1}{" "}
                                  <span className="text-muted-foreground">
                                    ({(sitelink.description1 || "").length}/35)
                                  </span>
                                </span>
                                <span className="block">
                                  {sitelink.description2}{" "}
                                  <span className="text-muted-foreground">
                                    ({(sitelink.description2 || "").length}/35)
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </section>

                <section className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  Restricted countries và top countries là suy luận tự động từ dữ liệu web. Hãy mở evidence và kiểm tra Terms, eligibility hoặc supported countries trước khi ra quyết định quan trọng.
                </section>
              </aside>
            </div>
          </div>
        )}
      </main>

      {/* Edit Project Modal */}
      {editingLink && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingLink(null);
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal content */}
          <div
            className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">Sửa dự án: {editingLink.domain}</h2>
              <button
                onClick={() => setEditingLink(null)}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <XCircle size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Affiliate URL
                </label>
                <input
                  type="text"
                  value={editLinkInput}
                  onChange={(e) => setEditLinkInput(e.target.value)}
                  placeholder="https://example.com/ref"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                  disabled={savingEdit}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Tên dự án
                </label>
                <input
                  type="text"
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  placeholder="Tên dự án"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                  disabled={savingEdit}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Search dùng chung (keywords)
                </label>
                <input
                  type="text"
                  value={editProjectSearch}
                  onChange={(e) => setEditProjectSearch(e.target.value)}
                  placeholder="xm trading"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                  disabled={savingEdit}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editLinkInput.trim()}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                >
                  {savingEdit ? <Loader2 size={16} className="animate-spin" /> : "Lưu thay đổi"}
                </button>
                <button
                  onClick={() => setEditingLink(null)}
                  disabled={savingEdit}
                  className="h-10 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
