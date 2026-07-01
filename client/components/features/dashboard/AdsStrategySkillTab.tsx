"use client";

import { type ReactNode, useEffect, useMemo, useState, useRef } from "react";
import {
  AlertTriangle,
  Check,
  Clipboard,
  Database,
  FileText,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adsStrategyService } from "@/services/adsStrategy.service";
import { adsTransparentService } from "@/services/adsTransparent.service";
import { affiliateProjectService } from "@/services/affiliateProject.service";
import { keywordPlannerService } from "@/services/keywordPlanner.service";
import { manualSearchService } from "@/services/manualSearch.service";
import { searchAdsService } from "@/services/searchAds.service";
import type {
  AffiliateLinkDetailResponse,
  AffiliateLinkModel,
  AffiliateLinkProjectDataModel,
  AffiliateLinkTrafficModel,
  TrafficCountryItem,
} from "@/types/affiliateProject.types";
import type { AdSearchHistoryItem } from "@/types/adsTransparent.types";
import type {
  AdsStrategyApiKey,
  AdsStrategyGenerateResponse,
  AdsStrategyPrompt,
  AdsStrategyResult,
  Country,
} from "@/types/adsStrategy.types";
import type { KeywordIdeaItem } from "@/types/keywordPlanner.types";
import type { ManualCompetitorSearchHistoryItem } from "@/types/manualSearch.types";
import type {
  SearchAdsCompetitorItem,
  SearchAdsHistoryItem,
} from "@/types/searchAds.types";

const DEFAULT_FIELDS = [
  { key: "website_url", label: "Website hoặc Landing Page", type: "url", required: true },
  { key: "project_context", label: "Dữ liệu dự án tự động", type: "textarea", required: false },
  { key: "brand_or_offer", label: "Tên brand/offer", type: "text", required: false },
  { key: "industry", label: "Ngành hàng", type: "text", required: false },
  { key: "restricted_countries", label: "Quốc gia cấm/hạn chế", type: "text", required: false },
  { key: "market", label: "Thị trường ưu tiên", type: "text", required: false },
  { key: "budget", label: "Ngân sách dự kiến", type: "text", required: false },
  { key: "payout", label: "Payout/commission", type: "text", required: false },
  { key: "response_language", label: "Ngôn ngữ kết quả", type: "select", required: false },
  { key: "notes", label: "Ghi chú bổ sung", type: "textarea", required: false },
];

const INNER_TABS = [
  { id: "run", label: "Chạy phân tích", icon: Sparkles },
  { id: "keys", label: "API keys", icon: KeyRound },
  { id: "prompts", label: "Prompt", icon: FileText },
  { id: "results", label: "Kết quả", icon: Clipboard },
] as const;

type InnerTab = (typeof INNER_TABS)[number]["id"];

const RESULTS_PER_PAGE = 5;
const LANGUAGE_INSTRUCTION_START = "[OUTPUT_LANGUAGE_INSTRUCTION]";
const LANGUAGE_INSTRUCTION_END = "[/OUTPUT_LANGUAGE_INSTRUCTION]";

function languageInstruction(language: string) {
  const targetLanguage = language === "English" ? "English" : "Tiếng Việt";
  return `${LANGUAGE_INSTRUCTION_START}
Kết quả Gemini trả về phải được viết bằng ${targetLanguage}.
- Toàn bộ tiêu đề báo cáo, phần phân tích, giải thích, competitor notes, customer segments và reasoning phải dùng ${targetLanguage}.
- Riêng ad assets như target keywords, negative keywords, headlines, descriptions, callouts và sitelinks vẫn phải viết bằng English theo quy tắc Google Ads.
${LANGUAGE_INSTRUCTION_END}`;
}

function applyLanguageInstruction(template: string, language: string) {
  const pattern = new RegExp(
    `\\n*${LANGUAGE_INSTRUCTION_START}[\\s\\S]*?${LANGUAGE_INSTRUCTION_END}`,
    "g"
  );
  return `${template.replace(pattern, "").trim()}\n\n${languageInstruction(language)}`;
}

const DEFAULT_PROMPT = `Hãy đóng vai một Media Buyer chuyên chạy Google Ads Search cho các dự án affiliate.

Mục tiêu của bạn là phân tích link affiliate/landing page, đọc dữ liệu hệ thống đã thu thập, kiểm soát rủi ro chính sách và tạo chiến lược test có thể triển khai thật.

Website/Landing page: {{website_url}}
Tên brand/offer: {{brand_or_offer}}
Ngành hàng: {{industry}}
Thị trường ưu tiên: {{market}}
Quốc gia bị cấm/hạn chế đã biết: {{restricted_countries}}
Ngân sách dự kiến: {{budget}}
Payout/commission: {{payout}}
Ngôn ngữ kết quả mong muốn: {{response_language}}
Ghi chú bổ sung: {{notes}}

Dữ liệu hệ thống đã thu thập:
{{project_context}}

Nhiệm vụ:
1. Đọc và phân tích website/dữ liệu hệ thống để xác định sản phẩm/dịch vụ, ngành hàng, ưu thế cốt lõi, khuyến mãi và tracking affiliate hiện có nếu có.
2. Kiểm tra cảnh báo chính sách Google Ads liên quan trực tiếp đến ngành hàng, quốc gia, brand bidding và affiliate tracking.
3. Xuất toàn bộ báo cáo trong một câu trả lời theo đúng cấu trúc dưới đây.

## 1. Phân tích sản phẩm, đối thủ và thị trường
- Xác định sản phẩm/dịch vụ là gì.
- Xác định thị trường mục tiêu và giai đoạn hiện tại của ngành: tăng trưởng, bão hòa hoặc suy giảm. Phải có số liệu, thống kê hoặc nguồn nghiên cứu thị trường để hỗ trợ; không kết luận cảm tính.
- Đề xuất thị trường địa lý tối ưu nhất.
- Phân tích 5 đối thủ trực tiếp cùng ngành. Với mỗi đối thủ, nêu rõ:
  - Strengths: lợi thế, tính năng hoặc điểm mạnh nổi bật.
  - Weaknesses: hạn chế, điểm yếu hoặc khoảng trống dịch vụ.
- Xác định USP độc quyền khiến sản phẩm chính nổi bật hơn 5 đối thủ trên.

## 2. Phân tích Google Search keywords
- Kiểm tra khả năng brand bidding. Nếu brand bidding bị cấm hoặc rủi ro, tự động chuyển sang solution-based keywords hoặc competitor/alternative keywords.
- Mặc định chỉ dùng các keyword đã được hệ thống lấy trong mục [KEYWORD_PLANNER] của dữ liệu hệ thống. Không tự tạo thêm keyword mới nếu chưa ghi rõ là "Suggested expansion".
- Tạo bảng keyword bằng tiếng Anh từ đúng danh sách keyword đã có volume. Ưu tiên mạnh Exact Match để kiểm soát ngân sách.
- Với mỗi keyword, cung cấp volume ước tính theo 3 tháng gần nhất và phân tích xu hướng 3 tháng: tăng, giảm hoặc đi ngang.
- Phân tích search intent và nhu cầu thật của người tìm kiếm.

## 3. Phân khúc khách hàng mục tiêu
Phân tích ít nhất 3 tệp khách hàng cốt lõi. Với mỗi tệp, trình bày:
- Demographics: độ tuổi, giới tính, lối sống, hành vi.
- Pain Points & Barriers: vấn đề họ gặp và rào cản chuyển đổi.
- Needs & Desires: kỳ vọng thực chất khi dùng sản phẩm.
- Messaging Angle: hướng thông điệp thuyết phục nhất.

## 4. Đề xuất Google Ads Search campaign và content
- Đề xuất cấu trúc Ad Groups tối ưu theo từng phân khúc khách hàng.
- Đề xuất keyword kèm match type phù hợp, ưu tiên Exact Match cho tối ưu ngân sách và chuyển đổi.
- Viết Responsive Search Ads theo từng phân khúc khách hàng. Số mẫu ad copy phải đúng bằng số tệp khách hàng đã phân tích.
- Mỗi mẫu RSA phải gồm:
  - 15 Headlines bằng tiếng Anh, mỗi headline tối đa 30 ký tự. Lồng ghép urgency/scarcity nếu website có khuyến mãi.
  - 4 Descriptions bằng tiếng Anh, mỗi description tối đa 90 ký tự.
- Viết 4 Callouts bằng tiếng Anh, mỗi callout tối đa 25 ký tự.
- Viết 4 Sitelinks bằng tiếng Anh. Mỗi sitelink gồm title tối đa 25 ký tự, 2 dòng description tối đa 35 ký tự mỗi dòng và URL.
- Nếu URL người dùng có tham số referral như ?ref= hoặc ?fpr=, mọi sitelink/final URL phải giữ và append đúng tham số đó để tracking affiliate.
- Đề xuất Negative Keywords List bằng tiếng Anh để tránh query rác như free, crack, login, support...
- Phác thảo cấu trúc Bridge Page / Pre-lander để tăng Quality Score và tránh rủi ro direct redirect.
- Ngân sách khởi đầu đề xuất bắt buộc tối thiểu $50 - $100/ngày hoặc cao hơn.

Quy tắc bắt buộc:
- Báo cáo phân tích, giải thích và customer segment phải viết theo ngôn ngữ kết quả mong muốn: {{response_language}}.
- Toàn bộ ad content, target keywords, negative keywords, callouts và sitelinks viết bằng tiếng Anh.
- Giải thích thuật ngữ như Exact Match, Ad Group, Responsive Search Ads bằng ngôn ngữ kết quả đã chọn khi nhắc lần đầu.
- Không bịa số liệu, search volume hoặc market growth. Nếu không có dữ liệu realtime, ghi rõ [ESTIMATED].
- Với Crypto/Forex, tuyệt đối tránh từ dễ bị hạn chế trong ad copy như crypto, forex, trading, bitcoin, token, coin, giao dịch, kiếm tiền, đầu tư, invest, profit, signals. Dùng cách diễn đạt an toàn hơn như digital assets, contracts, copying, following, automating, monitoring.
- Luôn giải thích lý do đằng sau các đề xuất quan trọng bằng chữ nghiêng.

${languageInstruction("Tiếng Việt")}`;

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
  }
  return error instanceof Error ? error.message : fallback;
}

