/**
 * 关于 Passbox 页 (UX-038)
 *
 * 展示版本号、技术栈、核心特性。
 */
import Link from 'next/link';
import { ChevronLeft, ShieldCheck, Code2, Lock, ExternalLink } from 'lucide-react';

const TECH_STACK = [
  { label: '前端框架', value: 'Next.js 16 (App Router)' },
  { label: '类型系统', value: 'TypeScript (strict mode)' },
  { label: 'UI 组件', value: 'shadcn/ui + Tailwind CSS v3' },
  { label: '状态管理', value: 'Zustand + React Hook Form' },
  { label: '数据库', value: 'PostgreSQL' },
  { label: '加密库', value: 'libsodium-sumo (Argon2id + AES-256-GCM)' },
  { label: '认证协议', value: 'SRP-6a (Secure Remote Password)' },
];

const FEATURES = [
  { icon: Lock, title: '零知识加密', description: '主密码永不离开客户端，服务器无法解密你的数据' },
  { icon: ShieldCheck, title: '端到端加密', description: 'AES-256-GCM 加密所有条目，Argon2id 派生密钥' },
  { icon: Code2, title: '开源透明', description: '代码可审计，无后门' },
];

export default function AboutPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Link
          href="/settings"
          className="flex items-center text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          设置
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-base font-semibold">关于 Passbox</h1>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Logo 与简介 */}
          <section className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Lock className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Passbox</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                零知识端到端加密密码管理器 · v1.0.0
              </p>
            </div>
            <p className="max-w-md text-xs text-muted-foreground">
              一个安全、开源、零知识的密码管理系统。所有数据在客户端加密，服务器仅存储密文，主密码永不离开你的设备。
            </p>
          </section>

          {/* 核心特性 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">核心特性</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.title}
                    className="rounded-md border border-border bg-muted/20 p-3"
                  >
                    <Icon className="mb-1.5 h-4 w-4 text-primary" />
                    <div className="text-xs font-medium">{f.title}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{f.description}</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 技术栈 */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">技术栈</h3>
            <dl className="overflow-hidden rounded-md border border-border">
              {TECH_STACK.map((t, i) => (
                <div
                  key={t.label}
                  className={`flex items-center justify-between gap-3 px-3 py-2 text-xs ${
                    i > 0 ? 'border-t border-border' : ''
                  }`}
                >
                  <dt className="text-muted-foreground">{t.label}</dt>
                  <dd className="font-mono text-foreground">{t.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* 链接 */}
          <section className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs text-muted-foreground">
            <Link
              href="/settings/help"
              className="flex items-center gap-1 hover:text-foreground"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              帮助中心
            </Link>
            <span>·</span>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              源代码
            </a>
          </section>

          <p className="pt-2 text-center text-[11px] text-muted-foreground">
            © 2026 Passbox. Made with security in mind.
          </p>
        </div>
      </div>
    </div>
  );
}
