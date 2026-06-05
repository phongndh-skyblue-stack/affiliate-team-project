"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  Globe,
  Link2,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { searchAdsService } from "@/services/searchAds.service";
import type { SearchAdsCompetitorItem } from "@/types/searchAds.types";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        pct >= 90 ? "bg-[#059669]/10 text-[#059669]" : "bg-amber-500/10 text-amber-700"
      )}
    >
      {pct}%
    </span>
  );
}

interface KeywordGroup {
  keyword: string;
  competitors: SearchAdsCompetitorItem[];
}

function buildGroups(items: SearchAdsCompetitorItem[]) {
  const map = new Map<string, SearchAdsCompetitorItem[]>();
  for (const item of items) {
    const key = item.keyword.trim().toLowerCase();
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return Array.from(map.values())
    .map((competitors) => ({
      keyword: competitors[0].keyword,
      competitors,
    }))
    .sort((a, b) => {
      const aTime = a.competitors[0]?.createdAt ?? "";
      const bTime = b.competitors[0]?.createdAt ?? "";
      return bTime.localeCompare(aTime);
    });
}

function CompetitorCard({
  item,
  deleting,
  onDelete,
}: {
  item: SearchAdsCompetitorItem;
  deleting: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex items-start gap-3 p-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#059669]/10 text-xs font-bold text-[#059669]">
          {item.position ?? "-"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{item.title || item.advertiserName}</p>
          {item.snippet && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.snippet}</p>}
          {item.displayUrl && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.displayUrl}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ConfidenceBadge value={item.confidence} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(item.id)}
            disabled={deleting}
            className="border border-border text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Xóa
          </Button>
        </div>
      </div>

      {(item.advertiserName || item.advertiserDomain || item.advertiserLocation) && (
        <div className="space-y-1 border-t border-border bg-muted/30 px-3 py-2 text-xs">
          {(item.advertiserName || item.advertiserLocation) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {item.advertiserName && (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <ShieldCheck size={11} className="text-[#059669]" />
                  <span className="text-muted-foreground">Advertiser:</span>
                  <span>{item.advertiserName}</span>
                </span>
              )}
              {item.advertiserLocation && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={11} className="text-muted-foreground" />
                  <span className="text-muted-foreground">Location:</span>
                  <span className="font-medium">{item.advertiserLocation}</span>
                </span>
              )}
              <span className="text-muted-foreground">{formatDateTime(item.createdAt)}</span>
            </div>
          )}
          {item.advertiserDomain && (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Globe size={11} />
              <span>Domain:</span>
              <span>{item.advertiserDomain}</span>
            </span>
          )}
        </div>
      )}

      {item.landingPage && (
        <div className="space-y-1.5 border-t border-border bg-muted/10 px-3 py-2 text-xs">
          <p className="flex items-center gap-1.5 font-semibold text-muted-foreground">
            <Link2 size={11} />
            Landing Page
          </p>
          {item.landingPage.originalUrl && (
            <div className="flex items-start gap-1.5">
              <span className="w-20 shrink-0 text-muted-foreground">Original URL:</span>
              <a
                href={item.landingPage.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-[#059669] hover:underline"
              >
                {item.landingPage.originalUrl}
              </a>
            </div>
          )}
          {item.landingPage.finalUrl && (
            <div className="flex items-start gap-1.5">
              <span className="w-20 shrink-0 text-muted-foreground">Final URL:</span>
              <a
                href={item.landingPage.finalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-[#059669] hover:underline"
              >
                {item.landingPage.finalUrl}
              </a>
            </div>
          )}
          {item.landingPage.domain && (
            <div className="flex items-center gap-1.5">
              <span className="w-20 shrink-0 text-muted-foreground">Domain:</span>
              <span className="font-medium">{item.landingPage.domain}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-20 shrink-0 text-muted-foreground">Status:</span>
            <span className={cn("font-medium", item.landingPage.status === "success" ? "text-[#059669]" : "text-destructive")}>
              {item.landingPage.status}
            </span>
            {item.landingPage.finalStatusCode && (
              <span className="text-muted-foreground">({item.landingPage.finalStatusCode})</span>
            )}
          </div>
          {(item.landingPage.redirectChain?.length ?? 0) > 0 && (
            <div className="flex items-start gap-1.5">
              <span className="w-20 shrink-0 text-muted-foreground">Redirects:</span>
              <div className="space-y-0.5">
                {item.landingPage.redirectChain.map((url, index) => (
                  <a
                    key={`${url}-${index}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-all text-muted-foreground hover:text-[#059669] hover:underline"
                  >
                    {index + 1}. {url}
                  </a>
                ))}
              </div>
            </div>
          )}
          {item.landingPage.error && (
            <div className="flex items-start gap-1.5">
              <span className="w-20 shrink-0 text-muted-foreground">Error:</span>
              <p className="break-all text-destructive">{item.landingPage.error}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 border-t border-border px-3 py-2">
        {item.targetUrl && (
          <a
            href={item.targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#059669] hover:underline"
          >
            Xem quảng cáo <ExternalLink size={11} />
          </a>
        )}
        {item.landingPage?.finalUrl && item.landingPage.finalUrl !== item.targetUrl && (
          <a
            href={item.landingPage.finalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            Landing page <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}

function KeywordSection({
  group,
  deletingId,
  onDelete,
}: {
  group: KeywordGroup;
  deletingId: string | null;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{group.keyword}</p>
          <p className="text-xs text-muted-foreground">{group.competitors.length} đối thủ đã lưu</p>
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#059669]/10 text-[#059669]">
          <Users size={16} />
        </div>
      </div>
      <div className="grid gap-3 p-4 xl:grid-cols-2">
        {group.competitors.map((item) => (
          <CompetitorCard
            key={item.id}
            item={item}
            deleting={deletingId === item.id}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
}

export function MySearchAdsCompetitorsTab() {
  const [items, setItems] = useState<SearchAdsCompetitorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const groups = useMemo(() => buildGroups(items), [items]);

  async function fetchCompetitors() {
    setLoading(true);
    try {
      const res = await searchAdsService.getCompetitors();
      setItems(res.items);
    } catch {
      toast.error("Không tải được danh sách đối thủ");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await searchAdsService.deleteCompetitor(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
      toast.success("Đã xóa đối thủ");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Không thể xóa đối thủ");
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    let ignore = false;
    Promise.resolve()
      .then(() => searchAdsService.getCompetitors())
      .then((res) => {
        if (!ignore) setItems(res.items);
      })
      .catch(() => {
        if (!ignore) toast.error("Không tải được danh sách đối thủ");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Đối thủ đã lưu từ Google Search</h2>
          <p className="text-xs text-muted-foreground">
            Danh sách được gom theo từ khóa tìm kiếm, chống trùng theo advertiser trong cùng từ khóa.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={fetchCompetitors}
          disabled={loading}
          className="border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Làm mới
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 size={28} className="animate-spin text-[#059669]" />
          <p className="text-sm text-muted-foreground">Đang tải đối thủ...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-[#059669]/10 ring-8 ring-[#059669]/5">
            <Users size={28} className="text-[#059669]/70" />
          </div>
          <p className="text-sm font-semibold">Chưa có đối thủ nào</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Vào Đối thủ (Google Ads), mở kết quả ở tab All và thêm advertiser vào danh sách này.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <KeywordSection
              key={group.keyword.toLowerCase()}
              group={group}
              deletingId={deletingId}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
