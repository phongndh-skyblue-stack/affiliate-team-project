"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  Clipboard,
  DollarSign,
  ExternalLink,
  FileText,
  Globe2,
  Hash,
  Loader2,
  RefreshCw,
  ScanLine,
  Search,
  ShieldAlert,
  Target,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adsTransparentService } from "@/services/adsTransparent.service";
import { affiliateProjectService } from "@/services/affiliateProject.service";
import { keywordPlannerService } from "@/services/keywordPlanner.service";
import { searchAdsService } from "@/services/searchAds.service";
import type {
  AffiliateLinkDetailResponse,
  AffiliateLinkModel,
  AffiliateLinkProjectDataModel,
  AffiliateLinkTrafficModel,
  TrafficCountryItem,
} from "@/types/affiliateProject.types";
import type {
  AdCreativeHistoryItem,
  AdSearchHistoryItem,
} from "@/types/adsTransparent.types";
import type { AdsAccountResponse, KeywordIdeaItem } from "@/types/keywordPlanner.types";
import type {
  SearchAdItem,
  SearchAdsCompetitorItem,
  SearchAdsHistoryItem,
} from "@/types/searchAds.types";

interface ProjectSnapshot {
  link: AffiliateLinkModel;
  detail: AffiliateLinkDetailResponse;
}

interface KeywordSignal {
  keyword: string;
  source: string;
  volume?: number | null;
}

interface ProjectKeywordIdea extends KeywordIdeaItem {
  jobId: string;
  inputType: "keywords" | "url";
  projectId?: string | null;
  pageUrl?: string | null;
  seedKeywords: string[];
}

interface DecisionBrief {
  potentialLabel: string;
  potentialText: string;
  trafficSourceLabel: string;
  trafficSourceText: string;
  priorityCountryLabel: string;
  priorityCountryText: string;
  searchAdsText: string;
  topKeywordText: string;
  restrictedText: string;
  decisionHelp: string[];
}

interface BudgetStrategy {
  budget: number;
  durationDays: number;
  dailyBudget: number;
  currency: string;
  verdictLabel: string;
  verdictTone: "good" | "warning" | "danger";
  summary: string;
  cpcText: string;
  estimatedClicksText: string;
  sampleSizeText: string;
  testScopeText: string;
  decisionRuleText: string;
  allocations: Array<{
    label: string;
    percent: number;
    amount: number;
    description: string;
  }>;
  timeline: Array<{
    title: string;
    text: string;
  }>;
  actions: string[];
  warnings: string[];
}

interface OfferBrief {
  mainOffer: string;
  searchAngle: string;
  targetIntent: string;
  landingPageCheck: string;
  headlineIdeas: string[];
  missingItems: string[];
}

interface CpcEstimate {
  currency: string;
  keyword: string;
  low: number;
  high: number;
  expected: number;
  recommendedBid: number;
  sourceCount: number;
}

interface ReadinessItem {
  label: string;
  ready: boolean;
  detail: string;
  action?: string;
  targetTab?: string;
}

interface ProjectReadiness {
  score: number;
  label: string;
  tone: "good" | "warning" | "danger";
  summary: string;
  items: ReadinessItem[];
  nextActions: ReadinessItem[];
}

interface ProjectAdCompetitor extends SearchAdItem {
  rowId: string;
  source: "search_ads";
  keyword: string;
  scannedAt: string;
  searchUrl?: string | null;
}

interface TransparencyProjectCompetitor {
  rowId: string;
  source: "ttmb";
  advertiserName: string;
  advertiserDomain?: string | null;
  title?: string | null;
  snippet?: string | null;
  targetUrl?: string | null;
  format?: string | null;
  totalDaysShown?: number | null;
  keyword: string;
  scannedAt: string;
}

type ProjectCompetitor = ProjectAdCompetitor | TransparencyProjectCompetitor;

