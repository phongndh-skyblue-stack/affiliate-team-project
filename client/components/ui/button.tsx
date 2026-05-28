import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "cursor-pointer inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-all duration-200 ease-out outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Primary: Navy fill — lift + deepen glow on hover
        default:
          "bg-[#0F172A] text-white shadow-[0_1px_3px_rgba(15,23,42,0.18)] hover:bg-[#020617] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(15,23,42,0.35)] active:translate-y-px active:shadow-none",
        // Outline: navy border — fill + lift on hover
        outline:
          "border border-[#0F172A] bg-transparent text-[#0F172A] hover:bg-[#0F172A] hover:text-white hover:-translate-y-0.5 hover:shadow-[0_4px_14px_rgba(15,23,42,0.25)] active:translate-y-px",
        // Secondary filled — subtle lift
        secondary:
          "bg-[#F1F5F9] text-[#0F172A] hover:bg-[#E2E8F0] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(15,23,42,0.10)] active:translate-y-px",
        // Ghost — background reveal + text darken
        ghost:
          "bg-transparent text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A] hover:-translate-y-0.5 active:translate-y-px",
        // Destructive — red glow lift
        destructive:
          "bg-[#EF4444] text-white hover:bg-[#DC2626] hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(239,68,68,0.40)] active:translate-y-px active:shadow-none",
        // Sage CTA — green glow lift
        sage:
          "bg-[#059669] text-white shadow-[0_1px_3px_rgba(5,150,105,0.25)] hover:bg-[#047857] hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(5,150,105,0.40)] active:translate-y-px active:shadow-none",
        link: "text-[#059669] underline-offset-4 hover:underline",
      },
      size: {
        // sm: 32px h, 14px font
        sm: "h-8 gap-1 rounded-md px-3.5 text-sm",
        // default/md: 42px h, 14px font
        default: "h-[42px] gap-1.5 px-[22px] text-sm",
        // lg: 48px h, 16px font
        lg: "h-12 gap-2 px-7 text-base",
        icon: "size-[42px]",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
