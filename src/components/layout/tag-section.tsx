/**
 * 侧边栏标签区块
 *
 * 替代旧版纯筛选胶囊列表，集成了创建/重命名/删除管理功能。
 * - 标题旁「+」按钮：快速创建标签
 * - 每项右侧「⋯」菜单：重命名 / 删除
 * - 点击标签名：跳转筛选（保持原行为）
 *
 * 标签明文存储，无需加解密。删除时 item_tags ON DELETE CASCADE 级联清理。
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Tag, Plus, MoreHorizontal, Pencil, Trash2, Hash, ChevronRight } from 'lucide-react';
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
import { deleteTag } from '@/actions/tag';
import { TagFormDialog } from './tag-form-dialog';
import type { DecryptedTag } from '@/types/vault';

interface TagSectionProps {
  /** 移动端点击导航后关闭侧边栏 */
  onNavigate?: () => void;
}

export function TagSection({ onNavigate }: TagSectionProps) {
  const { tags, removeTag } = useVaultStore();
  const searchParams = useSearchParams();
  const activeTagId = searchParams.get('tagId');

  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DecryptedTag | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DecryptedTag | null>(null);
  const [deleting, setDeleting] = useState(false);

  // UX-023：折叠状态持久化到 localStorage（客户端惰性初始化，避免 SSR 水合不一致）
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('passbox:sidebar:tag-collapsed') === '1';
  });
  const toggleCollapse = () => {
    setCollapsed((prev) => {
      localStorage.setItem('passbox:sidebar:tag-collapsed', prev ? '0' : '1');
      return !prev;
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteTag(deleteTarget.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      removeTag(deleteTarget.id);
      toast.success('标签已删除');
      setDeleteTarget(null);
    } catch {
      toast.error('删除失败，请稍后重试');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="border-t border-border px-3 py-2">
        <div className="mb-1 flex items-center justify-between px-2 text-xs font-medium text-muted-foreground">
          <button
            type="button"
            onClick={toggleCollapse}
            className="flex items-center gap-2 rounded hover:text-foreground"
            aria-label={collapsed ? '展开标签' : '折叠标签'}
            aria-expanded={!collapsed}
          >
            <ChevronRight className={cn('h-3 w-3 transition-transform', !collapsed && 'rotate-90')} />
            <Tag className="h-3 w-3" />
            标签
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded p-0.5 hover:bg-muted hover:text-foreground"
            aria-label="新建标签"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {!collapsed && (
          <>
            {tags.length === 0 ? (
              <p className="px-3 py-1 text-xs text-muted-foreground/70">暂无标签</p>
            ) : (
              <div className="space-y-0.5">
                {tags.map((tag) => (
                  <div key={tag.id} className="group flex items-center">
                    <Link
                      href={`/vault?tagId=${tag.id}`}
                      onClick={onNavigate}
                      className={cn(
                        'flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                        activeTagId === tag.id
                          ? 'bg-primary/10 text-foreground border-l-2 border-l-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <Hash className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{tag.name}</span>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="ml-1 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                          aria-label={`标签「${tag.name}」操作`}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={() => setRenameTarget(tag)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          重命名
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteTarget(tag)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 创建弹窗 */}
      <TagFormDialog open={createOpen} onOpenChange={setCreateOpen} mode="create" />

      {/* 重命名弹窗 */}
      <TagFormDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        mode="rename"
        tag={renameTarget ?? undefined}
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
            <DialogTitle>删除标签</DialogTitle>
            <DialogDescription>
              确定要删除标签「{deleteTarget?.name}」吗？
              <br />
              关联此标签的条目将自动移除该标签关联，条目本身不会被删除。
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
