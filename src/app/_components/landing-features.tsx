/**
 * 落地页功能区
 *
 * 包含核心统计数据展示 + 6 个功能特性卡片。
 */
import { EyeOff, Lock, KeyRound, Shield, RefreshCw, Layers } from 'lucide-react';

interface Feature {
  icon: typeof Shield;
  title: string;
  description: string;
  tag: string;
}

const STATS = [
  { value: '256-bit', label: 'AES-GCM 加密' },
  { value: '0', label: '服务器可读数据' },
  { value: '16', label: '内置条目类型' },
  { value: '2FA', label: '双因素认证' },
];

const FEATURES: Feature[] = [
  {
    icon: EyeOff,
    title: '零知识加密',
    description: '主密码永远不会上传服务器。所有加密解密都在你的设备上完成，服务器只存储密文。',
    tag: '核心架构',
  },
  {
    icon: Lock,
    title: 'AES-256-GCM',
    description: '采用 Argon2id 密钥派生函数 + AES-256-GCM 认证加密，抵御暴力破解和选择密文攻击。',
    tag: '加密算法',
  },
  {
    icon: KeyRound,
    title: '密码生成器',
    description: '内置强密码生成器，支持自定义长度、字符集，自动避免易混淆字符，实时评估密码强度。',
    tag: '密码工具',
  },
  {
    icon: Shield,
    title: '双因素认证',
    description: '支持 TOTP 双因素认证，提供 10 个一次性备用码。即使主密码泄露，账户依然安全。',
    tag: '账户安全',
  },
  {
    icon: RefreshCw,
    title: '恢复码机制',
    description: '忘记主密码？通过 80 位熵的恢复码安全重置主密码，密码库数据完整保留。',
    tag: '数据恢复',
  },
  {
    icon: Layers,
    title: '16 种条目类型',
    description: '登录凭证、信用卡、身份信息、银行账户、API 密钥等 16 种类型，覆盖全部密码管理场景。',
    tag: '数据管理',
  },
];

export function LandingFeatures() {
  return (
    <section className="relative border-t border-border py-24">
      <div className="mx-auto max-w-6xl px-6">
        {/* 统计数据 */}
        <div className="mb-24 grid grid-cols-2 gap-8 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                {stat.value}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* 区块标题 */}
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            为安全而生的每一个细节
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            从加密算法到用户体验，全方位保障你的密码安全
          </p>
        </div>

        {/* 功能卡片网格 */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="landing-feature-card group flex flex-col gap-3 rounded-xl border border-border bg-card/30 p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background transition-colors group-hover:border-primary/40">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {feature.tag}
                  </span>
                </div>
                <h3 className="text-base font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