function formatDate(value: string | null) {
  if (!value) return "Chưa dùng";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <span key={index}>{part}</span>;
  });
}

function isTableSeparator(line: string) {
  return /^\s*\|?[\s:-]+\|[\s|:-]+\|?\s*$/.test(line);
}

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

interface ProjectKeywordIdea extends KeywordIdeaItem {
  jobId: string;
  pageUrl?: string | null;
  seedKeywords: string[];
}

interface StrategyProjectData {
  detail: AffiliateLinkDetailResponse | null;
  keywordIdeas: ProjectKeywordIdea[];
  searchHistories: SearchAdsHistoryItem[];
  savedSearchCompetitors: SearchAdsCompetitorItem[];
  manualHistories: ManualCompetitorSearchHistoryItem[];
  transparencyHistories: AdSearchHistoryItem[];
}

interface ContextChecklistItem {
  label: string;
  ready: boolean;
  detail: string;
  action?: string;
  targetTab?: string;
}

interface StrategyContextResult {
  text: string;
  checklist: ContextChecklistItem[];
  suggestedMarket: string;
  keywordIdeas: ProjectKeywordIdea[];
}

function normalize(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function normalizeDomain(value: string | null | undefined): string {
  return normalize(value).replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

function getBrandRoot(domain: string): string {
  const parts = normalizeDomain(domain).split(".").filter(Boolean);
  if (parts.length <= 2) return parts[0] || "";
  const secondLevelTlds = new Set(["co", "com", "net", "org", "ac", "gov"]);
  const beforeTld = parts[parts.length - 2];
  return secondLevelTlds.has(beforeTld) && parts.length >= 3
    ? parts[parts.length - 3] || beforeTld
    : beforeTld || parts[0] || "";
}

function getBrandKeywordCandidates(domain: string): string[] {
  const brand = getBrandRoot(domain);
  if (!brand) return [];
  return [
    brand,
    `${brand} review`,
    `${brand} promo code`,
    `${brand} bonus`,
    `${brand} app`,
    `${brand} login`,
    `${brand} affiliate`,
  ];
}

function latestBySnakeCreatedAt<T extends { created_at: string }>(items: T[]): T | null {
  return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null;
}

function latestTraffic(detail: AffiliateLinkDetailResponse | null): AffiliateLinkTrafficModel | null {
  return latestBySnakeCreatedAt(detail?.traffic_scans || []);
}

function latestProjectScan(detail: AffiliateLinkDetailResponse | null): AffiliateLinkProjectDataModel | null {
  return latestBySnakeCreatedAt(detail?.project_data_scans || []);
}

function topTrafficCountries(traffic: AffiliateLinkTrafficModel | null): TrafficCountryItem[] {
  return [...(traffic?.traffic_details?.country || [])]
    .sort((a, b) => b.traffic_share_percentage - a.traffic_share_percentage)
    .slice(0, 8);
}

function matchesProject(value: string | null | undefined, project: AffiliateLinkModel | null): boolean {
  if (!project) return false;
  const text = normalize(value);
  const domain = normalizeDomain(project.domain || project.affiliate_url);
  const brand = getBrandRoot(domain);
  return Boolean(
    text &&
      ((domain && text.includes(domain)) ||
        (brand && text.includes(brand)) ||
        (project.id && text.includes(project.id.toLowerCase())) ||
        (project.name && text.includes(project.name.toLowerCase())))
  );
}

function compactText(value: string | null | undefined, max = 280): string {
  const cleaned = (value || "").replace(/\s+/g, " ").trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 3)}...` : cleaned;
}

function formatCompactNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function currencyFromKeywordIdeas(ideas: ProjectKeywordIdea[]): string {
  return ideas.some((item) => item.lowTopPageBid != null || item.highTopPageBid != null) ? "account currency" : "unknown";
}

function keywordPlannerRunInstruction(keywordIdeas: ProjectKeywordIdea[]): string {
  const allowedKeywords = keywordIdeas.map((item) => item.keyword).filter(Boolean);
  return [
    "[KEYWORD_DEFAULT_RULE]",
    allowedKeywords.length
      ? `Default Google Search keywords must be limited to these fetched Keyword Planner keywords only: ${allowedKeywords.join(", ")}.`
      : "No fetched Keyword Planner keywords are available. Do not invent default keywords; ask the user to scan Keyword Planner first or clearly label any keyword as Suggested expansion.",
    "In section #2, build the main keyword table only from the fetched Keyword Planner list above. Any extra solution-based, competitor, or alternative keyword must be separated under a clearly labeled Suggested expansion section and must not be treated as default.",
    "[/KEYWORD_DEFAULT_RULE]",
  ].join("\n");
}

function buildStrategyContext(
  project: AffiliateLinkModel | null,
  data: StrategyProjectData,
  userInput: {
    market: string;
    budget: string;
    payout: string;
    brandOrOffer: string;
    industry: string;
    restrictedCountries: string;
    notes: string;
  }
): StrategyContextResult {
  if (!project) {
    return {
      text: "Chưa chọn dự án trong hệ thống. Chỉ dùng dữ liệu người dùng nhập thủ công.",
      suggestedMarket: userInput.market,
      keywordIdeas: [],
      checklist: [
        { label: "Dự án", ready: false, detail: "Chưa chọn dự án", action: "Tạo hoặc chọn dự án", targetTab: "projects" },
        { label: "Traffic", ready: false, detail: "Chưa có dữ liệu", action: "Quét traffic trong tab Dự án", targetTab: "projects" },
        { label: "Keyword Planner", ready: false, detail: "Chưa có dữ liệu", action: "Quét keyword/CPC trong Google Ads", targetTab: "keyword-planner" },
        { label: "Đối thủ", ready: false, detail: "Chưa có dữ liệu", action: "Quét quảng cáo theo keyword", targetTab: "search-ads" },
      ],
    };
  }

  const detail = data.detail;
  const traffic = latestTraffic(detail);
  const projectScan = latestProjectScan(detail);
  const countries = topTrafficCountries(traffic);
  const restricted = projectScan?.restricted_countries || [];
  const domain = normalizeDomain(project.domain || project.affiliate_url);
  const brandKeywords = getBrandKeywordCandidates(domain);
  const keywordIdeas = data.keywordIdeas
    .filter((item) => {
      const pageDomain = normalizeDomain(item.pageUrl);
      const keyword = normalize(item.keyword);
      const brand = getBrandRoot(domain);
      return (
        pageDomain === domain ||
        pageDomain.endsWith(`.${domain}`) ||
        item.seedKeywords.some((seed) => matchesProject(seed, project)) ||
        Boolean(brand && keyword.includes(brand))
      );
    })
    .sort((a, b) => (b.avgMonthlySearches || 0) - (a.avgMonthlySearches || 0))
    .slice(0, 20);

  const searchRows = data.searchHistories
    .filter((item) => item.projectId === project.id || matchesProject(item.keyword, project))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  const savedCompetitors = data.savedSearchCompetitors
    .filter((item) => matchesProject(item.keyword, project) || matchesProject(item.advertiserDomain, project))
    .slice(0, 12);
  const manualRows = data.manualHistories
    .filter((item) => item.projectId === project.id || matchesProject(item.keyword, project))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  const ttmbRows = data.transparencyHistories
    .filter((item) => {
      if (item.projectId === project.id) return true;
      return (
        matchesProject(item.text, project) ||
        matchesProject(item.advertiserIdQuery, project) ||
        item.creatives.some((creative) => matchesProject(creative.targetDomain, project))
      );
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);

  const competitorNames = new Map<string, string>();
  for (const item of savedCompetitors) {
    const key = item.advertiserDomain || item.advertiserName || item.title || item.keyword;
    if (key) competitorNames.set(normalize(key), `${item.advertiserName || item.title || key} (${item.advertiserDomain || item.keyword})`);
  }
  for (const row of searchRows) {
    for (const ad of row.ads.slice(0, 5)) {
      const key = ad.advertiserDomain || ad.advertiserName || ad.title;
      if (key) competitorNames.set(normalize(key), `${ad.advertiserName || ad.title || key} (${ad.advertiserDomain || ad.displayUrl || row.keyword})`);
    }
  }
  for (const row of manualRows) {
    for (const ad of row.ads.slice(0, 5)) {
      const key = ad.destinationDomain || ad.advertiser || ad.title;
      if (key) competitorNames.set(normalize(key), `${ad.advertiser || ad.title || key} (${ad.destinationDomain || row.keyword})`);
    }
  }
  for (const row of ttmbRows) {
    for (const creative of row.creatives.slice(0, 5)) {
      const key = creative.targetDomain || creative.advertiser;
      if (key) competitorNames.set(normalize(key), `${creative.advertiser} (${creative.targetDomain || "TTMB"})`);
    }
  }

  const suggestedMarket = userInput.market || countries.find((country) => {
    const countryName = normalize(country.country_name);
    return !restricted.some((item) => normalize(item.country).includes(countryName) || countryName.includes(normalize(item.country)));
  })?.country_name || "All";

  const lines = [
    "[PROJECT]",
    `Name: ${project.name || projectScan?.project_name || "-"}`,
    `Affiliate URL: ${project.affiliate_url}`,
    `Domain: ${domain || "-"}`,
    `Search query: ${project.search_query || "-"}`,
    `Brand/offer input: ${userInput.brandOrOffer || projectScan?.project_name || project.name || "-"}`,
    `Industry input: ${userInput.industry || "-"}`,
    "",
    "[USER_INPUT]",
    `Preferred market: ${userInput.market || "-"}`,
    `Known restricted countries: ${userInput.restrictedCountries || "-"}`,
    `Budget: ${userInput.budget || "Chưa nhập; hãy đề xuất 3 phương án test và hỏi lại nếu cần chốt ngân sách"}`,
    `Payout/commission: ${userInput.payout || "-"}`,
    `Notes/rules: ${userInput.notes || "-"}`,
    "",
    "[PROJECT_SCAN]",
    `Project link detected: ${projectScan?.project_link || "-"}`,
    `Event content: ${compactText(projectScan?.event_content, 500) || "-"}`,
    `Sale content/offer: ${compactText(projectScan?.sale_content, 500) || "-"}`,
    `AI scan answer: ${compactText(projectScan?.answer, 900) || "-"}`,
    "",
    "[TRAFFIC]",
    traffic
      ? `Latest monthly visits: ${formatCompactNumber(traffic.monthly_visits)} in ${traffic.period_month}; found=${traffic.found}`
      : "No traffic scan found.",
    countries.length
      ? `Top countries: ${countries.map((item) => `${item.country_name} ${item.traffic_share_percentage.toFixed(2)}%`).join("; ")}`
      : "Top countries: none.",
    traffic?.traffic_details?.source
      ? `Traffic source share: ${Object.entries(traffic.traffic_details.source)
          .filter(([key, value]) => key !== "period_month" && typeof value === "number")
          .map(([key, value]) => `${key}=${Number(value).toFixed(1)}%`)
          .join("; ")}`
      : "Traffic sources: none.",
    "",
    "[COUNTRY_RESTRICTIONS]",
    restricted.length
      ? restricted.map((item) => `${item.country}: ${item.restriction_type}; confidence=${item.confidence || "-"}; signals=${item.signals.join(" | ")}`).join("\n")
      : "No restricted/banned countries found in previous scans.",
    "",
    "[KEYWORD_PLANNER]",
    keywordIdeas.length
      ? `Default keyword set from fetched Keyword Planner data: ${keywordIdeas.map((item) => item.keyword).join(", ")}`
      : "Default keyword set from fetched Keyword Planner data: none.",
    `Brand keyword candidates: ${brandKeywords.join(", ") || "-"}`,
    keywordIdeas.length
      ? keywordIdeas
          .map((item) => {
            const bids = item.lowTopPageBid != null || item.highTopPageBid != null
              ? `CPC low/high ${item.lowTopPageBid ?? "-"}-${item.highTopPageBid ?? "-"} ${currencyFromKeywordIdeas(keywordIdeas)}`
              : "CPC unavailable";
            return `${item.keyword}: ${item.avgMonthlySearches || 0} avg monthly searches; competition=${item.competition}; ${bids}`;
          })
          .join("\n")
      : "No matching Keyword Planner ideas found. Ask to scan brand keywords/page URL before final CPC decision.",
    "",
    "[COMPETITORS]",
    competitorNames.size
      ? Array.from(competitorNames.values()).slice(0, 24).join("\n")
      : "No matched competitors found from Search Ads, SerpAPI/manual search, saved competitors or TTMB.",
    "",
    "[SEARCH_ADS_HISTORY]",
    searchRows.length
      ? searchRows.map((item) => `${item.keyword}: ${item.totalAdsFound} ads, ${item.createdAt}`).join("\n")
      : "No Search Ads scan matched this project.",
    "",
    "[SERPAPI_MANUAL_HISTORY]",
    manualRows.length
      ? manualRows.map((item) => `${item.keyword}: ${item.totalAdsFound} ads, ${item.createdAt}`).join("\n")
      : "No SerpAPI/manual competitor scan matched this project.",
    "",
    "[TTMB_HISTORY]",
    ttmbRows.length
      ? ttmbRows.map((item) => `${item.text || item.advertiserIdQuery || "-"}: ${item.creatives.length} creatives, ${item.createdAt}`).join("\n")
      : "No TTMB/Ads Transparency scan matched this project.",
  ];

  const checklist: ContextChecklistItem[] = [
    { label: "Dự án", ready: true, detail: project.name || domain || project.affiliate_url },
    { label: "Traffic", ready: Boolean(traffic), detail: traffic ? `${formatCompactNumber(traffic.monthly_visits)} visits/tháng` : "Chưa quét traffic", action: "Quét traffic trong tab Dự án", targetTab: "projects" },
    { label: "Country traffic", ready: countries.length > 0, detail: countries[0] ? `Top: ${countries[0].country_name}` : "Chưa có country", action: "Quét traffic để lấy country split", targetTab: "projects" },
    { label: "Restriction", ready: restricted.length > 0, detail: restricted.length ? `${restricted.length} quốc gia/rule` : "Chưa có dữ liệu cấm/hạn chế", action: "Quét dữ liệu dự án để kiểm tra restriction", targetTab: "projects" },
    { label: "Keyword volume", ready: keywordIdeas.length > 0, detail: keywordIdeas[0] ? `${keywordIdeas[0].keyword}: ${formatCompactNumber(keywordIdeas[0].avgMonthlySearches)}` : "Chưa có Keyword Planner", action: "Quét keyword/CPC trong Google Ads", targetTab: "keyword-planner" },
    { label: "CPC", ready: keywordIdeas.some((item) => item.lowTopPageBid != null || item.highTopPageBid != null), detail: "Low/high top page bid", action: "Quét Keyword Planner trước khi chốt ngân sách", targetTab: "keyword-planner" },
    { label: "Đối thủ", ready: competitorNames.size > 0, detail: competitorNames.size ? `${competitorNames.size} đối thủ/tín hiệu` : "Chưa có đối thủ khớp dự án", action: "Quét quảng cáo hoặc TTMB theo brand keyword", targetTab: "search-ads" },
    { label: "Ngân sách", ready: Boolean(userInput.budget.trim()), detail: userInput.budget.trim() || "Chưa nhập" },
    { label: "Payout", ready: Boolean(userInput.payout.trim()), detail: userInput.payout.trim() || "Chưa nhập" },
  ];

  return { text: lines.join("\n"), checklist, suggestedMarket, keywordIdeas };
}

function StrategyResultView({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      nodes.push(
        <pre key={nodes.length} className="overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">
          {code.join("\n")}
        </pre>
      );
      continue;
    }

    if (trimmed.includes("|") && lines[index + 1] && isTableSeparator(lines[index + 1])) {
      const headers = parseTableRow(trimmed);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].trim().includes("|")) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }
      nodes.push(
        <div key={nodes.length} className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-[#059669]/10 text-[#065f46]">
              <tr>
                {headers.map((header, cellIndex) => (
                  <th key={cellIndex} className="border-b border-border px-3 py-2 text-left font-semibold">
                    {renderInline(header)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="odd:bg-background even:bg-muted/30">
                  {headers.map((_, cellIndex) => (
                    <td key={cellIndex} className="border-b border-border px-3 py-2 align-top text-muted-foreground">
                      {renderInline(row[cellIndex] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const className =
        level === 1
          ? "border-b border-border pb-2 text-xl font-bold text-foreground"
          : level === 2
            ? "mt-5 text-lg font-bold text-foreground"
            : "mt-4 text-base font-semibold text-foreground";
      nodes.push(
        <h3 key={nodes.length} className={className}>
          {renderInline(heading[2])}
        </h3>
      );
      index += 1;
      continue;
    }

    const listMatch = trimmed.match(/^([-*]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const items: string[] = [listMatch[2]];
      index += 1;
      while (index < lines.length) {
        const next = lines[index].trim().match(/^([-*]|\d+\.)\s+(.+)$/);
        if (!next) break;
        items.push(next[2]);
        index += 1;
      }
      nodes.push(
        <ul key={nodes.length} className="space-y-2 rounded-lg bg-muted/30 p-4">
          {items.map((item, itemIndex) => (
            <li key={itemIndex} className="flex gap-2 text-sm leading-6 text-muted-foreground">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#059669]" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    const paragraph: string[] = [trimmed];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].trim().startsWith("```") &&
      !lines[index].trim().match(/^(#{1,4})\s+(.+)$/) &&
      !lines[index].trim().match(/^([-*]|\d+\.)\s+(.+)$/) &&
      !(lines[index].trim().includes("|") && lines[index + 1] && isTableSeparator(lines[index + 1]))
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    nodes.push(
      <p key={nodes.length} className="text-sm leading-7 text-muted-foreground">
        {renderInline(paragraph.join(" "))}
      </p>
    );
  }

  return <div className="space-y-4">{nodes}</div>;
}

interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
  clearable?: boolean;
  clearText?: string;
}

function CustomSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Chọn...",
  showSearch = false,
  searchPlaceholder = "Tìm kiếm...",
  clearable = false,
  clearText = "Xóa lựa chọn",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredOptions = useMemo(() => {
    if (!showSearch) return options;
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(query));
  }, [options, search, showSearch]);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="relative flex flex-col" ref={containerRef}>
      {label && <span className="text-sm font-medium mb-1">{label}</span>}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none hover:border-[#059669]/50 focus-within:border-[#059669] transition min-h-[42px]"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="text-xs text-muted-foreground">▼</span>
      </div>
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 flex w-full flex-col rounded-lg border border-border bg-card p-2 shadow-lg max-h-[300px]">
          {showSearch && (
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="mb-2 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-[#059669]"
              autoFocus
            />
          )}
          <div className="overflow-y-auto flex-1 space-y-0.5 max-h-[200px]">
            {clearable && value && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                  setIsOpen(false);
                  setSearch("");
                }}
                className="flex w-full items-center px-3 py-2 text-left text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition"
              >
                {clearText}
              </button>
            )}
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Không tìm thấy kết quả
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted ${isSelected ? "bg-[#059669]/10 font-medium text-[#059669]" : "text-foreground"
                      }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check size={14} className="text-[#059669]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdsStrategySkillTab() {
  const [apiKeys, setApiKeys] = useState<AdsStrategyApiKey[]>([]);
  const [prompts, setPrompts] = useState<AdsStrategyPrompt[]>([]);
  const [results, setResults] = useState<AdsStrategyResult[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [selectedPromptId, setSelectedPromptId] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingResult, setSavingResult] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeInnerTab, setActiveInnerTab] = useState<InnerTab>("run");
  const [resultPage, setResultPage] = useState(1);

  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);

  const [runModelName, setRunModelName] = useState("gemini-2.0-flash");
  const [runAvailableModels, setRunAvailableModels] = useState<string[]>([
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-1.5-flash",
    "gemini-1.5-pro"
  ]);
  const [isFetchingRunModels, setIsFetchingRunModels] = useState(false);

  const [websiteUrl, setWebsiteUrl] = useState("");
  const [brandOrOffer, setBrandOrOffer] = useState("");
  const [industry, setIndustry] = useState("");
  const [market, setMarket] = useState("Vietnam");
  const [restrictedCountries, setRestrictedCountries] = useState("");
  const [budget, setBudget] = useState("");
  const [payout, setPayout] = useState("");
  const [responseLanguage, setResponseLanguage] = useState("Tiếng Việt");
  const [notes, setNotes] = useState("");
  const [affiliateLinks, setAffiliateLinks] = useState<AffiliateLinkModel[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectData, setProjectData] = useState<StrategyProjectData>({
    detail: null,
    keywordIdeas: [],
    searchHistories: [],
    savedSearchCompetitors: [],
    manualHistories: [],
    transparencyHistories: [],
  });
  const [projectContextLoading, setProjectContextLoading] = useState(false);

  const [countries, setCountries] = useState<Country[]>([]);
  const marketOptions = useMemo(() => {
    const opts = [{ value: "All", label: "Tất cả quốc gia (All)" }];
    countries.forEach((c) => {
      opts.push({ value: c.nameEn, label: `${c.nameVi} (${c.nameEn})` });
    });
    return opts;
  }, [countries]);

  const [promptName, setPromptName] = useState("Prompt chiến lược ads");
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_PROMPT);
  const [lastResponse, setLastResponse] = useState<AdsStrategyGenerateResponse | null>(null);

  const [promptMode, setPromptMode] = useState<"template" | "compiled" | "manual">("compiled");
  const [manualResultText, setManualResultText] = useState("");
  const [promptCopied, setPromptCopied] = useState(false);

  const selectedProject = useMemo(
    () => affiliateLinks.find((item) => item.id === selectedProjectId) ?? null,
    [affiliateLinks, selectedProjectId]
  );

  const strategyContext = useMemo(
    () =>
      buildStrategyContext(selectedProject, projectData, {
        market: market.trim(),
        budget: budget.trim(),
        payout: payout.trim(),
        brandOrOffer: brandOrOffer.trim(),
        industry: industry.trim(),
        restrictedCountries: restrictedCountries.trim(),
        notes: notes.trim(),
      }),
    [brandOrOffer, budget, industry, market, notes, payout, projectData, restrictedCountries, selectedProject]
  );

  const promptTemplateForRun = useMemo(() => {
    const keywordRule = keywordPlannerRunInstruction(strategyContext.keywordIdeas);
    if (promptTemplate.includes("{{project_context}}")) {
      return `${promptTemplate.trim()}\n\n${keywordRule}`;
    }
    return `${promptTemplate.trim()}\n\n## Dữ liệu hệ thống đã thu thập\n{{project_context}}\n\n${keywordRule}\n\nHãy ưu tiên dữ liệu trong phần này hơn suy đoán chung. Nếu dữ liệu nào thiếu, ghi rõ ở mục dữ liệu cần kiểm tra thêm.`;
  }, [promptTemplate, strategyContext.keywordIdeas]);

  const compiledPrompt = useMemo(() => {
    let result = promptTemplateForRun;
    const values = {
      website_url: websiteUrl.trim(),
      project_context: strategyContext.text,
      brand_or_offer: brandOrOffer.trim(),
      industry: industry.trim(),
      market: market.trim(),
      restricted_countries: restrictedCountries.trim(),
      budget: budget.trim(),
      payout: payout.trim(),
      response_language: responseLanguage,
      notes: notes.trim(),
    };
    for (const [key, val] of Object.entries(values)) {
      result = result.replaceAll(`{{${key}}}`, val || `[chưa nhập ${key}]`);
    }
    return result;
  }, [
    brandOrOffer,
    budget,
    industry,
    market,
    notes,
    payout,
    promptTemplateForRun,
    responseLanguage,
    restrictedCountries,
    strategyContext.text,
    websiteUrl,
  ]);

  const handleCopyPrompt = async () => {
    const textToCopy = promptMode === "template" ? promptTemplate : compiledPrompt;
    await navigator.clipboard.writeText(textToCopy);
    setPromptCopied(true);
    window.setTimeout(() => setPromptCopied(false), 1500);
    toast.success("Đã copy nội dung prompt!");
  };

  const selectedPrompt = useMemo(
    () => prompts.find((prompt) => prompt.id === selectedPromptId) ?? null,
    [prompts, selectedPromptId]
  );
  const inputValues = useMemo(
    () => ({
      website_url: websiteUrl.trim(),
      project_context: strategyContext.text,
      brand_or_offer: brandOrOffer.trim(),
      industry: industry.trim(),
      market: market.trim(),
      restricted_countries: restrictedCountries.trim(),
      budget: budget.trim(),
      payout: payout.trim(),
      response_language: responseLanguage,
      notes: notes.trim(),
    }),
    [brandOrOffer, budget, industry, market, notes, payout, responseLanguage, restrictedCountries, strategyContext.text, websiteUrl]
  );

  const totalResultPages = Math.max(1, Math.ceil(results.length / RESULTS_PER_PAGE));
  const paginatedResults = results.slice(
    (resultPage - 1) * RESULTS_PER_PAGE,
    resultPage * RESULTS_PER_PAGE
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [keysRes, promptsRes, resultsRes, countriesRes, linksRes] = await Promise.all([
        adsStrategyService.listApiKeys(),
        adsStrategyService.listPrompts(),
        adsStrategyService.listResults(),
        adsStrategyService.getCountries(),
        affiliateProjectService.getAffiliateLinks().catch(() => []),
      ]);
      setApiKeys(keysRes.items);
      setPrompts(promptsRes.items);
      setResults(resultsRes.items);
      setCountries(countriesRes);
      setAffiliateLinks(linksRes);
      setSelectedKeyId((current) => current || keysRes.items[0]?.id || "");
      const projectIdFromUrl =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("projectId") || ""
          : "";
      setSelectedProjectId((current) => current || projectIdFromUrl || linksRes[0]?.id || "");
      const defaultPrompt = promptsRes.items.find((item) => item.isDefault) ?? promptsRes.items[0];
      if (defaultPrompt) {
        setSelectedPromptId((current) => current || defaultPrompt.id);
        setPromptName(defaultPrompt.name);
        setPromptTemplate(defaultPrompt.promptTemplate);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Không tải được dữ liệu bộ skill."));
    } finally {
      setLoading(false);
    }
  };

  const loadProjectContext = async (project: AffiliateLinkModel | null) => {
    if (!project) {
      setProjectData({
        detail: null,
        keywordIdeas: [],
        searchHistories: [],
        savedSearchCompetitors: [],
        manualHistories: [],
        transparencyHistories: [],
      });
      return;
    }

    setProjectContextLoading(true);
    try {
      const [detail, jobsRes, searchHistory, savedCompetitors, manualHistory, ttmbHistory] = await Promise.all([
        affiliateProjectService.getAffiliateLinkDetail(project.affiliate_url).catch(() => null),
        keywordPlannerService.listJobs(0, 100).catch(() => ({ total: 0, items: [] })),
        searchAdsService.getHistory("all").catch(() => ({ total: 0, items: [] })),
        searchAdsService.getCompetitors().catch(() => ({ total: 0, items: [] })),
        manualSearchService.getHistory().catch(() => ({ total: 0, items: [] })),
        adsTransparentService.getHistory(1, 100).catch(() => ({ total: 0, page: 1, pageSize: 100, totalPages: 0, items: [] })),
      ]);

      const jobs = jobsRes.items || [];
      const matchingJobs = jobs.filter((job) => {
        const pageDomain = normalizeDomain(job.pageUrl);
        return (
          job.status === "done" &&
          (pageDomain === normalizeDomain(project.domain) ||
            pageDomain.endsWith(`.${normalizeDomain(project.domain)}`) ||
            (job.keywords || []).some((keyword) => matchesProject(keyword, project)))
        );
      });
      const keywordIdeaGroups = await Promise.all(
        matchingJobs.slice(0, 12).map((job) =>
          keywordPlannerService
            .getJobResults(job.id)
            .then((res) =>
              res.results.map((item) => ({
                ...item,
                jobId: job.id,
                pageUrl: job.pageUrl,
                seedKeywords: job.keywords || [],
              }))
            )
            .catch(() => [] as ProjectKeywordIdea[])
        )
      );

      setProjectData({
        detail,
        keywordIdeas: keywordIdeaGroups.flat(),
        searchHistories: searchHistory.items || [],
        savedSearchCompetitors: savedCompetitors.items || [],
        manualHistories: manualHistory.items || [],
        transparencyHistories: ttmbHistory.items || [],
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Không gom được dữ liệu dự án."));
    } finally {
      setProjectContextLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProjectContext(selectedProject);
  }, [selectedProject]);

  useEffect(() => {
    if (!selectedProject || websiteUrl.trim()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWebsiteUrl(selectedProject.affiliate_url);
    setBrandOrOffer(selectedProject.name || getBrandRoot(selectedProject.domain) || "");
    if (selectedProject.search_query) setIndustry(selectedProject.search_query);
  }, [selectedProject, websiteUrl]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFetchedModels([]);
  }, [newKeyValue]);

  useEffect(() => {
    if (!selectedKeyId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRunAvailableModels([
        "gemini-2.0-flash",
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-1.5-flash",
        "gemini-1.5-pro"
      ]);
      setRunModelName("gemini-2.0-flash");
      return;
    }

    let active = true;
    const fetchRunModels = async () => {
      setIsFetchingRunModels(true);
      try {
        const res = await adsStrategyService.checkModels({ apiKeyId: selectedKeyId });
        if (active && res.models && res.models.length > 0) {
          setRunAvailableModels(res.models);
          // Auto-select a default model if current runModelName is not in the list
          const defaultOrder = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash"];
          let bestModel = "";
          for (const m of defaultOrder) {
            if (res.models.includes(m)) {
              bestModel = m;
              break;
            }
          }
          if (!bestModel) {
            bestModel = res.models[0];
          }
          setRunModelName(bestModel);
        }
      } catch (err) {
        console.error("Lỗi khi tải model cho key chạy:", err);
      } finally {
        if (active) {
          setIsFetchingRunModels(false);
        }
      }
    };

    void fetchRunModels();
    return () => {
      active = false;
    };
  }, [selectedKeyId]);

  const handleSelectPrompt = (promptId: string) => {
    setSelectedPromptId(promptId);
    const prompt = prompts.find((item) => item.id === promptId);
    if (prompt) {
      setPromptName(prompt.name);
      setPromptTemplate(prompt.promptTemplate);
    }
  };

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    const project = affiliateLinks.find((item) => item.id === projectId);
    if (!project) return;
    setWebsiteUrl(project.affiliate_url);
    setBrandOrOffer(project.name || getBrandRoot(project.domain) || "");
    if (project.search_query) setIndustry(project.search_query);
  };

  const openChecklistTarget = (item: ContextChecklistItem) => {
    if (!item.targetTab) return;
    const projectId = selectedProject?.id || selectedProjectId;
    const projectQuery = projectId ? `&projectId=${encodeURIComponent(projectId)}` : "";
    window.location.assign(`/dashboard?tab=${item.targetTab}${projectQuery}`);
  };

  const handleFetchModels = async (keyToFetch: string) => {
    if (!keyToFetch || keyToFetch.trim().length < 10) return;
    setIsFetchingModels(true);
    setFetchedModels([]);
    try {
      const res = await adsStrategyService.checkModels({ apiKey: keyToFetch.trim() });
      if (res.models && res.models.length > 0) {
        setFetchedModels(res.models);
        toast.success(`Đã tải thành công ${res.models.length} model từ API key!`);
      } else {
        toast.warning("Không tìm thấy model nào hỗ trợ generateContent với API key này.");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể xác thực API key hoặc lấy danh sách model."));
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim() || !newKeyValue.trim()) {
      toast.error("Nhập tên key và Gemini API key trước.");
      return;
    }
    try {
      const created = await adsStrategyService.createApiKey({
        displayName: newKeyName.trim(),
        apiKey: newKeyValue.trim(),
        modelName: "gemini-2.0-flash",
      });
      setApiKeys((items) => [created, ...items]);
      setSelectedKeyId(created.id);
      setNewKeyName("");
      setNewKeyValue("");
      setFetchedModels([]);
      toast.success("Đã lưu Gemini API key.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không lưu được API key."));
    }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      await adsStrategyService.deleteApiKey(id);
      setApiKeys((items) => items.filter((item) => item.id !== id));
      if (selectedKeyId === id) setSelectedKeyId("");
      toast.success("Đã xóa API key.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không xóa được API key."));
    }
  };

  const handleSavePrompt = async () => {
    try {
      if (selectedPromptId) {
        const updated = await adsStrategyService.updatePrompt(selectedPromptId, {
          name: promptName.trim() || "Prompt chiến lược ads",
          promptTemplate,
          inputFields: DEFAULT_FIELDS,
          isDefault: selectedPrompt?.isDefault ?? false,
        });
        setPrompts((items) => items.map((item) => (item.id === updated.id ? updated : item)));
        toast.success("Đã cập nhật prompt.");
      } else {
        const created = await adsStrategyService.createPrompt({
          name: promptName.trim() || "Prompt chiến lược ads",
          promptTemplate,
          inputFields: DEFAULT_FIELDS,
          isDefault: prompts.length === 0,
        });
        setPrompts((items) => [created, ...items]);
        setSelectedPromptId(created.id);
        toast.success("Đã tạo prompt mới.");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Không lưu được prompt."));
    }
  };

  const handleCreatePromptCopy = () => {
    setSelectedPromptId("");
    setPromptName(`${promptName || "Prompt chiến lược ads"} - bản mới`);
    toast.info("Đang tạo bản prompt mới, chỉnh xong bấm Lưu prompt.");
  };

  const handleResponseLanguageChange = (language: string) => {
    setResponseLanguage(language);
    setPromptTemplate((current) => applyLanguageInstruction(current, language));
  };

  const handleDeletePrompt = async () => {
    if (!selectedPromptId) return;
    try {
      await adsStrategyService.deletePrompt(selectedPromptId);
      const nextPrompts = prompts.filter((item) => item.id !== selectedPromptId);
      setPrompts(nextPrompts);
      const nextPrompt = nextPrompts.find((item) => item.isDefault) ?? nextPrompts[0];
      setSelectedPromptId(nextPrompt?.id ?? "");
      setPromptName(nextPrompt?.name ?? "Prompt chiến lược ads");
      setPromptTemplate(nextPrompt?.promptTemplate ?? DEFAULT_PROMPT);
      toast.success("Đã xóa prompt.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không xóa được prompt."));
    }
  };

  const handleGenerate = async () => {
    if (!selectedKeyId) {
      toast.error("Hãy thêm hoặc chọn Gemini API key.");
      return;
    }
    if (!websiteUrl.trim()) {
      toast.error("Nhập website hoặc landing page cần phân tích.");
      return;
    }
    setGenerating(true);
    setLastResponse(null);
    try {
      const response = await adsStrategyService.generate({
        apiKeyId: selectedKeyId,
        promptId: selectedPromptId || null,
        promptTemplate: applyLanguageInstruction(promptTemplateForRun, responseLanguage),
        inputValues,
        modelName: runModelName,
      });
      setLastResponse(response);
      setActiveInnerTab("run");
      toast.success("Gemini đã trả kết quả chiến lược.");
      void loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Gemini API lỗi. Hãy kiểm tra key hoặc đổi key khác."));
      void loadData();
    } finally {
      setGenerating(false);
    }
  };

  const validateInputs = () => {
    if (!websiteUrl.trim()) {
      toast.error("Vui lòng nhập Website hoặc Landing Page.");
      return false;
    }
    if (!market.trim()) {
      toast.error("Vui lòng chọn Thị trường ưu tiên.");
      return false;
    }
    if (!responseLanguage.trim()) {
      toast.error("Vui lòng chọn Ngôn ngữ kết quả.");
      return false;
    }
    return true;
  };

  const handleSaveManualResult = async () => {
    if (!validateInputs()) return;
    if (!manualResultText.trim()) {
      toast.error("Vui lòng nhập hoặc dán nội dung kết quả.");
      return;
    }
    setSavingResult(true);
    try {
      const saved = await adsStrategyService.saveResult({
        title: websiteUrl.trim() || "Chiến lược ads",
        apiKeyId: selectedKeyId || null,
        promptId: selectedPromptId || null,
        websiteUrl: websiteUrl.trim(),
        market: market.trim(),
        budget: budget.trim(),
        notes: notes.trim(),
        modelName: selectedKeyId ? runModelName : "Manual Input",
        promptText: compiledPrompt,
        responseText: manualResultText.trim(),
        rawResponse: null,
        inputValues,
        promptTokens: null,
        responseTokens: null,
        totalTokens: null,
      });
      setResults((items) => [saved, ...items]);
      setManualResultText("");
      toast.success("Đã lưu kết quả AI từ nguồn ngoài.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không lưu được kết quả."));
    } finally {
      setSavingResult(false);
    }
  };

  const handleSaveResult = async () => {
    if (!lastResponse) return;
    if (!validateInputs()) return;
    setSavingResult(true);
    try {
      const saved = await adsStrategyService.saveResult({
        title: websiteUrl.trim() || "Chiến lược ads",
        apiKeyId: lastResponse.apiKeyId,
        promptId: lastResponse.promptId,
        websiteUrl: websiteUrl.trim(),
        market: market.trim(),
        budget: budget.trim(),
        notes: notes.trim(),
        modelName: lastResponse.modelName,
        promptText: lastResponse.promptText,
        responseText: lastResponse.responseText,
        rawResponse: lastResponse.rawResponse,
        inputValues: lastResponse.inputValues,
        promptTokens: lastResponse.promptTokens,
        responseTokens: lastResponse.responseTokens,
        totalTokens: lastResponse.totalTokens,
      });
      setResults((items) => [saved, ...items]);
      toast.success("Đã lưu kết quả AI.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không lưu được kết quả."));
    } finally {
      setSavingResult(false);
    }
  };

  const handleCopyResponse = async () => {
    if (!lastResponse?.responseText) return;
    await navigator.clipboard.writeText(lastResponse.responseText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
    toast.success("Đã copy kết quả AI.");
  };

  const handleDeleteResult = async (id: string) => {
    try {
      await adsStrategyService.deleteResult(id);
      setResults((items) => items.filter((item) => item.id !== id));
      setResultPage((page) => Math.min(page, Math.max(1, Math.ceil((results.length - 1) / RESULTS_PER_PAGE))));
      toast.success("Đã xóa kết quả đã lưu.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không xóa được kết quả."));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Đang tải bộ skill chiến lược...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#059669]/10 text-[#059669]">
              <Sparkles size={19} />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Bộ Skill chiến lược chạy</h2>
              <p className="text-sm text-muted-foreground">
                Nhập Gemini API key theo user, tùy chỉnh prompt riêng, gọi AI tạo chiến lược và lưu kết quả khi cần.
              </p>
            </div>
          </div>
          <Button onClick={handleGenerate} disabled={generating} className="gap-2 bg-[#059669] text-white hover:bg-[#047857]">
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles size={16} />}
            {generating ? "Đang gọi Gemini..." : "Chạy AI gợi ý"}
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {INNER_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeInnerTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveInnerTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${isActive
                  ? "bg-[#059669] text-white shadow-sm shadow-[#059669]/30"
                  : "text-muted-foreground hover:bg-background hover:text-foreground"
                }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeInnerTab === "run" && (
        <main className="space-y-5">
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-4 font-semibold">Đầu vào phân tích</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="block md:col-span-2">
                <CustomSelect
                  label="Gemini API key"
                  value={selectedKeyId}
                  onChange={setSelectedKeyId}
                  placeholder="Chọn API key"
                  options={apiKeys.map((key) => ({
                    value: key.id,
                    label: `${key.displayName} · ****${key.apiKeyLast4}`
                  }))}
                />
                {apiKeys.length === 0 && (
                  <button onClick={() => setActiveInnerTab("keys")} className="mt-2 text-xs font-medium text-[#059669] hover:underline">
                    Chưa có key, bấm để thêm Gemini API key
                  </button>
                )}
              </div>
              {selectedKeyId && (
                <div className="block md:col-span-2">
                  <div className="relative">
                    <CustomSelect
                      label="Model sử dụng"
                      value={runModelName}
                      onChange={setRunModelName}
                      placeholder="Chọn model..."
                      options={runAvailableModels.map((model) => ({
                        value: model,
                        label: model
                      }))}
                    />
                    {isFetchingRunModels && (
                      <div className="absolute right-3 top-9">
                        <Loader2 className="size-4 animate-spin text-[#059669]" />
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="block md:col-span-2">
                <CustomSelect
                  label="Prompt sử dụng"
                  value={selectedPromptId}
                  onChange={handleSelectPrompt}
                  options={prompts.map((prompt) => ({
                    value: prompt.id,
                    label: `${prompt.name}${prompt.isDefault ? " (mặc định)" : ""}`
                  }))}
                />
              </div>
              <div className="block md:col-span-2 rounded-lg border border-dashed border-[#059669]/30 bg-[#059669]/5 p-4">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2">
                    <Database size={17} className="mt-0.5 text-[#059669]" />
                    <div>
                      <p className="text-sm font-semibold">Dữ liệu dự án tự động</p>
                      <p className="text-xs text-muted-foreground">
                        Chọn dự án để hệ thống gom traffic, quốc gia, restriction, keyword volume và đối thủ vào prompt.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void loadProjectContext(selectedProject)}
                    disabled={!selectedProject || projectContextLoading}
                    className="gap-1.5"
                  >
                    {projectContextLoading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw size={13} />}
                    Refresh
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                  <CustomSelect
                    label="Dự án affiliate"
                    value={selectedProjectId}
                    onChange={handleSelectProject}
                    placeholder="Chọn dự án đã lưu..."
                    options={affiliateLinks.map((project) => ({
                      value: project.id,
                      label: `${project.name || project.domain} · ${project.domain}`,
                    }))}
                    showSearch={true}
                    searchPlaceholder="Tìm dự án..."
                  />
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!strategyContext.suggestedMarket}
                      onClick={() => setMarket(strategyContext.suggestedMarket)}
                      className="w-full whitespace-nowrap"
                    >
                      Dùng market gợi ý
                    </Button>
                  </div>
                </div>
                {affiliateLinks.length === 0 && (
                  <p className="mt-3 rounded-md bg-background/70 p-3 text-xs text-muted-foreground">
                    Chưa có dự án trong tab Dự án. Bạn vẫn có thể nhập URL thủ công, nhưng AI sẽ thiếu context đã quét.
                  </p>
                )}
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {strategyContext.checklist.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        if (!item.ready && item.targetTab) openChecklistTarget(item);
                      }}
                      disabled={item.ready || !item.targetTab}
                      title={!item.ready && item.action ? item.action : undefined}
                      className={`rounded-md border px-3 py-2 text-left transition ${
                        item.ready
                          ? "border-[#059669]/30 bg-background"
                          : item.targetTab
                            ? "cursor-pointer border-amber-300/60 bg-amber-50 text-amber-950 hover:border-[#059669]/60 hover:bg-[#059669]/5 dark:bg-amber-950/20 dark:text-amber-100"
                            : "cursor-default border-amber-300/60 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {item.ready ? (
                          <Check size={13} className="text-[#059669]" />
                        ) : (
                          <AlertTriangle size={13} className="text-amber-600" />
                        )}
                        <span className="text-xs font-semibold">{item.label}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{item.detail}</p>
                      {!item.ready && item.action && (
                        <p className="mt-1 text-[11px] font-medium text-[#059669]">
                          {item.targetTab ? `${item.action} · Bấm để mở` : item.action}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
                <details className="mt-3 rounded-md border border-border bg-background/80">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-muted-foreground">
                    Xem context sẽ gửi cho AI
                  </summary>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap border-t border-border p-3 text-xs leading-5 text-muted-foreground">
                    {strategyContext.text}
                  </pre>
                </details>
              </div>
              <label className="block md:col-span-2">
                <span className="text-sm font-medium">Website hoặc Landing Page</span>
                <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#059669]" />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Tên brand/offer</span>
                <input value={brandOrOffer} onChange={(e) => setBrandOrOffer(e.target.value)} placeholder="VD: Brand, offer, app..." className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#059669]" />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Ngành hàng</span>
                <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="VD: SaaS, finance, health..." className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#059669]" />
              </label>
              <CustomSelect
                label="Thị trường ưu tiên"
                value={market}
                onChange={setMarket}
                placeholder="Chọn quốc gia..."
                showSearch={true}
                searchPlaceholder="Tìm kiếm quốc gia..."
                clearable={true}
                clearText="Xóa lựa chọn (Bỏ chọn)"
                options={marketOptions}
              />
              <label className="block">
                <span className="text-sm font-medium">Ngân sách dự kiến</span>
                <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="VD: 500 USD/tháng" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#059669]" />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Payout/commission</span>
                <input value={payout} onChange={(e) => setPayout(e.target.value)} placeholder="VD: $60 CPA, 30% revshare..." className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#059669]" />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Quốc gia cấm/hạn chế đã biết</span>
                <input value={restrictedCountries} onChange={(e) => setRestrictedCountries(e.target.value)} placeholder="VD: US banned, UK restricted..." className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#059669]" />
              </label>
              <div>
                <CustomSelect
                  label="Ngôn ngữ kết quả"
                  value={responseLanguage}
                  onChange={handleResponseLanguageChange}
                  options={[
                    { value: "Tiếng Việt", label: "Tiếng Việt" },
                    { value: "English", label: "English" }
                  ]}
                />
              </div>
              <label className="block md:col-span-2">
                <span className="text-sm font-medium">Ghi chú bổ sung</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Mục tiêu CPA, sản phẩm chủ lực, offer hiện có..." className="mt-1 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#059669]" />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-semibold text-base">Prompt chiến dịch</h3>
                <div className="flex rounded-lg border border-border bg-muted/60 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPromptMode("template")}
                    className={`rounded-md px-3 py-1 font-medium transition cursor-pointer ${promptMode === "template"
                        ? "bg-[#059669] text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    Mẫu (Template)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptMode("compiled")}
                    className={`rounded-md px-3 py-1 font-medium transition cursor-pointer ${promptMode === "compiled"
                        ? "bg-[#059669] text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    Xem trước (Compiled)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptMode("manual")}
                    className={`rounded-md px-3 py-1 font-medium transition cursor-pointer ${promptMode === "manual"
                        ? "bg-[#059669] text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    Nhập kết quả
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {promptMode === "compiled" && (
                  <div className="flex items-center gap-1.5 border-r border-border pr-3">
                    <span className="text-xs font-medium text-muted-foreground">Mở nhanh:</span>
                    <a
                      href="https://chatgpt.com"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded bg-[#10a37f]/10 px-2 py-1 text-xs font-semibold text-[#10a37f] hover:bg-[#10a37f]/20 transition"
                    >
                      ChatGPT
                    </a>
                    <a
                      href="https://gemini.google.com"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded bg-[#1a73e8]/10 px-2 py-1 text-xs font-semibold text-[#1a73e8] hover:bg-[#1a73e8]/20 transition"
                    >
                      Gemini
                    </a>
                    <a
                      href="https://grok.com"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded bg-black/10 dark:bg-white/10 px-2 py-1 text-xs font-semibold text-foreground hover:bg-black/20 dark:hover:bg-white/20 transition"
                    >
                      Grok
                    </a>
                  </div>
                )}

                {promptMode !== "manual" && (
                  <Button
                    onClick={handleCopyPrompt}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 text-xs font-medium"
                  >
                    {promptCopied ? <Check size={13} /> : <Clipboard size={13} />}
                    {promptCopied ? "Đã copy" : "Copy prompt"}
                  </Button>
                )}
              </div>
            </div>

            {promptMode === "template" && (
              <div>
                <textarea
                  value={promptTemplate}
                  onChange={(e) => setPromptTemplate(e.target.value)}
                  rows={14}
                  className="w-full resize-y rounded-lg border border-input bg-background p-3 text-sm leading-6 outline-none focus:border-[#059669]"
                  placeholder="Nhập cấu trúc prompt..."
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Dùng các biến: {"{{website_url}}"}, {"{{project_context}}"}, {"{{brand_or_offer}}"}, {"{{industry}}"}, {"{{market}}"}, {"{{restricted_countries}}"}, {"{{budget}}"}, {"{{payout}}"}, {"{{response_language}}"}, {"{{notes}}"} để tự động điền giá trị.
                </span>
              </div>
            )}
            {promptMode === "compiled" && (
              <div>
                <textarea
                  value={compiledPrompt}
                  readOnly
                  rows={14}
                  className="w-full resize-y rounded-lg border border-input bg-muted/30 p-3 text-sm leading-6 outline-none"
                  placeholder="Prompt sau khi điền các trường thông tin..."
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Đây là prompt đã điền đầy đủ các thông tin bạn nhập ở trên. Bạn có thể copy để gửi sang các AI khác (ChatGPT, Gemini, Grok).
                </span>
              </div>
            )}
            {promptMode === "manual" && (
              <div className="space-y-3">
                <textarea
                  value={manualResultText}
                  onChange={(e) => setManualResultText(e.target.value)}
                  rows={14}
                  className="w-full resize-y rounded-lg border border-input bg-background p-3 text-sm leading-6 outline-none focus:border-[#059669]"
                  placeholder="Dán (Paste) kết quả phân tích quảng cáo từ các AI khác (như ChatGPT, Grok, Claude,...) vào đây để lưu trữ..."
                />
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    Nhập nội dung phân tích nhận được từ chatbot khác rồi bấm Lưu kết quả để lưu trữ vào hệ thống.
                  </span>
                  <Button
                    onClick={handleSaveManualResult}
                    disabled={savingResult}
                    className="gap-2 bg-[#059669] text-white hover:bg-[#047857]"
                  >
                    {savingResult ? <Loader2 className="size-4 animate-spin" /> : <Save size={15} />}
                    Lưu kết quả ngoài
                  </Button>
                </div>
              </div>
            )}
          </section>

          {lastResponse && (
            <section className="rounded-xl border border-[#059669]/30 bg-card p-5 shadow-sm">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold">Kết quả Gemini trả về</h3>
                  <p className="text-xs text-muted-foreground">
                    Model {lastResponse.modelName}
                    {lastResponse.totalTokens ? ` · ${lastResponse.totalTokens} tokens` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCopyResponse} variant="outline" className="gap-2">
                    {copied ? <Check size={15} /> : <Clipboard size={15} />}
                    {copied ? "Đã copy" : "Copy"}
                  </Button>
                  <Button onClick={handleSaveResult} disabled={savingResult} className="gap-2 bg-[#059669] text-white hover:bg-[#047857]">
                    {savingResult ? <Loader2 className="size-4 animate-spin" /> : <Save size={15} />}
                    Lưu kết quả này?
                  </Button>
                </div>
              </div>
              <div className="max-h-[720px] overflow-auto rounded-lg border border-border bg-background p-5">
                <StrategyResultView text={lastResponse.responseText} />
              </div>
            </section>
          )}

        </main>
      )}

      {activeInnerTab === "keys" && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound size={18} className="text-[#059669]" />
            <h3 className="font-semibold">Quản lý Gemini API keys</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_1.3fr_auto]">
            <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Tên key, VD: Key chính" className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#059669]" />
            <div className="relative flex items-center">
              <input
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
                placeholder="AIza..."
                type="password"
                className="w-full rounded-lg border border-input bg-background pl-3 pr-20 py-2 text-sm outline-none focus:border-[#059669]"
              />
              {newKeyValue.trim().length >= 10 && (
                <button
                  type="button"
                  onClick={() => handleFetchModels(newKeyValue)}
                  disabled={isFetchingModels}
                  className="absolute right-2 px-1.5 py-1 rounded text-xs font-semibold text-[#059669] hover:bg-[#059669]/10 disabled:opacity-50 transition cursor-pointer"
                  title="Tự động lấy danh sách model hỗ trợ từ API key"
                >
                  {isFetchingModels ? (
                    <Loader2 className="size-3.5 animate-spin text-[#059669]" />
                  ) : (
                    "Lấy model"
                  )}
                </button>
              )}
            </div>
            <Button onClick={handleCreateKey} className="gap-2 bg-[#059669] text-white hover:bg-[#047857]">
              <Plus size={15} /> Thêm key
            </Button>
          </div>

          {fetchedModels.length > 0 && (
            <div className="mt-3 rounded-lg border border-dashed border-[#059669]/30 bg-[#059669]/5 p-3.5">
              <span className="text-xs font-semibold text-[#059669] block mb-2">Các model khả dụng cho API key này:</span>
              <div className="flex flex-wrap gap-1.5">
                {fetchedModels.map((model) => (
                  <span key={model} className="inline-flex items-center rounded bg-[#059669]/10 px-2 py-0.5 text-xs font-medium text-[#065f46]">
                    {model}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 space-y-3">
            {apiKeys.length === 0 ? (
              <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                Chưa có key. Key được lưu theo user và không trả lại nguyên văn ra frontend.
              </p>
            ) : (
              apiKeys.map((key) => (
                <div key={key.id} className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex min-w-0 items-start gap-3">
                    <input type="radio" checked={selectedKeyId === key.id} onChange={() => setSelectedKeyId(key.id)} className="mt-1" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{key.displayName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {key.modelName} · ****{key.apiKeyLast4} · Dùng gần nhất: {formatDate(key.lastUsedAt)}
                      </span>
                      {key.lastError && <span className="mt-1 block text-xs text-red-600">{key.lastError}</span>}
                    </span>
                  </label>
                  <Button onClick={() => handleDeleteKey(key.id)} variant="outline" className="gap-2 text-red-600 hover:text-red-700">
                    <Trash2 size={15} /> Xóa
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {activeInnerTab === "prompts" && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-[#059669]" />
              <h3 className="font-semibold">Xem, sửa prompt của người dùng</h3>
            </div>
            <Button onClick={handleCreatePromptCopy} variant="outline" className="gap-2">
              <Plus size={15} /> Tạo bản mới
            </Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-2">
              {prompts.map((prompt) => (
                <button
                  key={prompt.id}
                  onClick={() => handleSelectPrompt(prompt.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${selectedPromptId === prompt.id
                      ? "border-[#059669] bg-[#059669]/10"
                      : "border-border bg-background hover:border-[#059669]/50"
                    }`}
                >
                  <span className="block text-sm font-semibold">{prompt.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {prompt.isDefault ? "Prompt mặc định" : "Prompt riêng"} · {formatDate(prompt.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
            <div className="space-y-3">
              <input value={promptName} onChange={(e) => setPromptName(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#059669]" />
              <textarea value={promptTemplate} onChange={(e) => setPromptTemplate(e.target.value)} rows={20} className="w-full resize-y rounded-lg border border-input bg-background p-3 text-sm leading-6 outline-none focus:border-[#059669]" />
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleSavePrompt} className="gap-2 bg-[#059669] text-white hover:bg-[#047857]">
                  <Save size={15} /> Lưu prompt
                </Button>
                <Button onClick={handleDeletePrompt} disabled={!selectedPromptId} variant="outline" className="gap-2 text-red-600 hover:text-red-700">
                  <Trash2 size={15} /> Xóa prompt
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeInnerTab === "results" && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold">Kết quả đã lưu</h3>
            <p className="text-sm text-muted-foreground">
              {results.length} kết quả · Trang {resultPage}/{totalResultPages}
            </p>
          </div>
          {results.length === 0 ? (
            <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              Chưa có kết quả nào được lưu.
            </p>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedResults.map((result) => (
                  <details key={result.id} className="rounded-lg border border-border bg-background p-4">
                    <summary className="flex cursor-pointer items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{result.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {result.modelName} · {formatDate(result.createdAt)}
                        </span>
                      </span>
                      <button onClick={(e) => { e.preventDefault(); void handleDeleteResult(result.id); }} className="text-muted-foreground hover:text-red-500" title="Xóa kết quả">
                        <Trash2 size={15} />
                      </button>
                    </summary>
                    <div className="mt-3 max-h-[560px] overflow-auto rounded-lg border border-border bg-card p-4">
                      <StrategyResultView text={result.responseText} />
                    </div>
                  </details>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <Button variant="outline" disabled={resultPage <= 1} onClick={() => setResultPage((page) => Math.max(1, page - 1))}>
                  Trước
                </Button>
                <Button variant="outline" disabled={resultPage >= totalResultPages} onClick={() => setResultPage((page) => Math.min(totalResultPages, page + 1))}>
                  Sau
                </Button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
