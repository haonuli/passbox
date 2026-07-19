/**
 * 批量操作栏
 *
 * 多选模式下显示在条目列表顶部，提供：
 * - 全选 / 取消全选
 * - 已选数量提示
 * - 批量移动到保险库
 * - 批量删除（带二次确认）
 * - 退出多选
 */
'use client';

import { useState } from 'react';
import { Trash2, FolderInput, X, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useVaultStore } from '@/stores/vault-store';
import { batchDeleteItems, batchMoveItems } from '@/actions/batch-item';

interface BatchActionBarProps {
  /** 已勾选的条目 ID */
  selectedIds: Set<string>;
  /** 当前列表中可见的条目 ID（用于全选） */
  visibleIds: string[];
  /** 全选 / 取消全选当前可见条目 */
  onSelectAll: () => void;
  /** 退出多选模式 */
  onExit: () => void;
}

export function BatchActionBar({
  selectedIds,
  visibleIds,
  onSelectAll,
  onExit,
}: BatchActionBarProps) {
  const { vaults, removeItems, updateItemsVault } = useVaultStore();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [targetVaultId, setTargetVaultId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const handleDelete = async () => {
    setSubmitting(true);
    try {
      const ids = Array.from(selectedIds);
      const result = await batchDeleteItems(ids);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      removeItems(ids);
      toast.success(`已删除 ${result.data.deleted} 项`);
      setDeleteOpen(false);
      onExit();
    } catch {
      toast.error('删除失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMove = async () => {
    if (!targetVaultId) {
      toast.error('请选择目标保险库');
      return;
    }
    setSubmitting(true);
    try {
      const ids = Array.from(selectedIds);
      const result = await batchMoveItems(ids, targetVaultId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      updateItemsVault(ids, targetVaultId);
      toast.success(`已移动 ${result.data.moved} 项`);
      setMoveOpen(false);
      onExit();
    } catch {
      toast.error('移动失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const openMoveDialog = () => {
    // 默认选中第一个非当前选中条目所在的保险库
    setTargetVaultId(vaults[0]?.id ?? '');
    setMoveOpen(true);
  };

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={onExit}
          disabled={submitting}
          className="h-7 px-2"
          aria-label="退出多选"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onSelectAll}
          disabled={submitting || visibleIds.length === 0}
          className="h-7 px-2 text-xs"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          {allVisibleSelected ? '取消全选' : '全选'}
        </Button>
        <span className="text-xs text-muted-foreground">
          已选 {selectedCount} 项
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={openMoveDialog}
            disabled={selectedCount === 0 || submitting || vaults.length < 2}
            className="h-7 px-2 text-xs"
          >
            <FolderInput className="h-3.5 w-3.5" />
            {selectedCount > 0 ? `移动 (${selectedCount})` : '移动'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDeleteOpen(true)}
            disabled={selectedCount === 0 || submitting}
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {selectedCount > 0 ? `删除 (${selectedCount})` : '删除'}
          </Button>
        </div>
      </div>

      {/* 删除确认 */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!submitting) setDeleteOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量删除条目</DialogTitle>
            <DialogDescription>
              确定要删除选中的 {selectedCount} 个条目吗？条目将移入回收站，30 天内可在回收站恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting ? `正在删除 ${selectedCount} 项…` : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 移动到保险库 */}
      <Dialog
        open={moveOpen}
        onOpenChange={(open) => {
          if (!submitting) setMoveOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>移动到保险库</DialogTitle>
            <DialogDescription>
              将选中的 {selectedCount} 个条目移动到以下保险库：
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            {vaults.map((v) => (
              <label
                key={v.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <input
                  type="radio"
                  name="target-vault"
                  value={v.id}
                  checked={targetVaultId === v.id}
                  onChange={(e) => setTargetVaultId(e.target.value)}
                  className="h-3.5 w-3.5"
                />
                <span>{v.name}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMoveOpen(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button onClick={handleMove} disabled={submitting || !targetVaultId}>
              {submitting ? `正在移动 ${selectedCount} 项…` : '移动'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
