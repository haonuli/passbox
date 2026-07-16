/**
 * 认证页面左侧品牌展示面板
 *
 * 在登录/注册/恢复页面中作为左侧品牌区域，
 * 展示产品标识、核心价值主张和安全特性。
 */
import { Shield, Lock, EyeOff } from 'lucide-react';

interface SecurityFeature {
  icon: typeof Shield;
  title: string;
  description: string;
}

const SECURITY_FEATURES: SecurityFeature[] = [
  {
    icon: EyeOff,
    title: '零知识加密',
    description: '您的主密码永远不会上传服务器，只有您能解密自己的数据',
  },
  {
    icon: Lock,
    title: '端到端加密',
    description: '采用 Argon2id 密钥派生 + AES-256-GCM 加密，银行级安全',
  },
  {
    icon: Shield,
    title: '多重防护',
    description: '支持双因素认证、恢复码机制，全方位保障账户安全',
  },
];

export function AuthBrandPanel() {
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground">
      {/* 装饰性渐变背景 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.1) 0%, transparent 50%)',
        }}
      />

      {/* 顶部品牌标识 */}
      <div className="relative z-10">
        <h1 className="text-2xl font-bold tracking-tight">PassBox</h1>
        <p className="mt-1 text-sm text-primary-foreground/70">
          零知识密码管理器
        </p>
      </div>

      {/* 中间价值主张 */}
      <div className="relative z-10 max-w-sm">
        <h2 className="text-3xl font-bold leading-tight tracking-tight">
          您的密码，
          <br />
          只有您能解开
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-primary-foreground/80">
          端到端加密的密码管理器，您的数据在离开设备前就已加密。
          即使是我们的服务器，也无法读取您的任何密码。
        </p>
      </div>

      {/* 底部安全特性列表 */}
      <div className="relative z-10 space-y-5">
        {SECURITY_FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <div key={feature.title} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium">{feature.title}</div>
                <div className="mt-0.5 text-xs leading-relaxed text-primary-foreground/70">
                  {feature.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
