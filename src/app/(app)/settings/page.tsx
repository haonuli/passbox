/**
 * 设置页 (T6.1)
 *
 * 设置入口列表，链接到各子设置页。
 */
import Link from 'next/link';
import { Shield, Bell, Palette, Database } from 'lucide-react';

const SETTINGS_ITEMS = [
  { href: '/settings/security', label: '安全设置', description: '两步验证（2FA）、账户安全', icon: Shield },
  { href: '/settings/preferences', label: '偏好设置', description: '剪贴板清除时间、主题', icon: Palette },
  { href: '/settings/notifications', label: '通知', description: '通知偏好', icon: Bell },
  { href: '/settings/data', label: '数据管理', description: '导入导出、备份', icon: Database },
];

export default function SettingsPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h1 className="text-base font-semibold">设置</h1>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-2xl space-y-2">
          {SETTINGS_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-md border border-border p-3 transition-colors hover:bg-muted/50"
              >
                <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.description}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
