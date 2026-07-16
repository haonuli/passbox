/**
 * 落地页 Hero 区域
 *
 * 全屏视觉冲击：网格背景 + 渐变光晕 + 入场动画 + 装饰性加密元素。
 */
import Link from 'next/link';
import { ArrowRight, Lock, Shield, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LandingHero() {
  return (
    <section className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden">
      {/* 网格背景 */}
      <div className="landing-grid-bg absolute inset-0" />

      {/* 渐变光晕 */}
      <div className="landing-glow landing-animate-pulse-glow absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full" />

      {/* 装饰性浮动元素 */}
      <div className="landing-animate-float absolute left-[10%] top-[25%] hidden lg:block">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card/50 backdrop-blur-sm">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
      </div>
      <div className="landing-animate-float delay-500 absolute right-[12%] top-[30%] hidden lg:block">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card/50 backdrop-blur-sm">
          <Shield className="h-6 w-6 text-muted-foreground" />
        </div>
      </div>
      <div className="landing-animate-float delay-300 absolute bottom-[20%] left-[15%] hidden lg:block">
        <div className="rounded-lg border border-border bg-card/50 px-3 py-1.5 font-mono text-xs text-muted-foreground backdrop-blur-sm">
          AES-256-GCM
        </div>
      </div>
      <div className="landing-animate-float delay-700 absolute bottom-[25%] right-[18%] hidden lg:block">
        <div className="rounded-lg border border-border bg-card/50 px-3 py-1.5 font-mono text-xs text-muted-foreground backdrop-blur-sm">
          Argon2id
        </div>
      </div>

      {/* 中心内容 */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        {/* 信任徽章 */}
        <div className="landing-animate-fade-up flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 backdrop-blur-sm">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">
            零知识加密架构 · 端到端保护
          </span>
        </div>

        {/* 主标题 */}
        <h1 className="landing-animate-fade-up delay-100 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
          <span className="landing-gradient-text">你的密码</span>
          <br />
          <span className="text-foreground">只有你能解开</span>
        </h1>

        {/* 副标题 */}
        <p className="landing-animate-fade-up delay-200 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          PassBox 采用零知识加密架构，您的主密码永远不会离开设备。
          即使是我们的服务器，也无法读取您的任何数据。
        </p>

        {/* CTA 按钮 */}
        <div className="landing-animate-fade-up delay-300 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 px-8 text-base">
            <Link href="/register">
              免费开始使用
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base">
            <Link href="/login">登录账户</Link>
          </Button>
        </div>

        {/* 底部信任信息 */}
        <div className="landing-animate-fade-in delay-700 mt-8 flex items-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            银行级加密
          </span>
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            主密码不上传
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            开源架构
          </span>
        </div>
      </div>
    </section>
  );
}
