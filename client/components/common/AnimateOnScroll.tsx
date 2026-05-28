"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  className?: string;
  animation?: "fade-in-up" | "fade-in-down" | "fade-in" | "slide-left" | "slide-right" | "scale-in";
  delay?: number;
  threshold?: number;
}

export function AnimateOnScroll({
  children,
  className,
  animation = "fade-in-up",
  delay = 0,
  threshold = 0.15,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        opacity: visible ? undefined : 0,
        animation: visible ? `${animationMap[animation]} 0.7s cubic-bezier(.22,1,.36,1) ${delay}ms both` : "none",
      }}
    >
      {children}
    </div>
  );
}

const animationMap: Record<NonNullable<Props["animation"]>, string> = {
  "fade-in-up":   "fade-in-up",
  "fade-in-down": "fade-in-down",
  "fade-in":      "fade-in",
  "slide-left":   "slide-in-left",
  "slide-right":  "slide-in-right",
  "scale-in":     "scale-in",
};
