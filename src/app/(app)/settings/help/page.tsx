/**
 * 帮助中心页 (UX-038)
 *
 * 常见问题、快捷键速查入口、数据安全说明。
 */
import Link from 'next/link';
import { ChevronLeft, ShieldCheck, Keyboard, KeyRound, Database, HelpCircle } from 'lucide-react';

const FAQS = [
  {
    q: '忘记主密码怎么办？',
    a: '由于零知识加密架构，服务器无法获知你的主密码。请使用注册时下载的恢复码在登录页点击「忘记密码」进行重置。若无恢复码则无法找回数据，需重新注册。',
  },
  {
    q: '数据是如何加密的？',
    a: '所有条目数据在客户端使用 AES-256-GCM 加密，密钥由你的主密码经 Argon2id 派生。服务器只存储密文，无法解密你的数据。',
  },
  {
    q: '什么是恢复码？',
    a: '恢复码是注册时生成的一组 24 位字符，用于在忘记主密码时重置加密密钥。请下载并离线妥善保管，任何拿到恢复码的人都可重置你的密码库。',
  },
  {
    q: '共享链接安全吗？',
    a: '共享链接使用独立的 AES-256 密钥加密，密钥保留在链接 URL 的 # 后面（不上传服务端）。链接可设置过期时间和查看次数限制。请通过安全渠道发送给信任的人。',
  },
  {
    q: '如何在多个设备同步？',
    a: '登录账号后所有数据自动同步到服务端。在新设备登录后输入主密码解锁即可下载并解密数据。主密码不存储在服务端，需在每台设备输入。',
  },
];

const TOPICS = [
  { href: '/settings/data', icon: Database, title: '导入导出数据', description: '从其他密码管理器迁移或备份' },
  { href: '/settings/security', icon: ShieldCheck, title: '安全设置', description: '两步验证、账户安全' },
];

export default function HelpPage() {
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
        <h1 className="text-base font-semibold">帮助中心</h1>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* 快捷入口 */}
          <section className="space-y-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <HelpCircle className="h-4 w-4" />
              快速了解
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {TOPICS.map((t) => {
                const Icon = t.icon;
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className="flex items-start gap-2 rounded-md border border-border p-3 transition-colors hover:bg-muted/50"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <div className="text-sm font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground">{t.description}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* 快捷键 */}
          <section className="space-y-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <Keyboard className="h-4 w-4" />
              键盘快捷键
            </h2>
            <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              在任意页面按 <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono">⌘/</kbd>（macOS）或 <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono">Ctrl+/</kbd>（Windows/Linux）打开快捷键速查表。
            </div>
          </section>

          {/* 数据安全 */}
          <section className="space-y-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4" />
              数据安全
            </h2>
            <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <div>
                  <span className="font-medium text-foreground">零知识加密：</span>
                  所有数据使用 AES-256-GCM 在客户端加密，密钥由主密码经 Argon2id 派生，服务器仅存储密文。
                </div>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <div>
                  <span className="font-medium text-foreground">SRP 认证：</span>
                  登录使用 SRP-6a 协议，主密码从不通过网络传输。
                </div>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">常见问题</h2>
            <div className="space-y-2">
              {FAQS.map((faq) => (
                <details key={faq.q} className="group rounded-md border border-border p-3">
                  <summary className="cursor-pointer list-none text-sm font-medium marker:content-['']">
                    <span className="flex items-center justify-between gap-2">
                      {faq.q}
                      <ChevronLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:-rotate-90" />
                    </span>
                  </summary>
                  <p className="mt-2 text-xs text-muted-foreground">{faq.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
