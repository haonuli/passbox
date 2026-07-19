/**
 * 落地页 — 对齐 DESIGN.md (Vercel-Inspired)
 *
 * 结构：
 * 1. Header 导航（64px 高，发丝边）
 * 2. Hero（mesh 渐变 + 技术 ticker）
 * 3. Encryption 加密参数展示（终端 + 代码片段）
 * 4. Features 功能矩阵（按场景分组）
 * 5. HowItWorks 加密流程（4 步交错布局）
 * 6. Specs 技术规格表
 * 7. CTA 行动召唤（mesh 渐变 + pill CTA）
 * 8. Footer（caption-mono 列标题）
 */
import Link from 'next/link';
import { Code2 } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { LandingHero } from './_components/landing-hero';
import { LandingEncryption } from './_components/landing-encryption';
import { LandingFeatures } from './_components/landing-features';
import { LandingHowItWorks } from './_components/landing-how-it-works';
import { LandingSpecs } from './_components/landing-specs';
import { LandingCta } from './_components/landing-cta';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* 顶部导航 — 64px 高，发丝边，毛玻璃 */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">PassBox</span>
            <span className="badge-soft">v1.0</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <Link
              href="#encryption"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              加密参数
            </Link>
            <Link
              href="#features"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              功能矩阵
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              加密流程
            </Link>
            <Link
              href="#specs"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              技术规格
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

        <div id="encryption" className="scroll-mt-16">
          <LandingEncryption />
        </div>

        <div id="features" className="scroll-mt-16">
          <LandingFeatures />
        </div>

        <div id="how-it-works" className="scroll-mt-16">
          <LandingHowItWorks />
        </div>

        <div id="specs" className="scroll-mt-16">
          <LandingSpecs />
        </div>

        <LandingCta />
      </main>

      {/* 底部 — caption-mono 列标签 */}
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
