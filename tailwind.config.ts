import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

/**
 * Tailwind 配置 — 对齐 DESIGN.md (Vercel-Inspired) 设计令牌
 *
 * - 颜色：ink (#171717) 主色 / canvas (#ffffff) / canvas-soft (#fafafa) / canvas-soft-2 (#f5f5f5)
 * - 圆角：sm 6px (导航/输入) · md 8px (营销卡片) · lg 12px (大卡片/模态) · pill 100px (营销 CTA)
 * - 阴影：stacked（多层小偏移 + inset 发丝边），通过 .shadow-stack-* 工具类使用
 * - 渐变：mesh (cyan/blue/magenta/amber) — 仅用于 hero/CTA 大尺度装饰
 */
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        // DESIGN.md 语义色 — success/link #0070f3, warning #f5a623, error #ee0000
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground, 0 0% 100%))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground, 0 0% 9%))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // DESIGN.md 品牌渐变色 — 仅用于 mesh 装饰，不作为 UI 强调色
        brand: {
          cyan: "#50e3c2",
          blue: "#007cf0",
          violet: "#7928ca",
          pink: "#ff0080",
          amber: "#f9cb28",
          coral: "#ff4d4d",
        },
      },
      borderRadius: {
        none: "0px",
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "pill-sm": "64px",
        pill: "100px",
        full: "9999px",
        // 兼容 shadcn 旧 token
        DEFAULT: "var(--radius)",
      },
      fontFamily: {
        sans: "var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, sans-serif",
        mono: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
      },
      fontSize: {
        // DESIGN.md typography — 负字距是品牌声音的一部分
        "display-xl": ["48px", { lineHeight: "48px", letterSpacing: "-2.4px", fontWeight: "600" }],
        "display-lg": ["32px", { lineHeight: "40px", letterSpacing: "-1.28px", fontWeight: "600" }],
        "display-md": ["24px", { lineHeight: "32px", letterSpacing: "-0.96px", fontWeight: "600" }],
        "display-sm": ["20px", { lineHeight: "28px", letterSpacing: "-0.6px", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px", letterSpacing: "0px", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "24px", letterSpacing: "0px", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "20px", letterSpacing: "-0.28px", fontWeight: "400" }],
        "caption": ["12px", { lineHeight: "16px", letterSpacing: "0px", fontWeight: "400" }],
        "caption-mono": ["12px", { lineHeight: "16px", letterSpacing: "0px", fontWeight: "400" }],
        "code": ["13px", { lineHeight: "20px", letterSpacing: "0px", fontWeight: "400" }],
      },
      letterSpacing: {
        tightest: "-2.4px",
        tighter: "-1.28px",
        tight: "-0.96px",
        snug: "-0.6px",
        caption: "-0.28px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "mesh-drift": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(2%,-2%,0) scale(1.05)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "mesh-drift": "mesh-drift 14s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
