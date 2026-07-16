/**
 * 落地页
 *
 * 产品官网风格：Header 导航 + Hero + 统计/功能 + 加密流程 + CTA + Footer
 */
import Link from 'next/link';
import { Code2 } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { LandingHero } from './_components/landing-hero';
import { LandingFeatures } from './_components/landing-features';
import { LandingHowItWorks } from './_components/landing-how-it-works';
import { LandingCta } from './_components/landing-cta';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">PassBox</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Beta
            </span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <Link href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              功能特性
            </Link>
            <Link href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              加密原理
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">登录</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">创建账户</Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* 主体内容 */}
      <main className="flex-1">
        <LandingHero />

        <div id="features">
          <LandingFeatures />
        </div>

        <div id="how-it-works">
          <LandingHowItWorks />
        </div>

        <LandingCta />
      </main>

      {/* 底部 */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">PassBox</span>
            <span>·</span>
            <span>零知识密码管理器</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/login" className="transition-colors hover:text-foreground">
              登录
            </Link>
            <Link href="/register" className="transition-colors hover:text-foreground">
              注册
            </Link>
            <Link href="/recover" className="transition-colors hover:text-foreground">
              恢复账户
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
              aria-label="GitHub"
            >
              <Code2 className="h-4 w-4" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
