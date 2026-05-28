import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // Base — 42px height, 14px DM Sans, 8px radius
        "h-[42px] w-full min-w-0 rounded-lg border border-[#E2E8F0] bg-white px-[14px] py-[10px] text-[14px] font-[500] text-[#0F172A] transition-colors outline-none",
        // Placeholder
        "placeholder:text-[#94A3B8] placeholder:font-normal",
        // Hover
        "hover:border-[#0F172A]",
        // Focus
        "focus-visible:border-2 focus-visible:border-[#0F172A] focus-visible:ring-3 focus-visible:ring-[#0F172A]/[0.09]",
        // Error (aria-invalid)
        "aria-invalid:border-2 aria-invalid:border-[#EF4444] aria-invalid:ring-3 aria-invalid:ring-[#EF4444]/[0.09]",
        // Disabled
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-[#E2E8F0] disabled:bg-[#F1F5F9] disabled:opacity-50",
        // File input
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[#0F172A]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
