/**
 * 落地页加密流程说明区 — 对齐 DESIGN.md
 * - 步骤标题 Geist Sans + 负字距
 * - 终端窗口 .terminal-mockup
 * - eyebrow 使用 .tech-tag
 * - 步骤图标使用 ink 主色（不再用翡翠绿）
 */
import { KeyRound, Split, Lock, ShieldCheck } from 'lucide-react';
import { LandingTerminal } from './landing-terminal';

interface Step {
  number: string;
  icon: typeof KeyRound;
  title: string;
  description: string;
  badge: { text: string; color: 'green' | 'blue' | 'amber' | 'pink' };
  output: { command: string; result: string; status?: 'ok' | 'warn' | 'info' };
  code: {
    label: string;
    snippet: string;
  };
}

const STEPS: Step[] = [
  {
    number: '01',
    icon: KeyRound,
    title: 'Argon2id 派生 Master Key',
    description:
      '主密码在设备本地通过 Argon2id 算法（64MB 内存 / 3 次迭代 / parallelism 4）派生出 256 位 Master Key。主密码本身永不上传服务器。',
    badge: { text: '64MiB · 3 iter', color: 'amber' },
    output: {
      command: 'passbox kdf --derive master',
      result: 'derived 256-bit master key in 480ms · memory-hard',
      status: 'ok',
    },
    code: {
      label: 'crypto / kdf.ts',
      snippet: [
        'const masterKey = await argon2id(',
        '  password,',
        '  salt,',
        '  64 * 1024,  // 64 MiB',
        '  3,          // iterations',
        '  4,          // parallelism',
        '  32,         // 256-bit',
        ');',
      ].join('\n'),
    },
  },
  {
    number: '02',
    icon: Split,
    title: 'HKDF 派生三个派生密钥',
    description:
      '从 Master Key 通过 HKDF-SHA256 派生出 Symmetric Key（加密数据）、Auth Hash（服务端验证）和 Recovery Key（账户恢复）。',
    badge: { text: 'HKDF-SHA256', color: 'blue' },
    output: {
      command: 'passbox keys --derive-from master',
      result: '3 keys derived · symmetric · auth · recovery · domain-separated',
      status: 'ok',
    },
    code: {
      label: 'crypto / keys.ts',
      snippet: [
        "const symmetricKey = hkdf(masterKey, 'passbox:symmetric');",
        "const authHash    = hkdf(masterKey, 'passbox:auth');",
        "const recoveryKey = hkdf(masterKey, 'passbox:recovery');",
      ].join('\n'),
    },
  },
  {
    number: '03',
    icon: Lock,
    title: 'AES-256-GCM 加密条目',
    description:
      '每条密码条目独立加密，附带 AAD（Additional Authenticated Data）绑定 itemId，防止密文替换攻击。服务器仅存储密文。',
    badge: { text: 'AES-256-GCM', color: 'green' },
    output: {
      command: 'passbox encrypt --item login',
      result: 'ciphertext stored · server sees only 12B IV + 16B tag + ct',
      status: 'ok',
    },
    code: {
      label: 'crypto / aes.ts',
      snippet: [
        'const encrypted = await encrypt(',
        '  symmetricKey,',
        '  JSON.stringify(itemData),',
        '  `item:${itemId}:data`  // AAD',
        ');',
      ].join('\n'),
    },
  },
  {
    number: '04',
    icon: ShieldCheck,
    title: 'SRP-6a 零传输验证',
    description:
      '登录时使用 SRP-6a 协议，服务端仅持有 verifier。主密码在客户端完成零知识证明，服务端无法反推主密码。',
    badge: { text: 'Zero-Knowledge', color: 'pink' },
    output: {
      command: 'passbox auth --login user@example.com',
      result: 'verified · password never transmitted · verifier-only',
      status: 'ok',
    },
    code: {
      label: 'auth / srp.ts',
      snippet: [
        '// 客户端：发送证明 M1，不发送主密码',
        'const M1 = srp.client.proof(',
        '  email, password, salt, B',
        ');',
        '// 服务端：验证 M1，无需知道主密码',
        'const valid = srp.server.verify(',
        '  verifier, A, M1',
        ');',
      ].join('\n'),
    },
  },
];

export function LandingHowItWorks() {
  return (
    <section className="relative overflow-hidden border-t border-border bg-secondary/40 py-24 sm:py-32">
      <div className="dot-bg absolute inset-0 opacity-50" aria-hidden />

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        {/* 区块标题 */}
        <div className="mb-20 max-w-2xl">
          <span className="tech-tag">
            <span className="code-brand font-mono">06</span>
            加密流程
          </span>
          <h2 className="mt-4 text-4xl font-semibold tracking-tighter sm:text-5xl">
            四步走完
            <span className="mesh-text"> 零知识 </span>
            加密链路.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            从主密码到服务端验证，每一步都有可验证的密码学保证。这里没有黑盒。
          </p>
        </div>

        {/* 步骤列表 — 左右交错布局 */}
        <div className="flex flex-col gap-16">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isReversed = idx % 2 === 1;
            return (
              <div
                key={step.number}
                className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center"
              >
                {/* 文案侧 */}
                <div className={isReversed ? 'lg:order-2' : ''}>
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-background shadow-stack-2">
                      <Icon className="h-5 w-5 text-foreground" />
                    </div>
                    <span className="text-5xl font-semibold text-muted-foreground/30 tracking-tighter">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>

                {/* 代码窗口 */}
                <div className={isReversed ? 'lg:order-1' : ''}>
                  <LandingTerminal
                    label={step.code.label}
                    code={step.code.snippet}
                    badge={step.badge}
                    output={step.output}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部安全保证条 */}
        <div className="mt-20 flex flex-col items-center gap-4 border-t border-border pt-12 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            密码学保证
          </p>
          <p className="max-w-2xl text-xl text-foreground sm:text-2xl tracking-tight">
            即使数据库完整泄露，攻击者也无法还原任何一条明文密码.
          </p>
          <p className="max-w-md text-xs text-muted-foreground">
            服务端仅存储：Argon2id salt、SRP verifier、加密后的条目密文。
            三者缺一不可解密，且任何一项都无法单独反推主密码。
          </p>
        </div>
      </div>
    </section>
  );
}
