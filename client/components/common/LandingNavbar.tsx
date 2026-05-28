"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#features", label: "Tính năng" },
  { href: "#how-it-works", label: "Cách hoạt động" },
  { href: "#stats", label: "Thống kê" },
  { href: "#testimonials", label: "Đánh giá" },
];

function smoothScrollTo(targetId: string) {
  const el = document.querySelector(targetId);
  if (!el) return;
  const targetY = el.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo({ top: targetY, behavior: "smooth" });
}

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out",
        !scrolled && "py-4",
        scrolled && "py-2 mt-3"
      )}
    >
      <div
        className={cn(
          "mx-auto transition-all duration-500 ease-out flex items-center justify-between px-6",
          !scrolled && "max-w-6xl",
          scrolled &&
            "max-w-4xl rounded-2xl border border-[#E2E8F0] bg-white/80 backdrop-blur-2xl shadow-[0_4px_24px_rgba(15,23,42,0.10)] px-5 py-2.5"
        )}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image
            src="/logo-with-name.png"
            alt="MIC ACE"
            width={120}
            height={26}
            priority
            className={cn(
              "transition-all duration-500 object-contain h-auto",
              scrolled ? "w-[100px]" : "w-[120px]"
            )}
            style={{ height: "auto" }}
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden gap-7 text-sm font-medium text-[#64748B] md:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              onClick={(e) => {
                e.preventDefault();
                smoothScrollTo(href);
              }}
              className="relative py-1 hover:text-[#0F172A] transition-colors duration-200 group cursor-pointer"
            >
              {label}
              <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-[#059669] transition-all duration-300 group-hover:w-full rounded-full" />
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-2.5">
          <Link href={ROUTES.LOGIN}>
            <Button variant="ghost" size="sm" className="font-medium">
              Đăng nhập
            </Button>
          </Link>
          <Link href={ROUTES.REGISTER}>
            <Button size="sm" className="font-semibold">
              Đăng ký miễn phí
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors text-[#0F172A]"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={cn(
          "md:hidden mx-3 mt-2 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(15,23,42,0.12)] transition-all duration-300 ease-out",
          mobileOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0 pointer-events-none border-0"
        )}
      >
        <div className="flex flex-col p-4 gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              onClick={(e) => {
                e.preventDefault();
                setMobileOpen(false);
                smoothScrollTo(href);
              }}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
            >
              {label}
            </a>
          ))}
          <div className="h-px bg-[#E2E8F0] my-2" />
          <div className="flex gap-2">
            <Link href={ROUTES.LOGIN} className="flex-1" onClick={() => setMobileOpen(false)}>
              <Button variant="outline" size="sm" className="w-full">Đăng nhập</Button>
            </Link>
            <Link href={ROUTES.REGISTER} className="flex-1" onClick={() => setMobileOpen(false)}>
              <Button size="sm" className="w-full font-semibold">Đăng ký</Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

