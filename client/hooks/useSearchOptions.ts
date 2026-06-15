"use client";

import { useEffect, useState } from "react";
import {
  searchAdsService,
  type SearchLocationOption,
  type SearchLanguageOption,
} from "@/services/searchAds.service";

// Fallback tối thiểu nếu chưa fetch được (giữ UI luôn dùng được).
const FALLBACK_LOCATIONS: SearchLocationOption[] = [
  { value: "Vietnam", label: "Việt Nam", gl: "vn", region: "Đông Nam Á" },
  { value: "United States", label: "Hoa Kỳ", gl: "us", region: "Bắc Mỹ" },
  { value: "United Kingdom", label: "Vương quốc Anh", gl: "uk", region: "Châu Âu" },
  { value: "Australia", label: "Úc", gl: "au", region: "Châu Đại Dương" },
  { value: "Singapore", label: "Singapore", gl: "sg", region: "Đông Nam Á" },
];
const FALLBACK_LANGUAGES: SearchLanguageOption[] = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "Tiếng Anh" },
  { value: "ja", label: "Tiếng Nhật" },
  { value: "ko", label: "Tiếng Hàn" },
];

// Cache ở cấp module — fetch một lần dùng cho mọi tab.
let cache: {
  locations: SearchLocationOption[];
  languages: SearchLanguageOption[];
} | null = null;
let inflight: Promise<void> | null = null;

export function useSearchOptions() {
  const [locations, setLocations] = useState<SearchLocationOption[]>(
    cache?.locations ?? FALLBACK_LOCATIONS
  );
  const [languages, setLanguages] = useState<SearchLanguageOption[]>(
    cache?.languages ?? FALLBACK_LANGUAGES
  );

  useEffect(() => {
    if (cache) return;
    if (!inflight) {
      inflight = searchAdsService
        .getOptions()
        .then((res) => {
          if (res.locations?.length && res.languages?.length) {
            cache = { locations: res.locations, languages: res.languages };
          }
        })
        .catch(() => {
          // Giữ fallback — không chặn UI
        })
        .finally(() => {
          inflight = null;
        });
    }
    inflight?.then(() => {
      if (cache) {
        setLocations(cache.locations);
        setLanguages(cache.languages);
      }
    });
  }, []);

  return { locations, languages };
}
