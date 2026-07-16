/**
 * 落地页 CTA 行动召唤区
 *
 * 渐变背景 + 强号召文案，驱动用户注册。
 */
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LandingCta() {
  return (
    <section className="relative overflow-hidden border-t border-border py-24">
      {/* 渐变背景层 */}
      <div
        className="absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 60% 80% at 50% 100%, hsl(var(--primary) / 0.08), transparent 70%)',
        }}
      />
      <div className="landing-grid-bg absolute inset-0 opacity-30" />

      <div className="relative z-10 mx-auto max-w-2xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          现在就开始保护你的密码
        </h2>
        <p className="mt-4 text-base text-muted-foreground">
          免费创建账户，30 秒内开始管理你的加密密码库。
          没有广告，没有追踪，你的数据只属于你。
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="h-12 px-8 text-base">
            <Link href="/register">
              创建免费账户
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base">
            <Link href="/login">已有账户？登录</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
