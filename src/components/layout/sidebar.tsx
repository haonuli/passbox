/**
 * 应用侧边栏 (T4.3 / T6.4 / T6.5)
 *
 * 导航入口：密码库、安全中心、密码生成器、设置。
 * T6.4: 标签列表，点击筛选对应条目
 * T6.5: 保险库列表，点击切换当前查看的库
 * 桌面端常驻左侧，移动端可折叠。
 */
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Vault, Shield, KeyRound, Settings, Tag, FolderOpen, Bookmark, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVaultStore } from '@/stores/vault-store';
import { useSavedSearchStore } from '@/stores/saved-search-store';
import { getExpiryCount } from '@/lib/security/expiry-check';

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
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const vaults = useVaultStore((s) => s.vaults);
  const tags = useVaultStore((s) => s.tags);
  const items = useVaultStore((s) => s.items);
  const setSearchQuery = useVaultStore((s) => s.setSearchQuery);
  const searches = useSavedSearchStore((s) => s.searches);
  const removeSearch = useSavedSearchStore((s) => s.removeSearch);
  const expiryCount = getExpiryCount(items);

  return (
    <>
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
          <span className="text-base font-semibold tracking-tight">PassBox</span>
        </div>

        {/* 导航 */}
        <nav className="space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const showExpiryBadge = item.href === '/security' && expiryCount > 0;
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
                {showExpiryBadge && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                    {expiryCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* 保险库列表 (T6.5) */}
        {vaults.length > 0 && (
          <div className="border-t border-border px-3 py-2">
            <div className="mb-1 flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
              <FolderOpen className="h-3 w-3" />
              保险库
            </div>
            <div className="space-y-0.5">
              {vaults.map((vault) => (
                <Link
                  key={vault.id}
                  href={`/vault?vaultId=${vault.id}`}
                  onClick={onClose}
                  className="block truncate rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {vault.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 标签列表 (T6.4) */}
        {tags.length > 0 && (
          <div className="border-t border-border px-3 py-2">
            <div className="mb-1 flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
              <Tag className="h-3 w-3" />
              标签
            </div>
            <div className="flex flex-wrap gap-1 px-1">
              {tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/vault?tagId=${tag.id}`}
                  onClick={onClose}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 智能文件夹 */}
        {searches.length > 0 && (
          <div className="border-t border-border px-3 py-2">
            <div className="mb-1 flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
              <Bookmark className="h-3 w-3" />
              智能文件夹
            </div>
            <div className="space-y-0.5">
              {searches.map((search) => (
                <div key={search.id} className="group flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery(search.query);
                      router.push('/vault');
                      onClose();
                    }}
                    className="flex-1 truncate rounded-md px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {search.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSearch(search.id)}
                    className="ml-1 hidden rounded p-1 text-muted-foreground hover:text-foreground group-hover:block"
                    aria-label="删除"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1" />
      </aside>
    </>
  );
}
