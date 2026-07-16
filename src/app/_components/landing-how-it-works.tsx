/**
 * 落地页加密流程说明区
 *
 * 3 步展示零知识加密的核心流程，用技术化的视觉语言传达专业性。
 */
import { KeyRound, Lock, ShieldCheck } from 'lucide-react';

interface Step {
  number: string;
  icon: typeof KeyRound;
  title: string;
  description: string;
  code: string;
}

const STEPS: Step[] = [
  {
    number: '01',
    icon: KeyRound,
    title: '主密码派生密钥',
    description: '输入主密码后，设备本地通过 Argon2id 算法（64MB 内存 / 3 次迭代）派生出 256 位 Master Key。主密码本身永不上传。',
    code: 'password → Argon2id → Master Key',
  },
  {
    number: '02',
    icon: Lock,
    title: '数据加密上传',
    description: '使用 AES-256-GCM 认证加密算法对每条密码条目独立加密，附带 AAD 绑定防止密文替换攻击。服务器仅存储密文。',
    code: 'plaintext → AES-GCM → ciphertext',
  },
  {
    number: '03',
    icon: ShieldCheck,
    title: '零知识验证',
    description: '登录时从主密码派生 Auth Hash，服务端仅验证 Hash 匹配。即使数据库完整泄露，攻击者也无法还原任何明文。',
    code: 'Master Key → HKDF → Auth Hash',
  },
];

export function LandingHowItWorks() {
  return (
    <section className="relative overflow-hidden border-t border-border bg-muted/20 py-24">
      <div className="mx-auto max-w-5xl px-6">
        {/* 区块标题 */}
        <div className="mb-16 text-center">
          <span className="font-mono text-sm text-muted-foreground">{'// 加密流程'}</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            三步理解零知识加密
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            你的数据在离开设备前就已加密，密码学保证服务器无法解密
          </p>
        </div>

        {/* 步骤列表 */}
        <div className="relative flex flex-col gap-12 lg:flex-row lg:gap-0">
          {/* 连接线（桌面端） */}
          <div className="landing-step-line absolute left-0 top-8 hidden h-px w-full lg:block" />

          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="relative flex-1 lg:px-8">
                {/* 步骤图标 */}
                <div className="relative z-10 mb-6 flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-background">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <span className="font-mono text-2xl font-bold text-muted-foreground/40">
                    {step.number}
                  </span>
                </div>

                {/* 步骤内容 */}
                <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
                <div className="rounded-md border border-border bg-card/50 px-3 py-2 font-mono text-xs text-muted-foreground">
                  {step.code}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
