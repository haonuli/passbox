import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Button — 对齐 DESIGN.md (Vercel-Inspired) 规范
 *
 * - default / secondary / outline：导航/应用内 6px 圆角（rounded-sm）
 * - marketing：营销 CTA，100px pill + 48px 高，配 button-lg 字号
 * - marketing-sm：导航级营销 CTA，100px pill + 32px 高
 * - 阴影：仅营销 CTA 与 default 使用极轻堆叠；其余保持平面
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // 营销级 secondary — 白色 pill 配 ink 文字
        marketing:
          "bg-primary text-primary-foreground hover:bg-primary/90",
        "marketing-secondary":
          "bg-background text-foreground border border-border hover:bg-accent",
      },
      size: {
        default: "h-9 rounded-sm px-4 py-2",
        sm: "h-8 rounded-sm px-3 text-xs",
        lg: "h-10 rounded-md px-6",
        icon: "h-9 w-9 rounded-sm",
        // 营销级 — 100px pill, 48px 高
        marketing: "h-12 rounded-pill px-6 text-base font-medium",
        "marketing-sm": "h-8 rounded-pill px-4 text-sm font-medium",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
