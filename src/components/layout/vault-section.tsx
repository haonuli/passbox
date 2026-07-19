/**
 * 侧边栏保险库区块
 *
 * 替代旧版纯筛选列表，集成了创建/重命名/删除管理功能。
 * - 标题旁「+」按钮：快速创建保险库
 * - 每项右侧「⋯」菜单：重命名 / 删除（仅空库可删）
 * - 点击保险库名：跳转筛选（保持原行为）
 *
 * 零知识：名称在客户端加密后提交（AAD='passbox:vault-name:v1'）。
 */
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FolderOpen, Plus, MoreHorizontal, Pencil, Trash2, Vault as VaultIcon, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useVaultStore } from '@/stores/vault-store';
import { deleteVault } from '@/actions/vault';
import { VaultFormDialog } from './vault-form-dialog';
import type { DecryptedVault } from '@/types/vault';

interface VaultSectionProps {
  /** 移动端点击导航后关闭侧边栏 */
  onNavigate?: () => void;
}

export function VaultSection({ onNavigate }: VaultSectionProps) {
  const { vaults, items, removeVault } = useVaultStore();
  const searchParams = useSearchParams();
  const activeVaultId = searchParams.get('vaultId');

  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DecryptedVault | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DecryptedVault | null>(null);
  const [deleting, setDeleting] = useState(false);

  // UX-023：折叠状态持久化到 localStorage（客户端惰性初始化，避免 SSR 水合不一致）
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('passbox:sidebar:vault-collapsed') === '1';
  });
  const toggleCollapse = () => {
    setCollapsed((prev) => {
      localStorage.setItem('passbox:sidebar:vault-collapsed', prev ? '0' : '1');
      return !prev;
    });
  };

  // 每个保险库的条目数
  const itemCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.vaultId, (map.get(item.vaultId) ?? 0) + 1);
    }
    return map;
  }, [items]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteVault(deleteTarget.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      removeVault(deleteTarget.id);
      toast.success('保险库已删除');
      setDeleteTarget(null);
    } catch {
      toast.error('删除失败，请稍后重试');
    } finally {
      setDeleting(false);
    }
  };

  if (vaults.length === 0) {
    // 即使没有保险库，也显示「+ 新建」入口
    return (
      <>
        <div className="border-t border-border px-3 py-2">
          <div className="flex items-center justify-between px-2 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-2">
              <FolderOpen className="h-3 w-3" />
              保险库
            </span>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded p-0.5 hover:bg-muted hover:text-foreground"
              aria-label="新建保险库"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <VaultFormDialog open={createOpen} onOpenChange={setCreateOpen} mode="create" />
      </>
    );
  }

  return (
    <>
      <div className="border-t border-border px-3 py-2">
        <div className="mb-1 flex items-center justify-between px-2 text-xs font-medium text-muted-foreground">
          <button
            type="button"
            onClick={toggleCollapse}
            className="flex items-center gap-2 rounded hover:text-foreground"
            aria-label={collapsed ? '展开保险库' : '折叠保险库'}
            aria-expanded={!collapsed}
          >
            <ChevronRight className={cn('h-3 w-3 transition-transform', !collapsed && 'rotate-90')} />
            <FolderOpen className="h-3 w-3" />
            保险库
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded p-0.5 hover:bg-muted hover:text-foreground"
            aria-label="新建保险库"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {!collapsed && (
          <div className="space-y-0.5">
            {vaults.map((vault) => {
              const count = itemCountMap.get(vault.id) ?? 0;
              return (
                <div key={vault.id} className="group flex items-center">
                  <Link
                    href={`/vault?vaultId=${vault.id}`}
                    onClick={onNavigate}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                      activeVaultId === vault.id
                        ? 'bg-primary/10 text-foreground border-l-2 border-l-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <VaultIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{vault.name}</span>
                    {count > 0 && (
                      <span className="ml-auto text-xs opacity-60">{count}</span>
                    )}
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="ml-1 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                        aria-label={`保险库「${vault.name}」操作`}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onClick={() => setRenameTarget(vault)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        重命名
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteTarget(vault)}
                        disabled={count > 0}
                        className={count > 0 ? 'opacity-50' : 'text-destructive focus:text-destructive'}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        删除
                        {count > 0 && <span className="ml-auto text-xs">非空</span>}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 创建弹窗 */}
      <VaultFormDialog open={createOpen} onOpenChange={setCreateOpen} mode="create" />

      {/* 重命名弹窗 */}
      <VaultFormDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        mode="rename"
        vault={renameTarget ?? undefined}
      />

      {/* 删除确认弹窗 */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除保险库</DialogTitle>
            <DialogDescription>
              确定要删除保险库「{deleteTarget?.name}」吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
