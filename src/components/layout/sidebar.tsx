/**
 * 应用侧边栏 (T4.3)
 *
 * 导航入口：密码库、安全中心、密码生成器、设置。
 * 桌面端常驻左侧，移动端可折叠（通过 Props 控制开关）。
 */
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Vault, Shield, KeyRound, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: typeof Vault;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/vault', label: '密码库', icon: Vault },
  { href: '/security', label: '安全中心', icon: Shield },
  { href: '/generator', label: '密码生成器', icon: KeyRound },
  { href: '/settings', label: '设置', icon: Settings },
];

interface SidebarProps {
  /** 移动端是否展开 */
  mobileOpen: boolean;
  /** 关闭移动端侧边栏 */
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* 移动端遮罩 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-border bg-background transition-transform md:static md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* 品牌标识 */}
        <div className="flex h-14 items-center border-b border-border px-6">
          <span className="text-base font-semibold tracking-tight">passbox</span>
        </div>

        {/* 导航 */}
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
