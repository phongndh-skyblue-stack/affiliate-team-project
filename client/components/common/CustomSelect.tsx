"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CustomSelectOption<T extends string | number = string | number> {
  value: T;
  label: string;
}

export interface CustomSelectProps<T extends string | number = string | number> {
  label?: string;
  value: T;
  onChange: (value: T) => void;
  options: CustomSelectOption<T>[];
  placeholder?: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
  clearable?: boolean;
  clearText?: string;
  disabled?: boolean;
}

export function CustomSelect<T extends string | number = string | number>({
  label,
  value,
  onChange,
  options,
  placeholder = "Chọn...",
  showSearch = false,
  searchPlaceholder = "Tìm kiếm...",
  clearable = false,
  clearText = "Xóa lựa chọn",
  disabled = false,
}: CustomSelectProps<T>) {
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

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  const filteredOptions = useMemo(() => {
    if (!showSearch) return options;
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((opt: CustomSelectOption<T>) => opt.label.toLowerCase().includes(query));
  }, [options, search, showSearch]);

  const selectedOption = options.find((opt: CustomSelectOption<T>) => opt.value === value);

  return (
    <div className="relative flex flex-col" ref={containerRef}>
      {label && <span className="text-sm font-medium mb-1 text-foreground">{label}</span>}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition min-h-[38px] text-foreground",
          disabled
            ? "cursor-not-allowed opacity-60 bg-muted/20"
            : "cursor-pointer hover:border-[#059669]/50 focus-within:border-[#059669]"
        )}
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
              className="mb-2 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:border-[#059669] text-foreground placeholder:text-muted-foreground"
              autoFocus
            />
          )}
          <div className="overflow-y-auto flex-1 space-y-0.5 max-h-[200px]">
            {clearable && value && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("" as unknown as T);
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
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted",
                      isSelected ? "bg-[#059669]/10 font-medium text-[#059669]" : "text-foreground"
                    )}
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
