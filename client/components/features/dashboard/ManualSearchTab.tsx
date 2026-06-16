"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  SearchCheck,
  ListTree,
  Layers3,
  Globe,
  MapPin,
  BadgeCheck,
  CircleHelp,
  ContactRound,
  Check,
  ChevronsUpDown,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { affiliateProjectService } from "@/services/affiliateProject.service";
import { manualSearchService } from "@/services/manualSearch.service";
import type { AffiliateLinkModel } from "@/types/affiliateProject.types";
import type {
  AdvertiserCandidate,
  CompetitorAdItem,
  ManualCompetitorSearchHistoryItem,
  ManualCompetitorSearchRequest,
  ManualKeywordGroup,
} from "@/types/manualSearch.types";

type CodeOption = {
  value: string;
  label: string;
};

const LOCATION_OPTIONS = [
  { value: "Vietnam", gl: "vn", label: "Việt Nam" },
  { value: "United States", gl: "us", label: "Hoa Kỳ" },
  { value: "United Kingdom", gl: "uk", label: "Vương quốc Anh" },
  { value: "Australia", gl: "au", label: "Australia" },
  { value: "Canada", gl: "ca", label: "Canada" },
  { value: "Singapore", gl: "sg", label: "Singapore" },
  { value: "Thailand", gl: "th", label: "Thái Lan" },
  { value: "Malaysia", gl: "my", label: "Malaysia" },
  { value: "Indonesia", gl: "id", label: "Indonesia" },
  { value: "Philippines", gl: "ph", label: "Philippines" },
  { value: "India", gl: "in", label: "Ấn Độ" },
  { value: "Japan", gl: "jp", label: "Nhật Bản" },
  { value: "South Korea", gl: "kr", label: "Hàn Quốc" },
  { value: "China", gl: "cn", label: "Trung Quốc" },
  { value: "Taiwan", gl: "tw", label: "Đài Loan" },
  { value: "Hong Kong", gl: "hk", label: "Hong Kong" },
  { value: "Germany", gl: "de", label: "Đức" },
  { value: "France", gl: "fr", label: "Pháp" },
  { value: "Spain", gl: "es", label: "Tây Ban Nha" },
  { value: "Italy", gl: "it", label: "Ý" },
  { value: "Netherlands", gl: "nl", label: "Hà Lan" },
  { value: "Belgium", gl: "be", label: "Bỉ" },
  { value: "Switzerland", gl: "ch", label: "Thụy Sĩ" },
  { value: "Sweden", gl: "se", label: "Thụy Điển" },
  { value: "Norway", gl: "no", label: "Na Uy" },
  { value: "Denmark", gl: "dk", label: "Đan Mạch" },
  { value: "Finland", gl: "fi", label: "Phần Lan" },
  { value: "Poland", gl: "pl", label: "Ba Lan" },
  { value: "Brazil", gl: "br", label: "Brazil" },
  { value: "Mexico", gl: "mx", label: "Mexico" },
  { value: "United Arab Emirates", gl: "ae", label: "UAE" },
  { value: "Saudi Arabia", gl: "sa", label: "Saudi Arabia" },
  { value: "Turkey", gl: "tr", label: "Thổ Nhĩ Kỳ" },
  { value: "South Africa", gl: "za", label: "Nam Phi" },
  { value: "New Zealand", gl: "nz", label: "New Zealand" },
];

const HL_OPTIONS = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "Tiếng Anh" },
  { value: "ja", label: "Tiếng Nhật" },
  { value: "ko", label: "Tiếng Hàn" },
  { value: "fr", label: "Tiếng Pháp" },
  { value: "de", label: "Tiếng Đức" },
  { value: "es", label: "Tiếng Tây Ban Nha" },
  { value: "th", label: "Tiếng Thái" },
  { value: "id", label: "Tiếng Indonesia" },
  { value: "ms", label: "Tiếng Malaysia" },
  { value: "tl", label: "Tiếng Filipino" },
  { value: "zh-CN", label: "Tiếng Trung giản thể" },
  { value: "zh-TW", label: "Tiếng Trung phồn thể" },
  { value: "pt", label: "Tiếng Bồ Đào Nha" },
  { value: "it", label: "Tiếng Ý" },
  { value: "nl", label: "Tiếng Hà Lan" },
  { value: "pl", label: "Tiếng Ba Lan" },
  { value: "ru", label: "Tiếng Nga" },
  { value: "tr", label: "Tiếng Thổ Nhĩ Kỳ" },
  { value: "ar", label: "Tiếng Ả Rập" },
  { value: "hi", label: "Tiếng Hindi" },
  { value: "bn", label: "Tiếng Bengal" },
  { value: "sv", label: "Tiếng Thụy Điển" },
  { value: "da", label: "Tiếng Đan Mạch" },
  { value: "no", label: "Tiếng Na Uy" },
  { value: "fi", label: "Tiếng Phần Lan" },
  { value: "cs", label: "Tiếng Séc" },
  { value: "uk", label: "Tiếng Ukraina" },
] satisfies CodeOption[];

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEpoch(value?: number): string {
  if (!value) return "—";
  const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
  return new Date(milliseconds).toLocaleDateString("vi-VN");
}

