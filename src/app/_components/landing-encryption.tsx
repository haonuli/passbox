/**
 * 落地页加密参数展示区 — 对齐 DESIGN.md
 * - 终端窗口使用 .terminal-mockup
 * - 区块标题 Geist Sans + 负字距 + 句末句号
 * - eyebrow 使用 .tech-tag (caption-mono)
 * - 参数卡片使用 .marketing-card
 */
import { Lock, KeyRound, ShieldCheck, EyeOff } from 'lucide-react';
import { LandingTerminal } from './landing-terminal';

interface CryptoShowcase {
  icon: typeof Lock;
  label: string;
  value: string;
  caption: string;
}

const CRYPTO_PARAMS: CryptoShowcase[] = [
  {
    icon: Lock,
    label: '对称加密',
    value: 'AES-256-GCM',
    caption: '认证加密 · 12 字节 IV · 16 字节认证标签',
  },
  {
    icon: KeyRound,
    label: '密钥派生',
    value: 'Argon2id',
    caption: '64MiB 内存 · 3 次迭代 · parallelism 4',
  },
  {
    icon: ShieldCheck,
    label: '认证协议',
    value: 'SRP-6a',
    caption: '主密码零传输 · 仅服务端验证',
  },
  {
    icon: EyeOff,
    label: '密文保护',
    value: 'AAD Bound',
    caption: 'item:{id}:data · 防密文替换攻击',
  },
];

/** 终端 1：客户端加密代码片段 */
const CLIENT_ENCRYPT_CODE = `// 客户端 AES-256-GCM 加密
async function encrypt(
  key: CryptoKey,
  plaintext: string,
  aad: string,
): Promise<EncryptedData> {
  const iv = getRandomBytes(12);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad },
    key,
    plaintext,
  );
  return { v: 1, iv, ct };
}`;

/** 终端 2：SRP 协议代码片段 */
const SRP_VERIFY_CODE = `// SRP-6a 零知识密码验证
// 服务端仅持有 verifier，不持有主密码
async function verifyLogin(
  email: string,
  clientProof: string,
) {
  // 查找用户 verifier（非主密码）
  const user = await db.query(
    'SELECT verifier FROM users WHERE email=$1',
    [email],
  );
  // 服务端验证 M2，主密码从未传输
  const valid = srp.verifyM2(
    verifier,
    clientProof,
  );
  return valid;
}`;

export function LandingEncryption() {
  return (
    <section className="relative border-t border-border py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        {/* 区块标题 */}
        <div className="mb-16 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="tech-tag">
              <span className="code-brand font-mono">01</span>
              加密参数
            </span>
            <h2 className="mt-4 text-4xl font-semibold tracking-tighter sm:text-5xl">
              每一个字节
              <br />
              <span className="text-muted-foreground">都经过密码学保护.</span>
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            采用业界最严格的加密栈，从主密码派生到数据存储，全链路零知识。
            这里没有花哨的营销词，只有可验证的密码学参数。
          </p>
        </div>

        {/* 参数网格 — marketing-card */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border lg:grid-cols-4">
          {CRYPTO_PARAMS.map((param) => {
            const Icon = param.icon;
            return (
              <div
                key={param.label}
                className="marketing-card flex flex-col gap-3 bg-background p-6 rounded-none border-0"
                style={{ boxShadow: 'none' }}
              >
                <Icon className="h-5 w-5 text-foreground" />
                <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  {param.label}
                </div>
                <div className="font-mono text-lg font-semibold text-foreground">
                  {param.value}
                </div>
                <div className="font-mono text-xs leading-relaxed text-muted-foreground">
                  {param.caption}
                </div>
              </div>
            );
          })}
        </div>

        {/* 终端窗口 — 真实加密代码片段 */}
        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <LandingTerminal
            label="client / encrypt.ts"
            code={CLIENT_ENCRYPT_CODE}
            badge={{ text: 'AES-256-GCM', color: 'green' }}
            output={{
              command: 'passbox encrypt --item login',
              result: 'encrypted in 12ms · 12B IV · 16B tag · AAD bound',
              status: 'ok',
            }}
          />
          <LandingTerminal
            label="auth / srp-verify.ts"
            code={SRP_VERIFY_CODE}
            badge={{ text: 'SRP-6a', color: 'blue' }}
            output={{
              command: 'passbox auth --login user@example.com',
              result: 'verified · password never transmitted to server',
              status: 'ok',
            }}
          />
        </div>
      </div>
    </section>
  );
}
