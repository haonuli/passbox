/**
 * 落地页 CTA 行动召唤区 — 对齐 DESIGN.md
 * - mesh 渐变作为唯一装饰（不再用翡翠绿光晕）
 * - Geist Sans 大标题 + 负字距 + 句末句号
 * - 100px pill 营销 CTA + 48px 高
 * - caption-mono 终端式副标题
 */
import Link from 'next/link';
import { ArrowRight, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LandingCta() {
  return (
    <section className="relative overflow-hidden border-t border-border py-32 sm:py-40">
      {/* 背景层 — mesh 渐变 + 极细网格 */}
      <div className="absolute inset-0 mesh-gradient-soft" aria-hidden />
      <div className="absolute inset-0 grid-bg opacity-60" aria-hidden />

      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        {/* 终端式提示 — tech-tag */}
        <div className="mb-8 flex justify-center">
          <span className="tech-tag">
            <Terminal className="h-3 w-3" />
            ready to deploy
          </span>
        </div>

        {/* 大标题 — Geist Sans + 负字距 + 句末句号 */}
        <h2 className="text-4xl font-semibold tracking-tighter sm:text-6xl">
          <span className="ink-mesh-text">现在就开始</span>
          <br />
          <span className="text-muted-foreground">保护你的密码.</span>
        </h2>

        {/* 副标题 — 终端命令风格 */}
        <p className="mx-auto mt-8 max-w-xl font-mono text-sm leading-relaxed text-muted-foreground">
          <span className="code-brand">$</span> passbox init --you
          <span className="cursor-blink" />
          <br />
          <span className="text-foreground">30 秒</span> 创建账户 ·{' '}
          <span className="text-foreground">0 条</span> 数据上传 ·{' '}
          <span className="text-foreground">∞</span> 掌控权
        </p>

        {/* CTA 按钮 — 100px pill 营销 */}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="marketing">
            <Link href="/register">
              创建免费账户
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="marketing" variant="marketing-secondary">
            <Link href="/login">已有账户？登录</Link>
          </Button>
        </div>

        {/* 底部信任行 — caption-mono */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-xs text-muted-foreground">
          <span>无广告</span>
          <span className="text-muted-foreground/40">·</span>
          <span>无追踪</span>
          <span className="text-muted-foreground/40">·</span>
          <span>无第三方分析</span>
          <span className="text-muted-foreground/40">·</span>
          <span>数据只属于你</span>
        </div>
      </div>
    </section>
  );
}