function formatCompact(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat(currency === "VND" ? "vi-VN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "VND" ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatOptionalMoney(value: number | null | undefined, currency: string): string {
  return value != null ? formatMoney(value, currency) : "-";
}

function toPositiveNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function normalize(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function normalizeDomain(value: string | null | undefined): string {
  return normalize(value).replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

function getDomainRoot(domain: string): string {
  return domain.split(".")[0] || domain;
}

function getBrandRoot(domain: string): string {
  const parts = normalizeDomain(domain)
    .split(".")
    .filter(Boolean);
  if (parts.length <= 2) return parts[0] || "";

  const secondLevelTlds = new Set(["co", "com", "net", "org", "ac", "gov"]);
  const beforeTld = parts[parts.length - 2];
  if (secondLevelTlds.has(beforeTld) && parts.length >= 3) {
    return parts[parts.length - 3] || beforeTld;
  }
  return beforeTld || parts[0] || "";
}

function getBrandKeywordCandidates(domain: string): string[] {
  const brand = getBrandRoot(domain);
  return brand ? [brand] : [];
}

function matchesProjectKeyword(value: string | null | undefined, domain: string): boolean {
  const keyword = normalizeDomain(value);
  const root = getBrandRoot(domain) || getDomainRoot(domain);
  if (!keyword || !domain) return false;
  return keyword === domain || Boolean(root && (keyword === root || keyword.includes(root))) || keyword.includes(domain);
}

function latestByCreatedAt<T extends { created_at: string }>(items: T[]): T | null {
  return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null;
}

function getDomainKeywordCandidates(domain: string): Set<string> {
  return new Set([domain, getDomainRoot(domain), getBrandRoot(domain), ...getBrandKeywordCandidates(domain)].filter(Boolean));
}

function getProjectAdCompetitors(
  histories: SearchAdsHistoryItem[],
  domain: string,
  projectId?: string
): ProjectAdCompetitor[] {
  const keywordCandidates = getDomainKeywordCandidates(domain);

  return histories
    .filter(
      (history) =>
        (projectId && history.projectId === projectId) ||
        keywordCandidates.has(normalize(history.keyword)) ||
        matchesProjectKeyword(history.keyword, domain)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .flatMap((history) =>
      history.ads.map((ad, index) => ({
        ...ad,
        rowId: `${history.id}-${ad.id || index}`,
        source: "search_ads" as const,
        keyword: history.keyword,
        scannedAt: history.createdAt,
        searchUrl: history.searchUrl,
      }))
    )
    .slice(0, 24);
}

function toTransparencyCompetitor(
  history: AdSearchHistoryItem,
  creative: AdCreativeHistoryItem,
  index: number
): TransparencyProjectCompetitor {
  return {
    rowId: `ttmb-${history.id}-${creative.id || creative.adCreativeId || index}`,
    source: "ttmb",
    advertiserName: creative.advertiser,
    advertiserDomain: creative.targetDomain,
    title: creative.advertiser,
    snippet: creative.totalDaysShown != null ? `${creative.totalDaysShown} ngày hiển thị` : null,
    targetUrl: creative.link || creative.detailsLink || creative.serpapiDetailsLink,
    format: creative.format,
    totalDaysShown: creative.totalDaysShown,
    keyword: history.text || history.advertiserIdQuery || "",
    scannedAt: history.createdAt,
  };
}

function getTransparencyProjectCompetitors(
  histories: AdSearchHistoryItem[],
  domain: string,
  projectId?: string
): TransparencyProjectCompetitor[] {
  return histories
    .filter((history) => {
      if (projectId && history.projectId === projectId) return true;
      const queryMatches =
        matchesProjectKeyword(history.text, domain) ||
        matchesProjectKeyword(history.advertiserIdQuery, domain);
      const creativeMatches = history.creatives.some((creative) =>
        matchesProjectKeyword(creative.targetDomain, domain)
      );
      return queryMatches || creativeMatches;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .flatMap((history) =>
      history.creatives.map((creative, index) =>
        toTransparencyCompetitor(history, creative, index)
      )
    )
    .slice(0, 24);
}

function getCompetitorName(item: ProjectCompetitor): string {
  return item.advertiserName || item.advertiserDomain || item.title || item.keyword || "-";
}

function getTopTrafficCountries(traffic: AffiliateLinkTrafficModel | null): TrafficCountryItem[] {
  return [...(traffic?.traffic_details?.country || [])]
    .sort((a, b) => b.traffic_share_percentage - a.traffic_share_percentage)
    .slice(0, 8);
}

const TRAFFIC_SOURCE_LABELS: Record<string, string> = {
  organic_search: "Tìm kiếm tự nhiên",
  paid_search: "Tìm kiếm trả phí",
  direct: "Truy cập trực tiếp",
  referrals: "Giới thiệu",
  social: "Mạng xã hội",
  display_ads: "Quảng cáo hiển thị",
  email: "Email",
};

function normalizeCountryName(value: string): string {
  return normalize(value).replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

function isCountryRestricted(countryName: string, project: AffiliateLinkProjectDataModel | null): boolean {
  const normalizedCountry = normalizeCountryName(countryName);
  return Boolean(
    project?.restricted_countries.some((item) => {
      const restrictedCountry = normalizeCountryName(item.country);
      return (
        restrictedCountry === normalizedCountry ||
        restrictedCountry.includes(normalizedCountry) ||
        normalizedCountry.includes(restrictedCountry)
      );
    })
  );
}

function getTopTrafficSource(traffic: AffiliateLinkTrafficModel | null) {
  const source = traffic?.traffic_details?.source;
  if (!source) return null;

  return Object.entries(source)
    .filter(([key, value]) => key !== "period_month" && typeof value === "number")
    .map(([key, value]) => ({
      key,
      label: TRAFFIC_SOURCE_LABELS[key] || key,
      value: value as number,
    }))
    .sort((a, b) => b.value - a.value)[0] || null;
}

function getProjectKeywordIdeas(
  ideas: ProjectKeywordIdea[],
  domain: string,
  projectId?: string
): ProjectKeywordIdea[] {
  const domainRoot = getBrandRoot(domain) || getDomainRoot(domain);

  return ideas
    .filter((item) => {
      const belongsToProject = Boolean(projectId && item.projectId === projectId);
      const usesBrandSeed = item.seedKeywords.some((seed) => normalize(seed) === domainRoot);
      const isExactBrandKeyword = normalize(item.keyword) === domainRoot;
      return item.inputType === "keywords" && usesBrandSeed && isExactBrandKeyword && (belongsToProject || !item.projectId);
    })
    .sort((a, b) => {
      const aProjectScore = projectId && a.projectId === projectId ? 1 : 0;
      const bProjectScore = projectId && b.projectId === projectId ? 1 : 0;
      return bProjectScore - aProjectScore || (b.avgMonthlySearches || 0) - (a.avgMonthlySearches || 0);
    })
    .slice(0, 1);
}

function getAdContentHint(project: AffiliateLinkProjectDataModel | null, topKeyword?: string): string {
  if (!project) return "Chưa có content dự án, nên quét dữ liệu dự án trước khi viết mẫu quảng cáo.";
  const offer = project.sale_content || project.event_content;
  if (offer && topKeyword) {
    return `Dùng keyword "${topKeyword}" làm nhóm quảng cáo đầu tiên, rồi viết headline xoay quanh offer: ${offer}`;
  }
  if (offer) return `Có thể viết ads quanh offer chính: ${offer}`;
  if (topKeyword) return `Có thể bắt đầu bằng keyword "${topKeyword}", nhưng cần bổ sung offer/USP rõ hơn trước khi scale.`;
  return "Chưa thấy offer hoặc keyword đủ rõ để chạy Search Ads một cách tự tin.";
}

function cleanBriefText(value: string | null | undefined): string {
  return (value || "")
    .replace(/#{1,6}\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function buildOfferBrief({
  project,
  brandKeyword,
  priorityCountry,
}: {
  project: AffiliateLinkProjectDataModel | null;
  brandKeyword: string;
  priorityCountry?: string;
}): OfferBrief {
  const saleContent = cleanBriefText(project?.sale_content);
  const eventContent = cleanBriefText(project?.event_content);
  const webSummary = cleanBriefText(project?.answer);
  const mainOffer = saleContent || eventContent || webSummary || "Chưa có offer rõ ràng từ dữ liệu đã quét.";
  const keyword = brandKeyword || "brand keyword";
  const country = priorityCountry || "thị trường ưu tiên";
  const hasOffer = Boolean(saleContent || eventContent);
  const hasWebSummary = Boolean(webSummary);
  const headlineBase = truncateText(mainOffer, 58);

  return {
    mainOffer,
    searchAngle: hasOffer
      ? `Dùng "${keyword}" làm intent chính, headline/description bám vào lợi ích cụ thể: ${truncateText(mainOffer, 120)}`
      : `Chưa nên viết ads mạnh tay; cần bổ sung offer/USP trước khi chạy keyword "${keyword}".`,
    targetIntent: `Người tìm "${keyword}" có intent brand/direct. Ưu tiên exact match, tách riêng ad group brand và chỉ mở rộng khi đã có CPA/CVR.`,
    landingPageCheck: hasWebSummary
      ? `Landing page đã có thông tin để đối chiếu offer. Trước khi chạy, kiểm tra lại restriction, payout/CPA và thông điệp có khớp thị trường ${country}.`
      : "Chưa có tóm tắt web đủ rõ; nên quét lại dữ liệu dự án hoặc kiểm tra landing page trước khi scale.",
    headlineIdeas: [
      headlineBase,
      `${keyword.toUpperCase()} Partner Program`,
      `Join ${keyword.toUpperCase()} in ${country}`,
    ].filter(Boolean).slice(0, 3),
    missingItems: [
      ...(hasOffer ? [] : ["Thiếu offer/USP rõ ràng để viết headline chuyển đổi."]),
      ...(brandKeyword ? [] : ["Chưa xác định được brand keyword từ domain."]),
      ...(priorityCountry ? [] : ["Chưa có quốc gia ưu tiên từ traffic hợp lệ."]),
      ...(hasWebSummary ? [] : ["Chưa có tóm tắt landing page để kiểm tra claim/restriction."]),
    ],
  };
}

function getCpcEstimate(keywordIdeas: ProjectKeywordIdea[], currency: string): CpcEstimate | null {
  const rows = keywordIdeas
    .filter((item) => item.lowTopPageBid != null || item.highTopPageBid != null)
    .slice(0, 8);
  if (rows.length === 0) return null;

  const lows = rows.map((item) => item.lowTopPageBid ?? item.highTopPageBid ?? 0).filter((value) => value > 0);
  const highs = rows.map((item) => item.highTopPageBid ?? item.lowTopPageBid ?? 0).filter((value) => value > 0);
  const midpoints = rows
    .map((item) => {
      const low = item.lowTopPageBid ?? item.highTopPageBid ?? 0;
      const high = item.highTopPageBid ?? item.lowTopPageBid ?? 0;
      return low > 0 || high > 0 ? (low + high) / 2 : 0;
    })
    .filter((value) => value > 0);

  if (midpoints.length === 0) return null;

  const low = Math.min(...lows);
  const high = Math.max(...highs);
  const expected = midpoints.reduce((sum, value) => sum + value, 0) / midpoints.length;
  const recommendedBid = highs.reduce((sum, value) => sum + value, 0) / highs.length;

  return {
    currency,
    keyword: rows[0].keyword,
    low,
    high,
    expected,
    recommendedBid,
    sourceCount: rows.length,
  };
}

function buildDecisionBrief({
  traffic,
  project,
  topCountries,
  keywordSignals,
  keywordIdeas,
  competitors,
}: {
  traffic: AffiliateLinkTrafficModel | null;
  project: AffiliateLinkProjectDataModel | null;
  topCountries: TrafficCountryItem[];
  keywordSignals: KeywordSignal[];
  keywordIdeas: ProjectKeywordIdea[];
  competitors: ProjectCompetitor[];
}): DecisionBrief {
  const monthlyVisits = traffic?.monthly_visits || 0;
  const priorityCountries = topCountries.filter((country) => !isCountryRestricted(country.country_name, project));
  const restrictedTrafficCountries = topCountries.filter((country) => isCountryRestricted(country.country_name, project));
  const topTrafficSource = getTopTrafficSource(traffic);
  const topKeyword = keywordIdeas[0]?.keyword || keywordSignals[0]?.keyword || "";
  const topKeywordVolume = keywordIdeas[0]?.avgMonthlySearches;
  const hasOffer = Boolean(project?.sale_content || project?.event_content);
  const score =
    (monthlyVisits >= 100000 ? 35 : monthlyVisits >= 10000 ? 25 : monthlyVisits > 0 ? 12 : 0) +
    (priorityCountries.length > 0 ? 20 : 0) +
    (keywordIdeas.length > 0 ? 18 : keywordSignals.length > 0 ? 10 : 0) +
    (hasOffer ? 15 : 0) +
    (competitors.length > 0 ? 8 : 0) -
    (restrictedTrafficCountries.length > 0 ? 12 : 0);

  const potentialLabel = score >= 70 ? "Đáng test ngân sách" : score >= 45 ? "Có thể test nhỏ" : "Cần bổ sung dữ liệu";
  const potentialText =
    score >= 70
      ? "Traffic, quốc gia ưu tiên, keyword và offer đã đủ tín hiệu để tạo chiến dịch thử nghiệm."
      : score >= 45
        ? "Có vài tín hiệu tốt, nhưng nên test ngân sách nhỏ và đo chuyển đổi trước khi scale."
        : "Thiếu một hoặc nhiều mảnh quan trọng như traffic, keyword volume, offer hoặc restriction.";

  return {
    potentialLabel,
    potentialText,
    trafficSourceLabel: topTrafficSource ? topTrafficSource.label : "Chưa rõ nguồn traffic",
    trafficSourceText: topTrafficSource
      ? `${topTrafficSource.label} đang chiếm ${topTrafficSource.value.toFixed(1)}% traffic, dùng để đo xem dự án mạnh về SEO, brand/direct hay paid.`
      : "Chưa có dữ liệu source, nên quét traffic để biết người dùng đến từ search, social, direct hay paid.",
    priorityCountryLabel: priorityCountries[0]?.country_name || "Chưa có quốc gia ưu tiên",
    priorityCountryText: priorityCountries[0]
      ? `${priorityCountries[0].country_name} chiếm ${priorityCountries[0].traffic_share_percentage.toFixed(2)}% traffic và chưa nằm trong danh sách bị hạn chế.`
      : "Chưa thấy quốc gia có traffic hợp lệ để ưu tiên test.",
    searchAdsText: getAdContentHint(project, topKeyword),
    topKeywordText: topKeyword
      ? topKeywordVolume != null
        ? `${topKeyword} (${formatCompact(topKeywordVolume)} searches/tháng)`
        : `${topKeyword} (chưa có volume từ Keyword Planner)`
      : "Chưa có keyword đủ rõ",
    restrictedText: project?.restricted_countries.length
      ? project.restricted_countries.map((item) => `${item.country} (${item.restriction_type})`).join(", ")
      : "Chưa phát hiện quốc gia bị cấm/hạn chế trong dữ liệu đã quét.",
    decisionHelp: [
      "Chọn quốc gia test đầu tiên và quốc gia cần exclude trong Google Ads.",
      "Ưu tiên keyword/offer có tín hiệu cao để viết Search Ads thay vì đoán từ đầu.",
      "Nhìn nhanh dự án có đủ dữ liệu để bỏ tiền test hay cần quét thêm traffic, keyword hoặc đối thủ.",
    ],
  };
}

function buildBudgetStrategy({
  budget,
  durationDays,
  currency,
  cpcEstimate,
  project,
  traffic,
  topCountries,
  keywordSignals,
  keywordIdeas,
}: {
  budget: number;
  durationDays: number;
  currency: string;
  cpcEstimate: CpcEstimate | null;
  project: AffiliateLinkProjectDataModel | null;
  traffic: AffiliateLinkTrafficModel | null;
  topCountries: TrafficCountryItem[];
  keywordSignals: KeywordSignal[];
  keywordIdeas: ProjectKeywordIdea[];
}): BudgetStrategy {
  const safeBudget = Math.max(0, budget);
  const safeDays = Math.max(1, Math.round(durationDays));
  const dailyBudget = safeBudget / safeDays;
  const priorityCountries = topCountries.filter((country) => !isCountryRestricted(country.country_name, project)).slice(0, 3);
  const restrictedCountries = topCountries.filter((country) => isCountryRestricted(country.country_name, project));
  const topKeywords = [
    ...keywordIdeas.map((item) => item.keyword),
    ...keywordSignals.map((item) => item.keyword),
  ]
    .filter(Boolean)
    .filter((keyword, index, items) => items.findIndex((item) => normalize(item) === normalize(keyword)) === index)
    .slice(0, 5);
  const offer = project?.sale_content || project?.event_content;
  const testDays = Math.min(safeDays, Math.max(2, Math.ceil(safeDays * 0.35)));
  const optimizeDays = Math.min(Math.max(safeDays - testDays, 0), Math.max(0, Math.ceil(safeDays * 0.35)));
  const scaleDays = Math.max(0, safeDays - testDays - optimizeDays);
  const mainCountry = priorityCountries[0]?.country_name || "thị trường hợp lệ đầu tiên";
  const mainKeyword = topKeywords[0] || "keyword brand/offer rõ intent nhất";
  const hasStrongSignals = Boolean(traffic?.monthly_visits && priorityCountries.length && topKeywords.length && offer);
  const canEstimateClicks = Boolean(cpcEstimate && cpcEstimate.currency === currency && cpcEstimate.expected > 0);
  const estimatedDailyClicks = canEstimateClicks && cpcEstimate ? dailyBudget / cpcEstimate.expected : 0;
  const totalEstimatedClicks = estimatedDailyClicks * safeDays;
  const minimumUsefulDailyClicks = 10;
  const recommendedDailyBudget = cpcEstimate ? cpcEstimate.expected * minimumUsefulDailyClicks : 0;
  const dataScore =
    (traffic?.monthly_visits ? 1 : 0) +
    (priorityCountries.length ? 1 : 0) +
    (topKeywords.length ? 1 : 0) +
    (offer ? 1 : 0) +
    (cpcEstimate ? 1 : 0);
  const budgetIsUseful = !cpcEstimate || !canEstimateClicks || dailyBudget >= recommendedDailyBudget;
  const verdictTone: BudgetStrategy["verdictTone"] =
    dataScore >= 4 && budgetIsUseful ? "good" : dataScore >= 3 || safeBudget > 0 ? "warning" : "danger";
  const verdictLabel =
    verdictTone === "good"
      ? "Đủ để test có kiểm soát"
      : verdictTone === "warning"
        ? "Chỉ nên test nhỏ"
        : "Chưa nên chạy";
  const testScopeText =
    verdictTone === "good"
      ? `Nên giữ 1 campaign Search, 1-2 ad group, tập trung brand keyword "${mainKeyword}" để lấy CPA/CVR sạch.`
      : `Giảm phạm vi còn 1 ad group brand exact cho "${mainKeyword}", chưa mở rộng keyword/quốc gia cho tới khi đủ dữ liệu.`;
  const sampleSizeText = canEstimateClicks
    ? `Ước tính ${formatNumber(estimatedDailyClicks)} click/ngày, khoảng ${formatNumber(totalEstimatedClicks)} click trong ${safeDays} ngày. Mốc hữu ích tối thiểu: ~${minimumUsefulDailyClicks} click/ngày.`
    : cpcEstimate
      ? `Chưa ước tính click vì currency ngân sách (${currency}) khác currency CPC (${cpcEstimate.currency}).`
      : "Chưa có CPC nên chưa biết ngân sách này mua được bao nhiêu click.";
  const decisionRuleText =
    "Sau 48-72h: giữ nếu CTR tốt và CPC thực trả không vượt biên cao; tắt nếu search term lệch intent hoặc không có lead/conversion.";

  const allocations = priorityCountries.length > 1
    ? [
        {
          label: `Core Search - ${mainCountry}`,
          percent: 55,
          amount: safeBudget * 0.55,
          description: `Chạy exact/phrase cho "${mainKeyword}" và các keyword sát offer để đo CPA nhanh.`,
        },
        {
          label: "Mở rộng keyword/quốc gia",
          percent: 25,
          amount: safeBudget * 0.25,
          description: `Test ${priorityCountries.slice(1).map((item) => item.country_name).join(", ")} hoặc nhóm keyword phụ có search volume.`,
        },
        {
          label: "Reserve tối ưu",
          percent: 20,
          amount: safeBudget * 0.2,
          description: "Giữ lại để tăng bid cho nhóm có CTR/CVR tốt hoặc tắt nhóm đốt tiền.",
        },
      ]
    : [
        {
          label: `Core Search - ${mainCountry}`,
          percent: 70,
          amount: safeBudget * 0.7,
          description: `Tập trung vào "${mainKeyword}" để có dữ liệu rõ trước khi mở rộng.`,
        },
        {
          label: "Discovery nhỏ",
          percent: 15,
          amount: safeBudget * 0.15,
          description: "Test broad/phrase hẹp hoặc keyword competitor nếu có landing page đủ liên quan.",
        },
        {
          label: "Reserve tối ưu",
          percent: 15,
          amount: safeBudget * 0.15,
          description: "Dùng sau ngày đầu tiên để dồn ngân sách vào nhóm có tín hiệu tốt.",
        },
      ];

  return {
    budget: safeBudget,
    durationDays: safeDays,
    dailyBudget,
    currency,
    verdictLabel,
    verdictTone,
    summary: hasStrongSignals
      ? `Chạy ${safeDays} ngày với ${formatMoney(dailyBudget, currency)}/ngày, ưu tiên ${mainCountry}, bắt đầu từ keyword "${mainKeyword}".`
      : `Chạy thận trọng ${safeDays} ngày với ${formatMoney(dailyBudget, currency)}/ngày vì dữ liệu traffic/keyword/offer chưa đủ mạnh.`,
    cpcText: cpcEstimate
      ? `Đặt max CPC khoảng ${formatMoney(cpcEstimate.recommendedBid, cpcEstimate.currency)}; CPC có thể trả trung bình khoảng ${formatMoney(cpcEstimate.expected, cpcEstimate.currency)}.`
      : "Chưa có CPC từ Keyword Planner. Hãy quét volume brand keyword trước.",
    estimatedClicksText: cpcEstimate
      ? canEstimateClicks
        ? `Với daily budget hiện tại có thể mua khoảng ${formatNumber(estimatedDailyClicks)} click/ngày.`
        : `Ngân sách đang là ${currency}, còn CPC từ Ads account là ${cpcEstimate.currency}; đổi cùng currency để ước tính click.`
      : "Chưa đủ dữ liệu để ước tính số click/ngày.",
    sampleSizeText,
    testScopeText,
    decisionRuleText,
    allocations,
    timeline: [
      {
        title: `Ngày 1-${testDays}: Test tín hiệu`,
        text: `Tạo 2-3 ad group: brand/offer, keyword volume cao, và discovery nhỏ. Chỉ dùng quốc gia không bị restriction.`,
      },
      {
        title: optimizeDays > 0 ? `Ngày ${testDays + 1}-${testDays + optimizeDays}: Tối ưu` : "Sau phase test: Tối ưu",
        text: "Tắt keyword CTR thấp, query không liên quan, hoặc quốc gia bounce cao. Dồn reserve vào nhóm có lead/conversion.",
      },
      {
        title: scaleDays > 0 ? `Ngày ${testDays + optimizeDays + 1}-${safeDays}: Scale có kiểm soát` : "Cuối chiến dịch: Kết luận",
        text: scaleDays > 0
          ? "Tăng ngân sách 20-30% cho nhóm thắng, mở thêm keyword gần nghĩa và giữ CPA mục tiêu."
          : "Nếu chưa đủ dữ liệu chuyển đổi, giữ ngân sách nhỏ và quét thêm Keyword Planner/đối thủ trước khi scale.",
      },
    ],
    actions: [
      offer ? `Viết headline bám offer: ${offer}` : "Bổ sung offer/USP trước khi scale ngân sách.",
      topKeywords.length ? `Seed keyword: ${topKeywords.join(", ")}` : "Chạy Keyword Planner theo URL để có keyword volume trước khi mở rộng.",
      cpcEstimate ? `Bid khởi điểm: đặt max CPC quanh ${formatMoney(cpcEstimate.recommendedBid, cpcEstimate.currency)}, theo dõi CPC thực trả quanh ${formatMoney(cpcEstimate.expected, cpcEstimate.currency)}.` : "Quét Keyword Planner để lấy low/high top page bid trước khi đặt CPC.",
      priorityCountries.length ? `Target trước: ${priorityCountries.map((item) => item.country_name).join(", ")}` : "Chưa có country hợp lệ, cần quét traffic hoặc kiểm tra restriction.",
    ],
    warnings: [
      ...restrictedCountries.map((item) => `Exclude ${item.country_name} vì nằm trong traffic top nhưng bị restriction.`),
      ...(safeBudget / safeDays < (currency === "VND" ? 200000 : 10)
        ? ["Daily budget khá thấp, nên giảm số ad group để mỗi nhóm đủ data."]
        : []),
      ...(cpcEstimate ? [] : ["Chưa có CPC từ Keyword Planner, chưa nên chốt max CPC/bid trước khi quét brand keyword."]),
      ...(traffic?.monthly_visits ? [] : ["Chưa có traffic scan, chiến lược hiện chỉ là khung test ban đầu."]),
    ],
  };
}

function buildProjectReadiness({
  traffic,
  project,
  topCountries,
  keywordSignals,
  keywordIdeas,
  competitors,
  cpcEstimate,
}: {
  traffic: AffiliateLinkTrafficModel | null;
  project: AffiliateLinkProjectDataModel | null;
  topCountries: TrafficCountryItem[];
  keywordSignals: KeywordSignal[];
  keywordIdeas: ProjectKeywordIdea[];
  competitors: ProjectCompetitor[];
  cpcEstimate: CpcEstimate | null;
}): ProjectReadiness {
  const hasOffer = Boolean(project?.sale_content || project?.event_content || project?.answer);
  const hasRestrictions = Boolean(project?.restricted_countries.length);
  const hasSafeCountry = topCountries.some((country) => !isCountryRestricted(country.country_name, project));
  const items: ReadinessItem[] = [
    {
      label: "Traffic",
      ready: Boolean(traffic?.monthly_visits),
      detail: traffic?.monthly_visits ? `${formatCompact(traffic.monthly_visits)} visits/tháng` : "Chưa có scan traffic",
      action: "Quét traffic trong tab Dự án",
      targetTab: "projects",
    },
    {
      label: "Country traffic",
      ready: topCountries.length > 0,
      detail: topCountries[0] ? `Top: ${topCountries[0].country_name}` : "Chưa biết quốc gia có traffic",
      action: "Quét traffic để lấy country split",
      targetTab: "projects",
    },
    {
      label: "Safe market",
      ready: hasSafeCountry,
      detail: hasSafeCountry ? "Có ít nhất 1 quốc gia chưa bị restriction" : "Chưa xác định quốc gia an toàn",
      action: "Kiểm tra country restriction trước khi chạy",
      targetTab: "projects",
    },
    {
      label: "Content/offer",
      ready: hasOffer,
      detail: hasOffer ? "Có offer/content để viết ads" : "Thiếu offer/USP rõ ràng",
      action: "Quét dữ liệu dự án hoặc bổ sung offer",
      targetTab: "projects",
    },
    {
      label: "Restriction",
      ready: Boolean(project),
      detail: hasRestrictions ? `${project?.restricted_countries.length} restriction/rule` : project ? "Đã scan, chưa thấy restriction" : "Chưa scan restriction",
      action: "Quét dữ liệu dự án để kiểm tra quốc gia bị cấm",
      targetTab: "projects",
    },
    {
      label: "Keyword volume",
      ready: keywordIdeas.length > 0,
      detail: keywordIdeas[0] ? `${keywordIdeas[0].keyword}: ${formatCompact(keywordIdeas[0].avgMonthlySearches)}` : `${keywordSignals.length} keyword signal, chưa có volume`,
      action: "Quét volume brand keyword",
      targetTab: "keyword-planner",
    },
    {
      label: "CPC",
      ready: Boolean(cpcEstimate),
      detail: cpcEstimate ? `Bid gợi ý ${formatMoney(cpcEstimate.recommendedBid, cpcEstimate.currency)}` : "Chưa có low/high top page bid",
      action: "Quét Keyword Planner trước khi chốt ngân sách",
      targetTab: "keyword-planner",
    },
    {
      label: "Competitors",
      ready: competitors.length > 0,
      detail: competitors.length ? `${competitors.length} đối thủ/tín hiệu ads` : "Chưa có đối thủ khớp dự án",
      action: "Quét quảng cáo hoặc TTMB theo brand keyword",
      targetTab: "search-ads",
    },
  ];

  const weights = [16, 12, 12, 14, 10, 14, 10, 12];
  const score = Math.min(
    100,
    items.reduce((sum, item, index) => sum + (item.ready ? weights[index] || 0 : 0), 0)
  );
  const tone = score >= 76 ? "good" : score >= 46 ? "warning" : "danger";
  const label =
    score >= 76
      ? "Sẵn sàng tạo chiến lược"
      : score >= 46
        ? "Có thể test nhỏ"
        : "Thiếu dữ liệu";
  const summary =
    score >= 76
      ? "Dữ liệu đủ tốt để chuyển sang tab Chiến lược chạy và tạo plan AI có context đầy đủ."
      : score >= 46
        ? "Có vài tín hiệu dùng được, nhưng nên hoàn thiện keyword/CPC/restriction trước khi bỏ ngân sách lớn."
        : "Chưa nên chốt campaign. Cần gom thêm traffic, keyword, country hoặc đối thủ trước.";

  return {
    score,
    label,
    tone,
    summary,
    items,
    nextActions: items.filter((item) => !item.ready).slice(0, 5),
  };
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold leading-tight">{value}</p>
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#059669]/10 text-[#059669]">
          <Icon size={17} />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon size={16} className="text-[#059669]" />
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
  );
}

function ExpandableDetails({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details className="group mt-3 rounded-md border border-border bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border p-3">{children}</div>
    </details>
  );
}

export function ProjectOverviewTab() {
  const [links, setLinks] = useState<AffiliateLinkModel[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([]);
  const [competitors, setCompetitors] = useState<SearchAdsCompetitorItem[]>([]);
  const [searchHistories, setSearchHistories] = useState<SearchAdsHistoryItem[]>([]);
  const [transparencyHistories, setTransparencyHistories] = useState<AdSearchHistoryItem[]>([]);
  const [keywordIdeas, setKeywordIdeas] = useState<ProjectKeywordIdea[]>([]);
  const [adsAccounts, setAdsAccounts] = useState<AdsAccountResponse[]>([]);
  const [selectedAdsId, setSelectedAdsId] = useState("");
  const [scanningBrandKeywords, setScanningBrandKeywords] = useState(false);
  const [budgetInput, setBudgetInput] = useState("500");
  const [durationInput, setDurationInput] = useState("7");
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const [linkRows, competitorRows, historyRows, transparencyRows, jobRows, accountRows] = await Promise.all([
        affiliateProjectService.getAffiliateLinks(),
        searchAdsService.getCompetitors().catch(() => ({ total: 0, items: [] })),
        searchAdsService.getHistory("all").catch(() => ({ total: 0, items: [] })),
        adsTransparentService.getHistory().catch(() => ({ total: 0, items: [] })),
        keywordPlannerService.listJobs(0, 100).catch(() => ({ total: 0, items: [] })),
        keywordPlannerService.listAccounts().catch(() => ({ total: 0, items: [] })),
      ]);

      const detailRows = await Promise.all(
        linkRows.map((link) =>
          affiliateProjectService
            .getAffiliateLinkDetail(link.affiliate_url)
            .then((detail) => ({ link, detail }))
            .catch(() => null)
        )
      );
      const ideaRows = await Promise.all(
        jobRows.items
          .filter((job) => job.status === "done")
          .slice(0, 30)
          .map((job) =>
            keywordPlannerService
              .getJobResults(job.id)
              .then((response) =>
                response.results.map((idea) => ({
                  ...idea,
                  jobId: job.id,
                  inputType: job.inputType,
                  projectId: job.projectId,
                  pageUrl: job.pageUrl,
                  seedKeywords: job.keywords || [],
                }))
              )
              .catch(() => [])
          )
      );

      const validSnapshots = detailRows.filter(Boolean) as ProjectSnapshot[];
      setLinks(linkRows);
      setSnapshots(validSnapshots);
      setCompetitors(competitorRows.items);
      setSearchHistories(historyRows.items);
      setTransparencyHistories(transparencyRows.items);
      setKeywordIdeas(ideaRows.flat());
      setAdsAccounts(accountRows.items);
      setSelectedAdsId((current) => current || accountRows.items[0]?.adsId || "");
      setSelectedId((current) => current || validSnapshots[0]?.link.id || linkRows[0]?.id || "");
    } catch {
      toast.error("Không tải được dữ liệu tổng hợp dự án");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const selected = useMemo(
    () => snapshots.find((item) => item.link.id === selectedId) || snapshots[0] || null,
    [selectedId, snapshots]
  );

  const latestTraffic = useMemo(
    () => latestByCreatedAt(selected?.detail.traffic_scans || []),
    [selected]
  );
  const latestProject = useMemo(
    () => latestByCreatedAt(selected?.detail.project_data_scans || []),
    [selected]
  );
  const domain = normalizeDomain(selected?.link.domain);
  const topCountries = useMemo(() => getTopTrafficCountries(latestTraffic), [latestTraffic]);
  const brandKeywordCandidates = useMemo(() => getBrandKeywordCandidates(domain), [domain]);
  const projectKeywordIdeas = useMemo(
    () => getProjectKeywordIdeas(keywordIdeas, domain, selected?.link.id),
    [domain, keywordIdeas, selected?.link.id]
  );
  const primaryBrandKeyword = brandKeywordCandidates[0] || "";
  const primaryBrandIdea = useMemo(
    () => projectKeywordIdeas.find((item) => normalize(item.keyword) === primaryBrandKeyword) || null,
    [primaryBrandKeyword, projectKeywordIdeas]
  );
  const keywordSignals = useMemo<KeywordSignal[]>(
    () => projectKeywordIdeas.map((item) => ({
      keyword: item.keyword,
      source: "Google Ads Keyword Planner",
      volume: item.avgMonthlySearches,
    })),
    [projectKeywordIdeas]
  );
  const searchAdCompetitors = useMemo(
    () => getProjectAdCompetitors(searchHistories, domain, selected?.link.id),
    [domain, searchHistories, selected?.link.id]
  );
  const transparencyCompetitors = useMemo(
    () => getTransparencyProjectCompetitors(transparencyHistories, domain, selected?.link.id),
    [domain, selected?.link.id, transparencyHistories]
  );
  const relevantCompetitors = useMemo<ProjectCompetitor[]>(
    () => [...searchAdCompetitors, ...transparencyCompetitors].slice(0, 36),
    [searchAdCompetitors, transparencyCompetitors]
  );
  const visibleKeywordSignals = keywordSignals.slice(0, 6);
  const visibleKeywordIdeas = projectKeywordIdeas.slice(0, 25);
  const visibleCompetitors = relevantCompetitors.slice(0, 6);
  const selectedAdsAccount = useMemo(
    () => adsAccounts.find((account) => account.adsId === selectedAdsId) || null,
    [adsAccounts, selectedAdsId]
  );
  const keywordPlannerCurrency = selectedAdsAccount?.currencyCode || "USD";
  const cpcEstimate = useMemo(
    () => getCpcEstimate(projectKeywordIdeas, keywordPlannerCurrency),
    [keywordPlannerCurrency, projectKeywordIdeas]
  );
  const decisionBrief = useMemo(
    () =>
      buildDecisionBrief({
        traffic: latestTraffic,
        project: latestProject,
        topCountries,
        keywordSignals,
        keywordIdeas: projectKeywordIdeas,
        competitors: relevantCompetitors,
      }),
    [keywordSignals, latestProject, latestTraffic, projectKeywordIdeas, relevantCompetitors, topCountries]
  );
  const budgetStrategy = useMemo(
    () =>
      buildBudgetStrategy({
        budget: toPositiveNumber(budgetInput, 0),
        durationDays: toPositiveNumber(durationInput, 1),
        currency,
        cpcEstimate,
        project: latestProject,
        traffic: latestTraffic,
        topCountries,
        keywordSignals,
        keywordIdeas: projectKeywordIdeas,
      }),
    [budgetInput, cpcEstimate, currency, durationInput, keywordSignals, latestProject, latestTraffic, projectKeywordIdeas, topCountries]
  );
  const readiness = useMemo(
    () =>
      buildProjectReadiness({
        traffic: latestTraffic,
        project: latestProject,
        topCountries,
        keywordSignals,
        keywordIdeas: projectKeywordIdeas,
        competitors: relevantCompetitors,
        cpcEstimate,
      }),
    [cpcEstimate, keywordSignals, latestProject, latestTraffic, projectKeywordIdeas, relevantCompetitors, topCountries]
  );
  const offerBrief = useMemo(
    () =>
      buildOfferBrief({
        project: latestProject,
        brandKeyword: primaryBrandKeyword,
        priorityCountry: topCountries.find((country) => !isCountryRestricted(country.country_name, latestProject))?.country_name,
      }),
    [latestProject, primaryBrandKeyword, topCountries]
  );

  const summaryText = useMemo(() => {
    if (!selected) return "";
    return [
      `Project: ${latestProject?.project_name || selected.link.domain}`,
      `URL: ${selected.link.affiliate_url}`,
      `Traffic: ${formatCompact(latestTraffic?.monthly_visits)} visits/month`,
      `Potential: ${decisionBrief.potentialLabel} - ${decisionBrief.potentialText}`,
      `Main traffic source: ${decisionBrief.trafficSourceLabel}`,
      `Top countries: ${topCountries.map((item) => item.country_name).join(", ") || "-"}`,
      `Restricted countries: ${latestProject?.restricted_countries.map((item) => item.country).join(", ") || "-"}`,
      `Top keyword: ${decisionBrief.topKeywordText}`,
      `CPC estimate: ${budgetStrategy.cpcText}`,
      `Budget plan: ${budgetStrategy.summary}`,
      `Google Ads Keyword Planner: ${keywordSignals.map((item) => `${item.keyword} (${formatNumber(item.volume || 0)} searches/month)`).join(", ") || "chưa có dữ liệu"}`,
      `Competitors from ad scans: ${relevantCompetitors.map((item) => item.advertiserName || item.advertiserDomain).filter(Boolean).join(", ") || "-"}`,
    ].join("\n");
  }, [budgetStrategy, decisionBrief, keywordSignals, latestProject, latestTraffic, relevantCompetitors, selected, topCountries]);

  async function copySummary() {
    if (!summaryText) return;
    await navigator.clipboard.writeText(summaryText);
    toast.success("Đã copy tổng hợp dự án");
  }

  async function scanBrandKeywords() {
    if (!selected) return;
    if (!selectedAdsId) {
      toast.error("Chọn tài khoản Google Ads trước khi quét Keyword Planner");
      return;
    }
    if (brandKeywordCandidates.length === 0) {
      toast.error("Không lấy được brand keyword từ domain hiện tại");
      return;
    }

    setScanningBrandKeywords(true);
    try {
      const result = await keywordPlannerService.scanByKeywords({
        adsId: selectedAdsId,
        keywords: brandKeywordCandidates,
        languageId: 1000,
        resultLimit: 100,
        projectId: selected.link.id,
      });

      const rows = result.results.map((idea) => ({
        ...idea,
        jobId: result.job.id,
        inputType: result.job.inputType,
        projectId: result.job.projectId,
        pageUrl: result.job.pageUrl,
        seedKeywords: result.job.keywords || brandKeywordCandidates,
      }));

      setKeywordIdeas((current) => {
        const existing = new Map(current.map((item) => [`${normalize(item.keyword)}-${item.jobId}`, item]));
        for (const row of rows) existing.set(`${normalize(row.keyword)}-${row.jobId}`, row);
        return Array.from(existing.values());
      });
      toast.success(`Đã lấy search volume Google Ads cho brand "${brandKeywordCandidates[0]}", nhận ${result.results.length} keyword ideas`);
    } catch {
      toast.error("Quét Keyword Planner thất bại, kiểm tra tài khoản Google Ads hoặc quyền truy cập");
    } finally {
      setScanningBrandKeywords(false);
    }
  }

  function openStrategyTab() {
    if (!selected) return;
    window.location.assign(`/dashboard?tab=ads-strategy-skill&projectId=${encodeURIComponent(selected.link.id)}`);
  }

  function openActionTarget(item: ReadinessItem) {
    if (!selected || !item.targetTab) return;
    window.location.assign(`/dashboard?tab=${item.targetTab}&projectId=${encodeURIComponent(selected.link.id)}`);
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3">
        <Loader2 size={30} className="animate-spin text-[#059669]" />
        <p className="text-sm text-muted-foreground">Đang gom dữ liệu dự án...</p>
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border text-center">
        <div className="flex size-16 items-center justify-center rounded-lg bg-[#059669]/10 text-[#059669]">
          <Globe2 size={28} />
        </div>
        <p className="text-sm font-semibold">Chưa có dự án để tổng hợp</p>
        <p className="max-w-md text-xs text-muted-foreground">
          Tạo affiliate link ở tab Dự án, sau đó quét Traffic và Dữ liệu dự án để màn hình này có dữ liệu đầy đủ.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Tổng hợp dữ liệu theo dự án</h2>
          <p className="text-xs text-muted-foreground">
            Một màn hình để xem content, keyword, traffic, quốc gia, restriction và đối thủ liên quan đến dự án đang chọn.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={selected?.link.id || selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            className="h-9 min-w-64 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-[#059669]/30"
          >
            {snapshots.map((item) => (
              <option key={item.link.id} value={item.link.id}>
                {item.link.domain}
              </option>
            ))}
          </select>
          <Button type="button" variant="ghost" size="sm" onClick={copySummary} className="border border-border">
            <Clipboard size={13} />
            Copy summary
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={loadData} className="border border-border">
            <RefreshCw size={13} />
            Làm mới
          </Button>
        </div>
      </div>

      {selected && (
        <>
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_260px]">
              <div
                className={`rounded-lg border p-4 ${
                  readiness.tone === "good"
                    ? "border-[#059669]/30 bg-[#059669]/5"
                    : readiness.tone === "warning"
                      ? "border-amber-300/60 bg-amber-50 dark:bg-amber-950/20"
                      : "border-red-300/60 bg-red-50 dark:bg-red-950/20"
                }`}
              >
                <p className="text-xs font-semibold uppercase text-muted-foreground">Readiness score</p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-4xl font-semibold leading-none">{readiness.score}</span>
                  <span className="pb-1 text-sm text-muted-foreground">/100</span>
                </div>
                <p className="mt-2 text-sm font-semibold">{readiness.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{readiness.summary}</p>
                <Button
                  type="button"
                  onClick={openStrategyTab}
                  className="mt-4 w-full gap-2 bg-[#059669] text-white hover:bg-[#047857]"
                >
                  <Target size={14} />
                  Tạo chiến lược từ dự án này
                </Button>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Checklist dữ liệu trước khi chạy</h3>
                    <p className="text-xs text-muted-foreground">
                      Tổng hợp nhanh dữ liệu nào đã đủ và dữ liệu nào cần bổ sung trước khi tạo campaign.
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {readiness.items.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        if (!item.ready) openActionTarget(item);
                      }}
                      disabled={item.ready || !item.targetTab}
                      className={`rounded-md border border-border bg-background px-3 py-2 text-left transition ${
                        item.ready || !item.targetTab
                          ? "cursor-default"
                          : "cursor-pointer hover:border-[#059669]/60 hover:bg-[#059669]/5"
                      }`}
                      title={!item.ready && item.action ? item.action : undefined}
                    >
                      <div className="flex items-center gap-2">
                        {item.ready ? (
                          <CheckCircle2 size={14} className="text-[#059669]" />
                        ) : (
                          <AlertTriangle size={14} className="text-amber-600" />
                        )}
                        <span className="truncate text-xs font-semibold">{item.label}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{item.detail}</p>
                      {!item.ready && item.action && (
                        <p className="mt-1 text-[11px] font-medium text-[#059669]">{item.action}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Next actions</p>
                {readiness.nextActions.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {readiness.nextActions.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => openActionTarget(item)}
                        disabled={!item.targetTab}
                        className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-[#059669]/5 disabled:cursor-default disabled:hover:bg-transparent"
                      >
                        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                        <div className="min-w-0">
                          <p className="font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.action}</p>
                          {item.targetTab && (
                            <p className="mt-0.5 text-[11px] font-medium text-[#059669]">Bấm để mở tab cần xử lý</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 flex items-start gap-2 text-sm">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#059669]" />
                    <p className="text-muted-foreground">
                      Dữ liệu chính đã đủ. Chuyển sang Chiến lược chạy để Gemini tạo plan chi tiết.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={BarChart3}
              label="Traffic"
              value={formatCompact(latestTraffic?.monthly_visits)}
              detail={latestTraffic?.period_month ? `Tháng ${latestTraffic.period_month}` : "Chưa có scan traffic"}
            />
            <StatCard
              icon={Globe2}
              label="Quốc gia"
              value={`${topCountries.length}`}
              detail={topCountries[0]?.country_name ? `Top: ${topCountries[0].country_name}` : "Chưa có country traffic"}
            />
            <StatCard
              icon={Hash}
              label="Keyword"
              value={`${projectKeywordIdeas.length}`}
              detail="100% từ Google Ads Keyword Planner"
            />
            <StatCard
              icon={Users}
              label="Đối thủ"
              value={`${relevantCompetitors.length}`}
              detail={`Từ lần quét quảng cáo keyword ${domain || "-"}`}
            />
          </div>

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Góc nhìn cho người mới chạy affiliate ads</p>
                <h3 className="mt-1 text-lg font-semibold">{decisionBrief.potentialLabel}</h3>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{decisionBrief.potentialText}</p>
              </div>
              <div className="rounded-md bg-[#059669]/10 px-3 py-2 text-xs font-medium text-[#047857]">
                Nên đọc phần này trước khi bỏ ngân sách test
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-md border border-border p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Traffic chính từ đâu?</p>
                <p className="mt-1 text-sm font-semibold">{decisionBrief.trafficSourceLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">{decisionBrief.trafficSourceText}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Quốc gia nên ưu tiên</p>
                <p className="mt-1 text-sm font-semibold">{decisionBrief.priorityCountryLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">{decisionBrief.priorityCountryText}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Keyword nhiều traffic nhất</p>
                <p className="mt-1 text-sm font-semibold">{decisionBrief.topKeywordText}</p>
                <p className="mt-1 text-xs text-muted-foreground">Dùng làm seed để mở rộng keyword và kiểm tra intent mua/chuyển đổi.</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">CPC cần đặt / ước trả</p>
                <p className="mt-1 text-sm font-semibold">
                  {cpcEstimate
                    ? `${formatMoney(cpcEstimate.recommendedBid, cpcEstimate.currency)} bid`
                    : "Chưa có CPC"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cpcEstimate
                    ? `CPC thực trả ước khoảng ${formatMoney(cpcEstimate.expected, cpcEstimate.currency)}; biên ${formatMoney(cpcEstimate.low, cpcEstimate.currency)}-${formatMoney(cpcEstimate.high, cpcEstimate.currency)}.`
                    : "Quét volume brand keyword để lấy low/high top page bid từ Keyword Planner."}
                </p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Content chạy Google Search Ads</p>
                <p className="mt-1 text-sm text-muted-foreground">{decisionBrief.searchAdsText}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Quốc gia bị cấm/hạn chế</p>
                <p className="mt-1 text-sm text-muted-foreground">{decisionBrief.restrictedText}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Những thông tin này giúp gì?</p>
                <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                  {decisionBrief.decisionHelp.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <SectionHeader icon={DollarSign} title="Kiểm tra nhanh ngân sách" />
                <p className="text-sm text-muted-foreground">
                  Nhập số tiền và thời gian muốn chạy để kiểm tra daily budget, CPC và rủi ro dữ liệu trước khi tạo chiến lược chi tiết bằng AI.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(140px,1fr)_100px_minmax(110px,0.8fr)] xl:min-w-[460px]">
                <label className="text-xs font-medium text-muted-foreground">
                  Tổng ngân sách
                  <input
                    type="number"
                    min="0"
                    value={budgetInput}
                    onChange={(event) => setBudgetInput(event.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#059669]/30"
                  />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  Tiền tệ
                  <select
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#059669]/30"
                  >
                    <option value="USD">USD</option>
                    <option value="VND">VND</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  Số ngày chạy
                  <input
                    type="number"
                    min="1"
                    value={durationInput}
                    onChange={(event) => setDurationInput(event.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[#059669]/30"
                  />
                </label>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)_minmax(0,1fr)]">
              <div
                className={`rounded-md border p-3 ${
                  budgetStrategy.verdictTone === "good"
                    ? "border-[#059669]/30 bg-[#059669]/5"
                    : budgetStrategy.verdictTone === "warning"
                      ? "border-amber-300/60 bg-amber-50 dark:bg-amber-950/20"
                      : "border-red-300/60 bg-red-50 dark:bg-red-950/20"
                }`}
              >
                <p className="text-xs font-semibold uppercase text-muted-foreground">Kết luận ngân sách</p>
                <p className="mt-1 text-lg font-semibold">{budgetStrategy.verdictLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">{budgetStrategy.sampleSizeText}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Phạm vi test nên chạy</p>
                <p className="mt-1 text-sm text-muted-foreground">{budgetStrategy.testScopeText}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Luật quyết định</p>
                <p className="mt-1 text-sm text-muted-foreground">{budgetStrategy.decisionRuleText}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-md border border-border p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                  <DollarSign size={13} /> Daily budget
                </p>
                <p className="mt-1 text-lg font-semibold">{formatMoney(budgetStrategy.dailyBudget, budgetStrategy.currency)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tổng {formatMoney(budgetStrategy.budget, budgetStrategy.currency)} trong {budgetStrategy.durationDays} ngày.
                </p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                  <CalendarDays size={13} /> Timeline
                </p>
                <p className="mt-1 text-lg font-semibold">{budgetStrategy.durationDays} ngày</p>
                <p className="mt-1 text-xs text-muted-foreground">{budgetStrategy.summary}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                  <Target size={13} /> Mục tiêu
                </p>
                <p className="mt-1 text-sm font-semibold">Lấy dữ liệu CPA/CVR trước khi scale</p>
                <p className="mt-1 text-xs text-muted-foreground">{budgetStrategy.cpcText}</p>
                <p className="mt-1 text-xs text-muted-foreground">{budgetStrategy.estimatedClicksText}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Phân bổ ngân sách đề xuất</p>
                  <div className="grid gap-3 md:grid-cols-3">
                    {budgetStrategy.allocations.map((item) => (
                      <div key={item.label} className="rounded-md border border-border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{item.label}</p>
                          <span className="rounded bg-[#059669]/10 px-2 py-0.5 text-xs font-medium text-[#047857]">
                            {item.percent}%
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium">{formatMoney(item.amount, budgetStrategy.currency)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Cách chạy trong giai đoạn này</p>
                  <div className="grid gap-3 md:grid-cols-3">
                    {budgetStrategy.timeline.map((item) => (
                      <div key={item.title} className="rounded-md border border-border p-3">
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Việc cần làm ngay</p>
                  <div className="mt-2 space-y-2">
                    {budgetStrategy.actions.map((item) => (
                      <div key={item} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#059669]" />
                        <p className="text-muted-foreground">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Cảnh báo trước khi chạy</p>
                  <div className="mt-2 space-y-2">
                    {budgetStrategy.warnings.length > 0 ? (
                      budgetStrategy.warnings.map((item) => (
                        <div key={item} className="flex items-start gap-2 text-sm">
                          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                          <p className="text-muted-foreground">{item}</p>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-start gap-2 text-sm">
                        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#059669]" />
                        <p className="text-muted-foreground">Chưa có cảnh báo lớn từ dữ liệu hiện tại.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase text-muted-foreground">Dự án đang xem</p>
                <h3 className="mt-1 truncate text-lg font-semibold">
                  {latestProject?.project_name || selected.link.domain}
                </h3>
                <a
                  href={selected.link.affiliate_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-[#059669] hover:underline"
                >
                  <span className="truncate">{selected.link.affiliate_url}</span>
                  <ExternalLink size={11} className="shrink-0" />
                </a>
              </div>
              <div className="grid gap-2 text-xs sm:grid-cols-2 lg:min-w-[360px]">
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="font-semibold">Project link</p>
                  <p className="mt-1 truncate text-muted-foreground">{latestProject?.project_link || "-"}</p>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="font-semibold">Scan trạng thái</p>
                  <p className="mt-1 text-muted-foreground">
                    {latestTraffic ? "Có traffic" : "Thiếu traffic"} · {latestProject ? "Có content" : "Thiếu content"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
            <div className="space-y-5">
              <section className="rounded-lg border border-border bg-card p-4">
                <SectionHeader icon={FileText} title="Content & offer" />
                {latestProject ? (
                  <div className="space-y-3">
                    <div className="rounded-md border border-[#059669]/30 bg-[#059669]/5 p-3">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Offer chính để viết ads</p>
                      <p className="mt-2 text-sm font-medium">{offerBrief.mainOffer}</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Góc chạy Google Search</p>
                        <p className="mt-2 text-sm text-muted-foreground">{offerBrief.searchAngle}</p>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Intent & match type</p>
                        <p className="mt-2 text-sm text-muted-foreground">{offerBrief.targetIntent}</p>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Headline gợi ý</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {offerBrief.headlineIdeas.map((item) => (
                            <span key={item} className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Kiểm tra landing page</p>
                        <p className="mt-2 text-sm text-muted-foreground">{offerBrief.landingPageCheck}</p>
                      </div>
                    </div>
                    <div className="rounded-md border border-border p-3">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Còn thiếu trước khi chạy</p>
                      {offerBrief.missingItems.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {offerBrief.missingItems.map((item) => (
                            <div key={item} className="flex items-start gap-2 text-sm">
                              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                              <p className="text-muted-foreground">{item}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 flex items-start gap-2 text-sm">
                          <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#059669]" />
                          <p className="text-muted-foreground">Đã đủ offer, brand keyword, country ưu tiên và landing summary để viết ads test.</p>
                        </div>
                      )}
                    </div>
                    <ExpandableDetails label="Xem dữ liệu content gốc">
                      <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-md border border-border p-3">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Event content</p>
                      <p className="mt-2 text-sm">{latestProject.event_content || "-"}</p>
                    </div>
                    <div className="rounded-md border border-border p-3">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Sale content</p>
                      <p className="mt-2 text-sm">{latestProject.sale_content || "-"}</p>
                    </div>
                    {latestProject.answer && (
                      <div className="rounded-md border border-border p-3 md:col-span-2">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Tóm tắt từ web</p>
                        <p className="mt-2 line-clamp-5 text-sm text-muted-foreground">{latestProject.answer}</p>
                      </div>
                    )}
                      </div>
                    </ExpandableDetails>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Chưa có dữ liệu content. Quét Dữ liệu dự án trong tab Dự án.</p>
                )}
              </section>

              <section className="rounded-lg border border-border bg-card p-4">
                <SectionHeader icon={Hash} title="Keyword liên quan" />
                <div className="mb-4 rounded-md border border-border bg-muted/20 p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Brand keyword từ domain</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {brandKeywordCandidates.slice(0, 8).map((keyword) => (
                          <span
                            key={keyword}
                            className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Domain <strong>{domain || "-"}</strong> được rút về brand <strong>{primaryBrandKeyword || "-"}</strong>. Chỉ seed brand này được gửi sang Google Ads Keyword Planner.
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_auto] lg:min-w-[420px]">
                      <select
                        value={selectedAdsId}
                        onChange={(event) => setSelectedAdsId(event.target.value)}
                        className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-[#059669]/30"
                      >
                        {adsAccounts.length === 0 ? (
                          <option value="">Chưa có Google Ads account</option>
                        ) : (
                          adsAccounts.map((account) => (
                            <option key={account.adsId} value={account.adsId}>
                              {account.adsName} ({account.adsId})
                            </option>
                          ))
                        )}
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={scanBrandKeywords}
                        disabled={scanningBrandKeywords || !selectedAdsId || brandKeywordCandidates.length === 0}
                        className="border border-border"
                      >
                        {scanningBrandKeywords ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <ScanLine size={13} />
                        )}
                        Lấy search volume Google Ads
                      </Button>
                    </div>
                  </div>
                  {projectKeywordIdeas.length > 0 && (
                    <>
                      <div className="mt-3 rounded-md border border-[#059669]/30 bg-[#059669]/5 px-3 py-2 text-sm">
                        {primaryBrandIdea ? (
                          <p>
                            Kết luận theo Google Search: <strong>“{primaryBrandIdea.keyword}”</strong> có trung bình <strong>{formatNumber(primaryBrandIdea.avgMonthlySearches)} lượt tìm kiếm/tháng</strong>. Không sử dụng traffic keyword từ Similarweb cho kết luận này.
                          </p>
                        ) : (
                        <p>Keyword Planner chưa trả về đúng brand “{primaryBrandKeyword}”. Phần này chỉ hiển thị dữ liệu của brand keyword, không lấy keyword ideas liên quan.</p>
                        )}
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-3">
                        {projectKeywordIdeas.slice(0, 6).map((item) => (
                          <div key={`${item.jobId}-${item.id}`} className="rounded-md border border-border bg-background px-3 py-2">
                            <p className="truncate text-sm font-semibold">{item.keyword}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatCompact(item.avgMonthlySearches)} searches/tháng · {item.competition}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              CPC {item.lowTopPageBid != null ? formatMoney(item.lowTopPageBid, keywordPlannerCurrency) : "-"}
                              {" - "}
                              {item.highTopPageBid != null ? formatMoney(item.highTopPageBid, keywordPlannerCurrency) : "-"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {projectKeywordIdeas.length > 0 && (
                  <div className="mb-4">
                    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold">Dữ liệu brand keyword từ Google Ads Keyword Planner</p>
                        <p className="text-xs text-muted-foreground">
                          Chỉ hiển thị từ khóa thương hiệu của dự án và các chỉ số Google Search của chính từ khóa đó.
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Brand keyword: {primaryBrandKeyword || "-"}
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-md border border-border">
                      <table className="w-full min-w-[760px] border-collapse text-sm">
                        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="border-b border-border px-3 py-2 text-left font-semibold">Từ khóa</th>
                            <th className="border-b border-border px-3 py-2 text-right font-semibold">Số lần tìm kiếm TB/tháng</th>
                            <th className="border-b border-border px-3 py-2 text-left font-semibold">Cạnh tranh</th>
                            <th className="border-b border-border px-3 py-2 text-right font-semibold">Giá thầu đầu trang thấp</th>
                            <th className="border-b border-border px-3 py-2 text-right font-semibold">Giá thầu đầu trang cao</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleKeywordIdeas.map((item) => {
                            const isSeedKeyword = normalize(item.keyword) === primaryBrandKeyword;
                            return (
                              <tr key={`${item.jobId}-${item.id}-metrics`} className="border-b border-border last:border-0">
                                <td className="px-3 py-2">
                                  <div className="flex flex-col">
                                    <span className="font-medium">{item.keyword}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {isSeedKeyword ? "Từ khóa thương hiệu của dự án" : "Không dùng keyword idea liên quan"}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right font-medium">
                                  {formatNumber(item.avgMonthlySearches)}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">{item.competition || "-"}</td>
                                <td className="px-3 py-2 text-right text-muted-foreground">
                                  {formatOptionalMoney(item.lowTopPageBid, keywordPlannerCurrency)}
                                </td>
                                <td className="px-3 py-2 text-right text-muted-foreground">
                                  {formatOptionalMoney(item.highTopPageBid, keywordPlannerCurrency)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {keywordSignals.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {visibleKeywordSignals.map((item) => (
                        <span
                          key={`${item.keyword}-${item.source}`}
                          className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium"
                        >
                          {item.keyword}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Chỉ hiển thị brand keyword của dự án từ Google Ads Keyword Planner. Mở chi tiết để xem volume.
                    </p>
                    <ExpandableDetails label="Xem chi tiết keyword">
                      <div className="grid gap-2 md:grid-cols-2">
                        {keywordSignals.map((item) => (
                          <div key={`${item.keyword}-${item.source}`} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{item.keyword}</p>
                              <p className="text-xs text-muted-foreground">{item.source}</p>
                            </div>
                            {item.volume != null && <span className="text-xs text-muted-foreground">{formatCompact(item.volume)}</span>}
                          </div>
                        ))}
                      </div>
                    </ExpandableDetails>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Chưa có dữ liệu Google Search cho brand này. Chọn tài khoản Google Ads và bấm “Lấy search volume Google Ads”.
                  </p>
                )}
              </section>

              <section className="rounded-lg border border-border bg-card p-4">
                <SectionHeader icon={Users} title="Đối thủ liên quan" />
                {relevantCompetitors.length > 0 ? (
                  <>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {visibleCompetitors.map((item) => (
                        <div key={item.rowId} className="rounded-md border border-border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{getCompetitorName(item)}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.source === "ttmb" ? "TTMB" : "Quét quảng cáo"} · Keyword: {item.keyword}
                              </p>
                            </div>
                            <span className="rounded bg-[#059669]/10 px-2 py-0.5 text-xs font-medium text-[#059669]">
                              {item.source === "ttmb" ? item.format || "TTMB" : `${Math.round(item.confidence * 100)}%`}
                            </span>
                          </div>
                          {item.title && <p className="mt-2 line-clamp-1 text-sm">{item.title}</p>}
                          {item.snippet && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.snippet}</p>}
                          {(item.targetUrl || ("landingPage" in item && item.landingPage?.finalUrl)) && (
                            <a
                              href={("landingPage" in item && item.landingPage?.finalUrl) || item.targetUrl || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-xs text-[#059669] hover:underline"
                            >
                              Xem landing page <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Tìm thấy {searchAdCompetitors.length} từ Quét quảng cáo và {transparencyCompetitors.length} từ TTMB.
                    </p>
                    <ExpandableDetails label="Xem toàn bộ đối thủ">
                      <div className="grid gap-3 lg:grid-cols-2">
                        {relevantCompetitors.map((item) => (
                          <div key={item.rowId} className="rounded-md border border-border bg-background p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">{item.advertiserName || item.advertiserDomain || item.title || item.keyword}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {item.source === "ttmb" ? "Đối thủ (TTMB)" : "Quét quảng cáo"} · {new Date(item.scannedAt).toLocaleDateString("vi-VN")}
                                </p>
                              </div>
                              <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                {item.keyword || "-"}
                              </span>
                            </div>
                            {item.advertiserDomain && <p className="mt-2 truncate text-xs text-muted-foreground">Domain: {item.advertiserDomain}</p>}
                            {item.snippet && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.snippet}</p>}
                            {(item.targetUrl || ("landingPage" in item && item.landingPage?.finalUrl)) && (
                              <a
                                href={("landingPage" in item && item.landingPage?.finalUrl) || item.targetUrl || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-flex items-center gap-1 text-xs text-[#059669] hover:underline"
                              >
                                Xem dữ liệu gốc <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </ExpandableDetails>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Chưa tìm thấy đối thủ từ Quét quảng cáo hoặc TTMB theo domain/brand của dự án ({domain || "-"}).
                  </p>
                )}
              </section>
            </div>

            <aside className="space-y-5">
              <section className="rounded-lg border border-border bg-card p-4">
                <SectionHeader icon={Target} title="Traffic & quốc gia" />
                {topCountries.length > 0 ? (
                  <div className="space-y-3">
                    {topCountries.map((country) => (
                      <div key={country.country_code || country.country_name}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                          <span className="truncate font-medium">{country.country_name}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {country.traffic_share_percentage.toFixed(2)}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-[#059669]"
                            style={{ width: `${Math.min(100, Math.max(0, country.traffic_share_percentage))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Chưa có dữ liệu country traffic.</p>
                )}
              </section>

              <section className="rounded-lg border border-border bg-card p-4">
                <SectionHeader icon={ShieldAlert} title="Restricted countries" />
                {latestProject?.restricted_countries.length ? (
                  <div className="space-y-2">
                    {latestProject.restricted_countries.slice(0, 10).map((item) => (
                      <div key={`${item.country}-${item.restriction_type}`} className="rounded-md border border-border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{item.country}</p>
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            {item.restriction_type}
                          </span>
                        </div>
                        {item.signals?.[0] && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.signals[0]}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
                    {latestProject ? (
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#059669]" />
                    ) : (
                      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                    )}
                    <p className="text-muted-foreground">
                      {latestProject
                        ? "Chưa phát hiện restricted countries từ dữ liệu đã quét."
                        : "Chưa có scan dự án để kiểm tra restriction."}
                    </p>
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-border bg-card p-4">
                <SectionHeader icon={Search} title="Nguồn dữ liệu đã gom" />
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Affiliate links</span>
                    <span className="font-semibold">{links.length}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Traffic scans</span>
                    <span className="font-semibold">{selected.detail.traffic_scans.length}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Project scans</span>
                    <span className="font-semibold">{selected.detail.project_data_scans.length}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Saved competitors</span>
                    <span className="font-semibold">{competitors.length}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Search ad scans</span>
                    <span className="font-semibold">{searchHistories.length}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Keyword jobs</span>
                    <span className="font-semibold">{new Set(keywordIdeas.map((item) => item.jobId)).size}</span>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
