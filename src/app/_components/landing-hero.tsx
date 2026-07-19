/**
 * 落地页 Hero — 对齐 DESIGN.md (Vercel-Inspired)
 *
 * - Mesh 渐变（cyan/blue/magenta/amber）作为唯一装饰
 * - Geist Sans 大标题，负字距，句末加句号
 * - 100px pill 营销 CTA + 48px 高
 * - caption-mono 技术标签
 */
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** 技术参数 ticker — 展示真实加密规格 */
const TICKER_ITEMS = [
  'AES-256-GCM',
  'Argon2id · 64MiB · 3 iter',
  'SRP-6a',
  'HKDF-SHA256',
  'TOTP RFC 6238',
  'AAD Bound',
  'Zero-Knowledge',
  '24h Session',
  'token_version Revocation',
  'Rate Limited',
  '17 Item Types',
  'PWA Offline',
];

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      {/* 背景层：mesh 渐变 + 极细网格 */}
      <div className="absolute inset-0 mesh-gradient-soft" aria-hidden />
      <div className="absolute inset-0 grid-bg opacity-60" aria-hidden />

      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-32 pb-20 sm:pt-40 sm:pb-28">
        {/* 信任徽章 — caption-mono 风格 */}
        <div className="animate-fade-up flex justify-center">
          <span className="tech-tag">
            <ShieldCheck className="h-3 w-3" />
            零知识架构 · 端到端加密
          </span>
        </div>

        {/* 主标题 — Geist Sans 600，负字距，句末加句号 */}
        <h1 className="animate-fade-up delay-100 mt-8 text-center text-5xl font-semibold leading-[1.05] tracking-tighter sm:text-7xl lg:text-8xl">
          <span className="ink-mesh-text">你的密码</span>
          <br />
          只有你能解开.
        </h1>

        {/* 副标题 — body-lg */}
        <p className="animate-fade-up delay-200 mx-auto mt-8 max-w-2xl text-center text-lg leading-relaxed text-muted-foreground">
          PassBox 采用零知识加密架构，主密码通过 SRP 协议完成验证，
          <span className="text-foreground">永远不会离开你的设备</span>。
          即使数据库完整泄露，攻击者也无法还原任何明文。
        </p>

        {/* CTA — 100px pill 营销按钮 */}
        <div className="animate-fade-up delay-300 mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="marketing">
            <Link href="/register">
              免费开始使用
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="marketing" variant="marketing-secondary">
            <Link href="/login">登录账户</Link>
          </Button>
        </div>

        {/* 终端式提示行 — caption-mono */}
        <div className="animate-fade-in delay-700 mt-12 flex justify-center">
          <div className="font-mono text-xs text-muted-foreground">
            <span className="code-brand">$</span>
            <span className="ml-2">passbox --encrypt</span>
            <span className="cursor-blink" />
          </div>
        </div>
      </div>

      {/* 底部技术参数 ticker */}
      <div className="relative z-10 border-y border-border bg-secondary/40 py-4 overflow-hidden">
        <div className="animate-ticker flex whitespace-nowrap">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="flex items-center">
              <span className="font-mono text-xs text-muted-foreground">{item}</span>
              <span className="tick-sep font-mono text-xs">·</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
