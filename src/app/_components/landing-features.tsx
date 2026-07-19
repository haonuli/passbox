/**
 * 落地页功能区 — 对齐 DESIGN.md
 * - 分组标题 Geist Sans + 负字距，eyebrow 用 caption-mono
 * - 特性卡片 marketing-card 8px 圆角 + Level 3 堆叠阴影
 * - highlight 标记改为 ink 主色徽章（不再使用翡翠绿）
 */
import {
  KeyRound,
  Puzzle,
  Smartphone,
  ShieldCheck,
  Plane,
  Trash2,
  Paperclip,
  Lock,
  Eye,
  Search,
  ListChecks,
  CreditCard,
  KeySquare,
  Timer,
  RotateCcw,
  Gauge,
  LogOut,
} from 'lucide-react';

interface FeatureGroup {
  id: string;
  tag: string;
  icon: typeof KeyRound;
  title: string;
  description: string;
  features: Feature[];
}

interface Feature {
  icon: typeof KeyRound;
  title: string;
  description: string;
  highlight?: boolean;
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: 'password-management',
    tag: '02',
    icon: KeyRound,
    title: '密码管理',
    description: '覆盖全部密码管理场景，17 种条目类型满足个人与工作所需',
    features: [
      {
        icon: KeySquare,
        title: '17 种条目类型',
        description: '登录、信用卡、身份、银行账户、API 密钥、SSH 密钥、加密钱包等，一站式管理。',
        highlight: true,
      },
      {
        icon: Search,
        title: '智能本地搜索',
        description: '搜索完全在客户端进行，不上传关键词，支持模糊匹配与标签筛选。',
      },
      {
        icon: ListChecks,
        title: '批量管理',
        description: '支持批量删除、批量移动到其他保险库，多选操作流畅高效。',
      },
      {
        icon: Eye,
        title: '按需解密',
        description: '敏感数据仅在查看时解密，离开详情页立即清除内存中的明文。',
        highlight: true,
      },
    ],
  },
  {
    id: 'browser-extension',
    tag: '03',
    icon: Puzzle,
    title: '浏览器扩展',
    description: 'Chrome / Edge 扩展自动识别表单，一键填充凭证',
    features: [
      {
        icon: Puzzle,
        title: '智能表单填充',
        description: '基于 autocomplete 属性与 name/id 模式匹配，自动识别登录、地址、信用卡表单。',
        highlight: true,
      },
      {
        icon: CreditCard,
        title: '信用卡与地址',
        description: '不仅填充密码，还支持自动填充信用卡号、有效期、CVV 与个人地址信息。',
      },
      {
        icon: Smartphone,
        title: '用户确认机制',
        description: '每次自动填充前弹出确认浮窗，避免误填充与恶意页面窃取。',
        highlight: true,
      },
    ],
  },
  {
    id: 'security',
    tag: '04',
    icon: ShieldCheck,
    title: '安全增强',
    description: '多层防御纵深，从协议层到应用层全方位保护账户',
    features: [
      {
        icon: Timer,
        title: 'TOTP 双因素认证',
        description: '内置 RFC 6238 TOTP 生成器，支持 SHA-1/256/512 算法，提供 10 个一次性备用码。',
        highlight: true,
      },
      {
        icon: RotateCcw,
        title: '恢复码机制',
        description: '80 位熵的恢复码，忘记主密码也能安全重置，密码库数据完整保留。',
      },
      {
        icon: Gauge,
        title: '速率限制',
        description: 'IP + email 双维度限流（登录 10/min，注册 5/min），防暴力破解与撞库。',
        highlight: true,
      },
      {
        icon: LogOut,
        title: '会话撤销',
        description: '24h 有效期 + token_version 机制，改密或登出后旧 JWT 立即失效。',
      },
    ],
  },
  {
    id: 'advanced',
    tag: '05',
    icon: Plane,
    title: '高级功能',
    description: '为特殊场景设计的细节能力',
    features: [
      {
        icon: Plane,
        title: '旅行模式',
        description: '出国时仅携带旅行保险库，敏感数据完全从本地清除，过海关无忧。',
        highlight: true,
      },
      {
        icon: Trash2,
        title: '回收站 30 天',
        description: '删除的条目进入回收站，30 天内可恢复，过期自动永久清除。',
      },
      {
        icon: Paperclip,
        title: '加密附件',
        description: '支持上传文件附件，附件内容客户端加密后上传，服务端无法读取。',
      },
      {
        icon: Lock,
        title: '分享链接',
        description: '生成加密分享链接，支持过期时间与查看次数限制，安全共享密码。',
      },
    ],
  },
];

export function LandingFeatures() {
  return (
    <section className="relative border-t border-border py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        {/* 区块总标题 */}
        <div className="mb-20 max-w-2xl">
          <span className="tech-tag">
            <span className="code-brand font-mono">02-05</span>
            功能矩阵
          </span>
          <h2 className="mt-4 text-4xl font-semibold tracking-tighter sm:text-5xl">
            不只是密码管理器
            <br />
            <span className="text-muted-foreground">
              是一套完整的密码学工具箱.
            </span>
          </h2>
        </div>

        {/* 按场景分组渲染 */}
        <div className="flex flex-col gap-24">
          {FEATURE_GROUPS.map((group) => {
            const GroupIcon = group.icon;
            return (
              <div key={group.id} id={group.id} className="scroll-mt-24">
                {/* 分组标题 — 左侧 ink 主色竖线指示器 */}
                <div className="mb-10 flex items-start gap-4 border-l-2 border-foreground pl-6">
                  <div className="flex -ml-[1.625rem] mt-1 h-10 w-10 items-center justify-center rounded-md border border-border bg-background shadow-stack-2">
                    <GroupIcon className="h-5 w-5 text-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        {'// '}{group.tag}
                      </span>
                      <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                        {group.title}
                      </h3>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{group.description}</p>
                  </div>
                </div>

                {/* 分组特性卡片 — marketing-card */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {group.features.map((feature) => {
                    const Icon = feature.icon;
                    return (
                      <div
                        key={feature.title}
                        className={`marketing-card relative flex flex-col gap-3 p-5 ${
                          feature.highlight ? 'bg-secondary/40' : ''
                        }`}
                      >
                        {feature.highlight && (
                          <span className="absolute -top-2 right-3 rounded-xs bg-primary px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary-foreground">
                            HIGHLIGHT
                          </span>
                        )}
                        <Icon className="h-5 w-5 text-foreground" />
                        <h4 className="text-sm font-semibold">{feature.title}</h4>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部统计条 — 不使用 Fraunces，用 Geist 600 + 负字距 */}
        <div className="mt-24 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border lg:grid-cols-4">
          {[
            { value: '17', label: '条目类型', sub: '覆盖全部场景' },
            { value: '80', label: '位恢复码熵', sub: '银行级强度' },
            { value: '24h', label: '会话有效期', sub: '强制重认证' },
            { value: '0', label: '主密码上传', sub: 'SRP 保证' },
          ].map((stat) => (
            <div key={stat.label} className="bg-background p-6 text-center">
              <div className="text-4xl font-semibold tracking-tighter sm:text-5xl">
                {stat.value}
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">{stat.label}</div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">{stat.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
