/**
 * 落地页技术规格表区 — 对齐 DESIGN.md
 * - 区块标题 Geist Sans + 负字距
 * - 规格表使用 .spec-row + caption-mono 标题
 * - 底部三项保证卡片 marketing-card，ink 主色图标（不再用翡翠绿）
 */
import { Cpu, Database, Globe, Lock, Clock, Server } from 'lucide-react';

interface SpecGroup {
  icon: typeof Cpu;
  title: string;
  specs: Spec[];
}

interface Spec {
  label: string;
  value: string;
  note?: string;
}

const SPEC_GROUPS: SpecGroup[] = [
  {
    icon: Lock,
    title: '加密参数',
    specs: [
      { label: '对称加密', value: 'AES-256-GCM', note: '认证加密 · NIST SP 800-38D' },
      { label: '密钥派生', value: 'Argon2id', note: 'RFC 9106 · 抗 GPU/ASIC 攻击' },
      { label: 'KDF 参数', value: '64MiB / 3 iter / P=4', note: 'memory / iterations / parallelism' },
      { label: 'HKDF', value: 'SHA-256', note: 'RFC 5869 · 三派生密钥' },
      { label: 'AAD 绑定', value: 'item:{id}:{field}', note: '防密文替换攻击' },
      { label: 'IV 长度', value: '12 bytes', note: 'GCM 标准 nonce 长度' },
    ],
  },
  {
    icon: Server,
    title: '认证协议',
    specs: [
      { label: '登录协议', value: 'SRP-6a', note: 'RFC 5054 · 主密码零传输' },
      { label: '会话 token', value: 'JWT + HS256', note: 'jose 库 · 24h 有效期' },
      { label: '会话撤销', value: 'token_version', note: '改密 / 登出后立即失效' },
      { label: '速率限制', value: 'IP + email 双维度', note: '登录 10/min · 注册 5/min' },
      { label: '账户锁定', value: '5 次失败 / 15 min', note: '数据库层防护' },
      { label: '2FA 算法', value: 'TOTP RFC 6238', note: 'SHA-1 / 256 / 512 可选' },
    ],
  },
  {
    icon: Database,
    title: '数据存储',
    specs: [
      { label: '数据库', value: 'PostgreSQL', note: '连接池 · max 10' },
      { label: '存储内容', value: '密文 + salt + verifier', note: '零明文' },
      { label: '软删除', value: '30 天保留', note: '过期自动清理' },
      { label: '附件加密', value: '客户端 AES-256-GCM', note: '服务端不可读' },
      { label: '分享链接', value: '加密 + 过期 + 次数限制', note: '一次性查看' },
      { label: '旅行模式', value: '本地清除', note: '仅保留旅行保险库' },
    ],
  },
  {
    icon: Globe,
    title: '运行环境',
    specs: [
      { label: '前端框架', value: 'Next.js 14+ App Router', note: 'Server / Client Component' },
      { label: '类型系统', value: 'TypeScript strict', note: '0 any · 0 errors' },
      { label: 'UI 组件', value: 'shadcn/ui + Tailwind v3', note: '一致性设计系统' },
      { label: '状态管理', value: 'Zustand', note: '按需解密 API' },
      { label: '浏览器扩展', value: 'Manifest V3', note: 'Chrome / Edge 兼容' },
      { label: 'PWA', value: 'Service Worker', note: '离线支持' },
    ],
  },
];

export function LandingSpecs() {
  return (
    <section className="relative border-t border-border py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        {/* 区块标题 */}
        <div className="mb-16 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="tech-tag">
              <span className="code-brand font-mono">07</span>
              技术规格
            </span>
            <h2 className="mt-4 text-4xl font-semibold tracking-tighter sm:text-5xl">
              可验证的
              <span className="text-muted-foreground"> 技术参数.</span>
            </h2>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            所有参数均为真实生产配置，可在源代码中验证。
            没有营销话术，只有密码学事实。
          </p>
        </div>

        {/* 规格表网格 */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          {SPEC_GROUPS.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.title}>
                {/* 分组标题 — caption-mono */}
                <div className="mb-4 flex items-center gap-3 border-b border-border pb-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground">
                    {group.title}
                  </h3>
                </div>
                {/* 规格行 */}
                <div>
                  {group.specs.map((spec) => (
                    <div key={spec.label} className="spec-row">
                      <div className="text-sm text-muted-foreground">{spec.label}</div>
                      <div>
                        <div className="font-mono text-sm font-medium text-foreground">
                          {spec.value}
                        </div>
                        {spec.note && (
                          <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                            {spec.note}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部三项保证 — marketing-card，ink 图标 */}
        <div className="mt-20 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: Lock, title: '零明文存储', desc: '数据库中不存在任何明文密码或主密码哈希' },
            { icon: Clock, title: '会话时效', desc: '所有 JWT 24 小时强制过期，无法续期' },
            { icon: Cpu, title: '客户端运算', desc: '所有加密/解密在浏览器完成，服务端零运算' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="marketing-card flex items-start gap-3 p-5"
              >
                <Icon className="h-5 w-5 shrink-0 text-foreground" />
                <div>
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{item.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
