"use client";

import { type ReactNode, useEffect, useMemo, useState, useRef } from "react";
import {
  Check,
  Clipboard,
  FileText,
  KeyRound,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adsStrategyService } from "@/services/adsStrategy.service";
import type {
  AdsStrategyApiKey,
  AdsStrategyGenerateResponse,
  AdsStrategyPrompt,
  AdsStrategyResult,
  Country,
} from "@/types/adsStrategy.types";

const DEFAULT_FIELDS = [
  { key: "website_url", label: "Website hoặc Landing Page", type: "url", required: true },
  { key: "market", label: "Thị trường ưu tiên", type: "text", required: false },
  { key: "budget", label: "Ngân sách dự kiến", type: "text", required: false },
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

const DEFAULT_PROMPT = `Hãy đóng vai Chuyên gia Phân tích Thị trường & Lập kế hoạch chiến dịch Google Ads Search.

Website/Landing page: {{website_url}}
Thị trường ưu tiên: {{market}}
Ngân sách dự kiến: {{budget}}
Ngôn ngữ kết quả mong muốn: {{response_language}}
Ghi chú bổ sung: {{notes}}

Nhiệm vụ:
1. Đọc và phân tích website để xác định sản phẩm/dịch vụ, ngành hàng, ưu thế cốt lõi và khuyến mãi hiện có nếu có.
2. Kiểm tra cảnh báo chính sách Google Ads liên quan trực tiếp đến ngành hàng.
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
- Tạo bảng keyword bằng tiếng Anh. Ưu tiên mạnh Exact Match để kiểm soát ngân sách.
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
  const [newKeyModel, setNewKeyModel] = useState("gemini-2.5-flash");

  const [websiteUrl, setWebsiteUrl] = useState("");
  const [market, setMarket] = useState("Vietnam");
  const [budget, setBudget] = useState("");
  const [responseLanguage, setResponseLanguage] = useState("Tiếng Việt");
  const [notes, setNotes] = useState("");

  const [countries, setCountries] = useState<Country[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredCountries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return countries;
    return countries.filter(
      (c) =>
        c.nameVi.toLowerCase().includes(query) ||
        c.nameEn.toLowerCase().includes(query) ||
        c.code.toLowerCase().includes(query)
    );
  }, [countries, searchQuery]);

  const [promptName, setPromptName] = useState("Prompt chiến lược ads");
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_PROMPT);
  const [lastResponse, setLastResponse] = useState<AdsStrategyGenerateResponse | null>(null);

  const [promptMode, setPromptMode] = useState<"template" | "compiled">("compiled");
  const [promptCopied, setPromptCopied] = useState(false);

  const compiledPrompt = useMemo(() => {
    let result = promptTemplate;
    const values = {
      website_url: websiteUrl.trim(),
      market: market.trim(),
      budget: budget.trim(),
      response_language: responseLanguage,
      notes: notes.trim(),
    };
    for (const [key, val] of Object.entries(values)) {
      result = result.replaceAll(`{{${key}}}`, val || `[chưa nhập ${key}]`);
    }
    return result;
  }, [promptTemplate, websiteUrl, market, budget, responseLanguage, notes]);

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
  const selectedKey = useMemo(
    () => apiKeys.find((key) => key.id === selectedKeyId) ?? null,
    [apiKeys, selectedKeyId]
  );

  const inputValues = useMemo(
    () => ({
      website_url: websiteUrl.trim(),
      market: market.trim(),
      budget: budget.trim(),
      response_language: responseLanguage,
      notes: notes.trim(),
    }),
    [budget, market, notes, responseLanguage, websiteUrl]
  );

  const totalResultPages = Math.max(1, Math.ceil(results.length / RESULTS_PER_PAGE));
  const paginatedResults = results.slice(
    (resultPage - 1) * RESULTS_PER_PAGE,
    resultPage * RESULTS_PER_PAGE
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [keysRes, promptsRes, resultsRes, countriesRes] = await Promise.all([
        adsStrategyService.listApiKeys(),
        adsStrategyService.listPrompts(),
        adsStrategyService.listResults(),
        adsStrategyService.getCountries(),
      ]);
      setApiKeys(keysRes.items);
      setPrompts(promptsRes.items);
      setResults(resultsRes.items);
      setCountries(countriesRes);
      setSelectedKeyId((current) => current || keysRes.items[0]?.id || "");
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  const handleSelectPrompt = (promptId: string) => {
    setSelectedPromptId(promptId);
    const prompt = prompts.find((item) => item.id === promptId);
    if (prompt) {
      setPromptName(prompt.name);
      setPromptTemplate(prompt.promptTemplate);
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
        modelName: newKeyModel.trim() || "gemini-2.5-flash",
      });
      setApiKeys((items) => [created, ...items]);
      setSelectedKeyId(created.id);
      setNewKeyName("");
      setNewKeyValue("");
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
        promptTemplate: applyLanguageInstruction(promptTemplate, responseLanguage),
        inputValues,
        modelName: selectedKey?.modelName,
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

  const handleSaveResult = async () => {
    if (!lastResponse) return;
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
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                isActive
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
              <label className="block md:col-span-2">
                <span className="text-sm font-medium">Gemini API key</span>
                <select value={selectedKeyId} onChange={(e) => setSelectedKeyId(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#059669]">
                  <option value="">Chọn API key</option>
                  {apiKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.displayName} · {key.modelName} · ****{key.apiKeyLast4}
                    </option>
                  ))}
                </select>
                {apiKeys.length === 0 && (
                  <button onClick={() => setActiveInnerTab("keys")} className="mt-2 text-xs font-medium text-[#059669] hover:underline">
                    Chưa có key, bấm để thêm Gemini API key
                  </button>
                )}
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-medium">Prompt sử dụng</span>
                <select value={selectedPromptId} onChange={(e) => handleSelectPrompt(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#059669]">
                  {prompts.map((prompt) => (
                    <option key={prompt.id} value={prompt.id}>
                      {prompt.name}{prompt.isDefault ? " (mặc định)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-medium">Website hoặc Landing Page</span>
                <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#059669]" />
              </label>
              <div className="relative flex flex-col" ref={dropdownRef}>
                <span className="text-sm font-medium">Thị trường ưu tiên</span>
                <div
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="mt-1 flex w-full cursor-pointer items-center justify-between rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none hover:border-[#059669]/50 focus-within:border-[#059669]"
                >
                  <span className={market ? "text-foreground" : "text-muted-foreground"}>
                    {(() => {
                      if (market === "All") {
                        return "Tất cả quốc gia (All)";
                      }
                      const matched = countries.find(
                        (c) => c.nameEn === market || c.nameVi === market || c.code === market
                      );
                      if (matched) {
                        return `${matched.nameVi} (${matched.nameEn})`;
                      }
                      return market || "Chọn quốc gia...";
                    })()}
                  </span>
                  <span className="text-xs text-muted-foreground">▼</span>
                </div>
                {dropdownOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1.5 flex w-full flex-col rounded-lg border border-border bg-card p-2 shadow-lg max-h-[300px]">
                    <input
                      type="text"
                      placeholder="Tìm kiếm quốc gia..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="mb-2 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-[#059669]"
                      autoFocus
                    />
                    <div className="overflow-y-auto flex-1 space-y-0.5 max-h-[200px]">
                      {market && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMarket("");
                            setDropdownOpen(false);
                            setSearchQuery("");
                          }}
                          className="flex w-full items-center px-3 py-2 text-left text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md"
                        >
                          Xóa lựa chọn (Bỏ chọn)
                        </button>
                      )}
                      {(() => {
                        const query = searchQuery.trim().toLowerCase();
                        const showAllOption = !query || "tất cả".includes(query) || "all".includes(query);
                        return showAllOption && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMarket("All");
                              setDropdownOpen(false);
                              setSearchQuery("");
                            }}
                            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted ${
                              market === "All" ? "bg-[#059669]/10 font-medium text-[#059669]" : "text-foreground"
                            }`}
                          >
                            <span>Tất cả quốc gia (All)</span>
                            {market === "All" && <Check size={14} className="text-[#059669]" />}
                          </button>
                        );
                      })()}
                      {filteredCountries.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          Không tìm thấy quốc gia
                        </div>
                      ) : (
                        filteredCountries.map((c) => {
                          const isSelected = market === c.nameEn || market === c.nameVi || market === c.code;
                          return (
                            <button
                              key={c.code}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMarket(c.nameEn);
                                setDropdownOpen(false);
                                setSearchQuery("");
                              }}
                              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted ${
                                isSelected ? "bg-[#059669]/10 font-medium text-[#059669]" : "text-foreground"
                              }`}
                            >
                              <span>{c.nameVi} ({c.nameEn})</span>
                              {isSelected && <Check size={14} className="text-[#059669]" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
              <label className="block">
                <span className="text-sm font-medium">Ngân sách dự kiến</span>
                <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="VD: 500 USD/tháng" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#059669]" />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Ngôn ngữ kết quả</span>
                <select value={responseLanguage} onChange={(e) => handleResponseLanguageChange(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#059669]">
                  <option value="Tiếng Việt">Tiếng Việt</option>
                  <option value="English">English</option>
                </select>
              </label>
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
                    className={`rounded-md px-3 py-1 font-medium transition cursor-pointer ${
                      promptMode === "template"
                        ? "bg-[#059669] text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Mẫu (Template)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptMode("compiled")}
                    className={`rounded-md px-3 py-1 font-medium transition cursor-pointer ${
                      promptMode === "compiled"
                        ? "bg-[#059669] text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Xem trước (Compiled)
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
                
                <Button
                  onClick={handleCopyPrompt}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 text-xs font-medium"
                >
                  {promptCopied ? <Check size={13} /> : <Clipboard size={13} />}
                  {promptCopied ? "Đã copy" : "Copy prompt"}
                </Button>
              </div>
            </div>
            
            {promptMode === "template" ? (
              <div>
                <textarea
                  value={promptTemplate}
                  onChange={(e) => setPromptTemplate(e.target.value)}
                  rows={14}
                  className="w-full resize-y rounded-lg border border-input bg-background p-3 text-sm leading-6 outline-none focus:border-[#059669]"
                  placeholder="Nhập cấu trúc prompt..."
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Dùng các biến: {"{{website_url}}"}, {"{{market}}"}, {"{{budget}}"}, {"{{response_language}}"}, {"{{notes}}"} để tự động điền giá trị.
                </span>
              </div>
            ) : (
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
          <div className="grid gap-3 md:grid-cols-[1fr_1.3fr_1fr_auto]">
            <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Tên key, VD: Key chính" className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#059669]" />
            <input value={newKeyValue} onChange={(e) => setNewKeyValue(e.target.value)} placeholder="AIza..." type="password" className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#059669]" />
            <input value={newKeyModel} onChange={(e) => setNewKeyModel(e.target.value)} placeholder="gemini-2.5-flash" className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[#059669]" />
            <Button onClick={handleCreateKey} className="gap-2 bg-[#059669] text-white hover:bg-[#047857]">
              <Plus size={15} /> Thêm key
            </Button>
          </div>

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
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selectedPromptId === prompt.id
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