function AdvertiserInfoCard({
  candidate,
  advertiserLabel,
  defaultOpen,
}: {
  candidate: AdvertiserCandidate;
  advertiserLabel: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const otherAdsLink = candidate.advertiserAdsLink || candidate.detailsLink;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <ContactRound size={17} className="shrink-0 text-foreground/80" />
        <span className="min-w-0 flex-1 text-sm font-semibold">
          Giới thiệu về nhà quảng cáo này
        </span>
        <ChevronUp
          size={16}
          className={cn(
            "shrink-0 text-muted-foreground transition-transform",
            !open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <div className="flex items-start gap-2.5 text-xs text-foreground/90">
            <BadgeCheck size={16} className="mt-0.5 shrink-0 text-[#059669]" />
            <span className="flex-1">
              Thông tin nhà quảng cáo được tra cứu từ Google Ads Transparency
            </span>
            <span
              title="Google Ads Transparency là nguồn công khai của Google. Kết quả được khớp theo domain quảng cáo."
              className="cursor-help text-muted-foreground"
            >
              <CircleHelp size={15} />
            </span>
          </div>

          <dl className="mt-4 space-y-3 pl-6">
            <div>
              <dt className="text-[11px] text-muted-foreground">Nhà quảng cáo</dt>
              <dd className="mt-0.5 break-words text-sm font-medium">
                {advertiserLabel || candidate.targetDomain || "Chưa xác định"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">
                Bên trả tiền quảng cáo
              </dt>
              <dd className="mt-0.5 break-words text-sm font-medium">
                {candidate.paidForBy || "Chưa được Google công bố"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Vị trí hiển thị</dt>
              <dd className="mt-0.5 text-sm font-medium">
                {candidate.displayRegion || "Chưa xác định"}
              </dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-border pt-3">
            {otherAdsLink && (
              <a
                href={otherAdsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#0655d6] hover:underline"
              >
                Xem các quảng cáo khác mà nhà quảng cáo này dùng Google để phân phát
                <ExternalLink size={12} />
              </a>
            )}
            <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">
              Advertiser ID: {candidate.advertiserId}
              {candidate.creativeId ? ` · Creative ID: ${candidate.creativeId}` : ""}
            </p>
            {(candidate.firstShown || candidate.lastShown) && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Đã hiển thị: {formatEpoch(candidate.firstShown)} →{" "}
                {formatEpoch(candidate.lastShown)}
                {candidate.totalDaysShown ? ` · ${candidate.totalDaysShown} ngày` : ""}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AdItemCard({ ad }: { ad: CompetitorAdItem }) {
  const [showDetails, setShowDetails] = useState(
    (ad.advertiserCandidates?.length ?? 0) > 0
  );
  const advertiserCandidates = ad.advertiserCandidates ?? [];
  const refEntries = Object.entries(ad.refParameters ?? {});
  const sitelinkItems = ad.sitelinkItems ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold leading-tight">{ad.title || "Không có tiêu đề"}</p>
          <p className="mt-1 text-xs text-muted-foreground break-all">{ad.advertiser}</p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            ad.type === "top_ad"
              ? "bg-[#059669]/10 text-[#059669]"
              : "bg-amber-500/10 text-amber-700"
          )}
        >
          {ad.position}
        </span>
      </div>

      {ad.snippet && <p className="mt-2 text-xs text-muted-foreground">{ad.snippet}</p>}

      {ad.sitelinks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ad.sitelinks.map((sitelink) => (
            <span
              key={`${ad.link}-${sitelink}`}
              className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {sitelink}
            </span>
          ))}
        </div>
      )}

      {ad.link && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a
            href={ad.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#059669] hover:underline"
          >
            Mở quảng cáo
            <ExternalLink size={12} />
          </a>
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/70 hover:text-foreground"
          >
            <Link2 size={12} />
            {showDetails ? "Ẩn thông tin nhà quảng cáo" : "Thông tin nhà quảng cáo"}
          </button>
        </div>
      )}

      {showDetails && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-medium text-foreground">Link đích</p>
              <p className="mt-1 break-all text-muted-foreground">{ad.link || "—"}</p>
              {(ad.destinationDomain || ad.destinationPath) && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Domain: {ad.destinationDomain || "—"} · Path: {ad.destinationPath || "/"}
                </p>
              )}
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-medium text-foreground">Google tracking / ref</p>
              <p className="mt-1 break-all text-muted-foreground">
                {ad.trackingLink || "SerpAPI không trả về tracking link"}
              </p>
            </div>
          </div>

          {refEntries.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium">Tham số affiliate / campaign</p>
              <div className="flex flex-wrap gap-1.5">
                {refEntries.map(([key, value]) => (
                  <span
                    key={key}
                    className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px]"
                  >
                    {key}={value}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Không phát hiện tham số ref/affiliate/campaign trong URL đích.
            </p>
          )}

          {sitelinkItems.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium">Sitelink chi tiết</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {sitelinkItems.map((item, index) => (
                  <a
                    key={`${item.link}-${index}`}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-border p-2.5 text-xs hover:bg-muted/50"
                  >
                    <span className="font-medium">{item.title || "Sitelink"}</span>
                    <span className="mt-1 block break-all text-[11px] text-muted-foreground">
                      {item.link || "Không có URL"}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div>
            {advertiserCandidates.length > 0 ? (
              <div className="space-y-2">
                {advertiserCandidates.map((candidate, index) => (
                  <AdvertiserInfoCard
                    key={`${candidate.advertiserId}-${candidate.creativeId}`}
                    candidate={candidate}
                    advertiserLabel={
                      ad.source || ad.displayedLink || ad.destinationDomain || ad.advertiser
                    }
                    defaultOpen={index === 0}
                  />
                ))}
                <p className="text-[11px] text-muted-foreground">
                  Kết quả được khớp theo domain. Một domain có thể được nhiều tài khoản quảng cáo sử
                  dụng, nên cần mở Transparency để xác nhận creative chính xác.
                </p>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                {ad.advertiserLookupStatus === "failed"
                  ? "Tra cứu Ads Transparency thất bại."
                  : ad.advertiserLookupStatus === "not_requested"
                    ? "Chưa bật tra cứu thông tin nhà quảng cáo cho lần search này."
                    : "Không tìm thấy nhà quảng cáo phù hợp trong Ads Transparency."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchHistoryRow({ item }: { item: ManualCompetitorSearchHistoryItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#059669]/10">
          <SearchCheck size={15} className="text-[#059669]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{item.keyword}</p>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 font-medium",
                item.projectId ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
              )}
            >
              {item.projectId ? `Dự án: ${item.projectName || "Project"}` : "Riêng lẻ"}
            </span>
            <span className="inline-flex items-center gap-1"><MapPin size={11} />{item.location}</span>
            <span className="inline-flex items-center gap-1"><Globe size={11} />{item.gl.toUpperCase()} / {item.hl}</span>
            <span>{formatDateTime(item.createdAt)}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold">{item.totalAdsFound} ads</p>
          <p className="text-[11px] text-muted-foreground">Top {item.topAdsCount} • Bottom {item.bottomAdsCount}</p>
        </div>
        {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>URL: {item.googleUrl || "—"}</span>
            <span>Num: {item.num}</span>
            <span>No cache: {item.noCache ? "true" : "false"}</span>
          </div>

          {item.ads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              Không có ads trong lần search này.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {item.ads.map((ad, index) => (
                <AdItemCard key={`${item.id}-${index}-${ad.link}`} ad={ad} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KeywordGroupCard({ group }: { group: ManualKeywordGroup }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#059669]/10 text-[#059669]">
          <Layers3 size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{group.keyword}</p>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>{group.searches.length} lần search</span>
            <span>{group.totalAdsFound} ads cộng dồn</span>
            <span>{formatDateTime(group.latestSearchedAt)}</span>
          </div>
        </div>
        {open ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-3">
          {group.searches.map((search) => (
            <SearchHistoryRow key={search.id} item={search} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[#059669]/10">
        <Search size={26} className="text-[#059669]/60" />
      </div>
      <p className="text-sm font-medium">Chưa có lịch sử search</p>
      <p className="mt-1 text-xs text-muted-foreground">Dùng form phía trên để trace đối thủ từ Google Search.</p>
    </div>
  );
}

function CodeSuggestionField({
  id,
  label,
  description,
  placeholder,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  description: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: CodeOption[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find(
    (option) => option.value.toLowerCase() === value.toLowerCase()
  );
  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  const filteredOptions = normalizedQuery
    ? options.filter(
        (option) =>
          option.value.toLocaleLowerCase("vi").includes(normalizedQuery) ||
          option.label.toLocaleLowerCase("vi").includes(normalizedQuery)
      )
    : options;

  function closeDropdown(commitQuery = false) {
    if (commitQuery && query.trim()) {
      onChange(query.trim());
    }
    setOpen(false);
    setQuery("");
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closeDropdown(true);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  });

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium text-foreground/90"
      >
        {label}
        <span className="ml-1 font-normal text-muted-foreground">({description})</span>
      </label>

      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          value={open ? query : value}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              closeDropdown();
            }
            if (event.key === "Tab") {
              closeDropdown(true);
            }
            if (event.key === "Enter" && open) {
              event.preventDefault();
              const option = filteredOptions[0];
              onChange(option?.value ?? query.trim());
              closeDropdown();
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-32 font-mono text-sm tracking-[0.06em] transition-colors hover:border-[#059669]/30 focus-visible:border-[#059669]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/20"
        />
        <div className="pointer-events-none absolute right-3 top-1/2 flex max-w-28 -translate-y-1/2 items-center gap-2">
          {!open && selectedOption && (
            <span className="truncate text-[11px] text-muted-foreground">
              {selectedOption.label}
            </span>
          )}
          <ChevronsUpDown size={14} className="shrink-0 text-muted-foreground" />
        </div>
      </div>

      {open && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-popover shadow-xl shadow-black/10"
        >
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
            <span className="text-[11px] font-medium text-muted-foreground">
              {normalizedQuery
                ? `${filteredOptions.length} kết quả`
                : `${options.length} lựa chọn`}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Gõ mã hoặc tên
            </span>
          </div>
          <div className="max-h-56 overflow-y-auto p-1.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const selected =
                  option.value.toLowerCase() === value.toLowerCase();

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(option.value);
                      closeDropdown();
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                      selected
                        ? "bg-[#059669]/10 text-[#047857]"
                        : "hover:bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "flex min-w-10 items-center justify-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase",
                        selected
                          ? "border-[#059669]/30 bg-white/70 text-[#047857]"
                          : "border-border bg-background text-foreground"
                      )}
                    >
                      {option.value}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs">
                      {option.label}
                    </span>
                    <Check
                      size={14}
                      className={selected ? "text-[#059669]" : "opacity-0"}
                    />
                  </button>
                );
              })
            ) : (
              <button
                type="button"
                onClick={() => {
                  onChange(query.trim());
                  closeDropdown();
                }}
                className="w-full rounded-lg px-3 py-3 text-left text-xs hover:bg-muted"
              >
                Dùng mã tùy chỉnh{" "}
                <span className="font-mono font-semibold">{query.trim()}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ManualSearchTab() {
  const [view, setView] = useState<"history" | "keyword">("history");
  const [history, setHistory] = useState<ManualCompetitorSearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [projects, setProjects] = useState<AffiliateLinkModel[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const hasFetched = useRef(false);
  const [form, setForm] = useState<ManualCompetitorSearchRequest>({
    keyword: "",
    location: "Vietnam",
    hl: "vi",
    gl: "vn",
    num: 10,
    noCache: true,
    enrichAdvertisers: true,
  });

  function set<K extends keyof ManualCompetitorSearchRequest>(
    key: K,
    value: ManualCompetitorSearchRequest[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setCountry(location: string) {
    const country = LOCATION_OPTIONS.find((option) => option.value === location);
    if (!country) return;

    setForm((current) => ({
      ...current,
      location: country.value,
      gl: country.gl,
    }));
  }

  const selectedProject = projects.find((project) => project.id === selectedProjectId);

  function applySelectedProject() {
    if (!selectedProject) return;
    setForm((current) => ({
      ...current,
      keyword: selectedProject.search_query || selectedProject.name || selectedProject.domain,
      projectId: selectedProject.id,
    }));
  }

  async function fetchHistory() {
    setLoading(true);
    try {
      const response = await manualSearchService.getHistory();
      setHistory(response.items);
    } catch {
      toast.error("Không tải được lịch sử Search competitor");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchHistory();
      affiliateProjectService
        .getAffiliateLinks()
        .then(setProjects)
        .catch(() => toast.error("Không tải được danh sách dự án"));
    }
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.keyword.trim()) {
      toast.error("Nhập keyword trước khi search");
      return;
    }

    setSubmitting(true);
    try {
      const response = await manualSearchService.searchCompetitor({
        ...form,
        keyword: form.keyword.trim(),
      });
      toast.success(`Search xong - tìm thấy ${response.totalAdsFound} ads`);
      await fetchHistory();
    } catch {
      toast.error("Search competitor thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  const keywordGroups = useMemo<ManualKeywordGroup[]>(() => {
    const grouped = new Map<string, ManualKeywordGroup>();

    for (const item of history) {
      const key = item.keyword.trim().toLowerCase();
      const existing = grouped.get(key);
      if (existing) {
        existing.searches.push(item);
        existing.totalAdsFound += item.totalAdsFound;
        if (item.createdAt > existing.latestSearchedAt) {
          existing.latestSearchedAt = item.createdAt;
        }
      } else {
        grouped.set(key, {
          keyword: item.keyword,
          searches: [item],
          totalAdsFound: item.totalAdsFound,
          latestSearchedAt: item.createdAt,
        });
      }
    }

    return Array.from(grouped.values()).sort((left, right) =>
      right.latestSearchedAt.localeCompare(left.latestSearchedAt)
    );
  }, [history]);

  const totalAds = history.reduce((sum, item) => sum + item.totalAdsFound, 0);
  const projectSearches = history.filter((item) => item.projectId).length;
  const standaloneSearches = history.length - projectSearches;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: "Lần search", value: history.length, icon: Search },
          { label: "Keyword", value: keywordGroups.length, icon: ListTree },
          { label: "Ads", value: totalAds, icon: SearchCheck },
          { label: "Theo dự án", value: projectSearches, icon: Link2 },
          { label: "Riêng lẻ", value: standaloneSearches, icon: Layers3 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#059669]/10">
              <Icon size={15} className="text-[#059669]" />
            </div>
            <div>
              <p className="text-lg font-bold leading-none">{value}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-foreground/90">Keyword</label>
            <input
              type="text"
              value={form.keyword}
              onChange={(event) => set("keyword", event.target.value)}
              placeholder="vpn"
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm transition-colors hover:border-[#059669]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground/90">
              Quốc gia tìm kiếm
            </label>
            <select
              value={form.location}
              onChange={(event) => setCountry(event.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm transition-colors hover:border-[#059669]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
            >
              {LOCATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.gl.toUpperCase()})
                </option>
              ))}
            </select>
          </div>


        </div>

        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">Chọn dự án để search theo project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name || project.domain} - {project.search_query || project.domain}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={applySelectedProject}
              disabled={!selectedProject}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium disabled:opacity-50",
                selectedProjectId
                  ? "border-[#059669] bg-[#059669] text-white hover:bg-[#047857]"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              <Link2 size={14} /> Dùng search dự án
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedProjectId("");
                set("projectId", null);
              }}
              className={cn(
                "h-10 rounded-lg border px-3 text-sm font-medium",
                !selectedProjectId
                  ? "border-[#059669] bg-[#059669] text-white hover:bg-[#047857]"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              Riêng lẻ
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">

          <CodeSuggestionField
            id="google-language-options"
            label="HL"
            description="ngôn ngữ giao diện Google"
            placeholder="vi"
            value={form.hl ?? ""}
            onChange={(value) => set("hl", value)}
            options={HL_OPTIONS}
          />

        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-foreground/90">Num</label>
            <input
              type="number"
              min={1}
              max={100}
              value={form.num}
              onChange={(event) => set("num", Number(event.target.value) || 1)}
              className="h-11 w-28 rounded-xl border border-border bg-background px-3 text-sm transition-colors hover:border-[#059669]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/25"
            />
          </div>

          <label className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.noCache}
              onChange={(event) => set("noCache", event.target.checked)}
              className="size-4 rounded border-border text-[#059669]"
            />
            No cache
          </label>

          <label className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.enrichAdvertisers}
              onChange={(event) => set("enrichAdvertisers", event.target.checked)}
              className="size-4 rounded border-border text-[#059669]"
            />
            Tra cứu người trả tiền quảng cáo
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="ml-auto inline-flex h-11 items-center gap-2 rounded-xl bg-[#059669] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#047857] disabled:opacity-60"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            {submitting ? "Đang search..." : "Search competitor"}
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {([
            ["history", "Theo lịch sử search"],
            ["keyword", "Gom theo keyword"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setView(value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                view === value
                  ? "bg-[#059669] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Làm mới
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 size={28} className="animate-spin text-[#059669]" />
          <p className="text-sm text-muted-foreground">Đang tải lịch sử search...</p>
        </div>
      ) : history.length === 0 ? (
        <EmptyState />
      ) : view === "history" ? (
        <div className="space-y-2">
          {history.map((item) => (
            <SearchHistoryRow key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {keywordGroups.map((group) => (
            <KeywordGroupCard key={group.keyword.toLowerCase()} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
