/**
 * 回收站视图组件 (D-11)
 *
 * 客户端组件，负责：
 *   - 拉取回收站条目（listTrashItems，密文）
 *   - 用 Symmetric Key 解密标题展示
 *   - 恢复单条 / 彻底删除单条 / 清空全部
 *   - 自动触发 lazy purge 清理超过 30 天的条目（由后端完成）
 *
 * 残留天数计算：30 - floor((NOW - deletedAt) / 1d)
 */
'use client';

import { useEffect, useState } from 'react';
import { Loader2, Lock, RotateCcw, Trash2 } from 'lucide-react';
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
import { decrypt } from '@/lib/crypto/aes';
import type { EncryptedData } from '@/types/crypto';
import { getItemTypeConfig } from '@/lib/item-types';
import { useAuthStore } from '@/stores/auth-store';
import {
  listTrashItems,
  restoreItem,
  purgeItem,
  purgeAllItems,
} from '@/actions/trash';
import { TRASH_RETENTION_DAYS } from '@/lib/trash';
import type { ItemRow } from '@/types/db';
import { cn } from '@/lib/utils';

/** 单条已解密的回收站条目（仅展示用） */
interface TrashItem {
  id: string;
  itemTypeId: number;
  title: string;
  deletedAt: string;
  /** 剩余天数（0 = 即将清理） */
  remainingDays: number;
}

/** 解析 EncryptedData JSON */
function parseEncrypted(raw: string): EncryptedData {
  return JSON.parse(raw) as EncryptedData;
}

/** 计算剩余保留天数 */
function calcRemainingDays(deletedAt: string): number {
  const deletedMs = new Date(deletedAt).getTime();
  const nowMs = Date.now();
  const elapsedDays = Math.floor((nowMs - deletedMs) / 86_400_000);
  return Math.max(0, TRASH_RETENTION_DAYS - elapsedDays);
}

/** 格式化日期 */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 行内类型图标 */
function TypeIcon({ itemTypeId, className }: { itemTypeId: number; className?: string }) {
  const config = getItemTypeConfig(itemTypeId);
  const Icon = config?.icon ?? Lock;
  return <Icon className={className} />;
}

export function TrashView() {
  const symmetricKey = useAuthStore((s) => s.symmetricKey);

  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | 'purge-all' | null>(null);
  const [confirmPurgeId, setConfirmPurgeId] = useState<string | null>(null);
  const [confirmPurgeAll, setConfirmPurgeAll] = useState(false);

  useEffect(() => {
    if (!symmetricKey) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await listTrashItems();
        if (cancelled) return;
        if (!res.ok) {
          toast.error(res.error);
          setItems([]);
          return;
        }
        // 解密标题（并行）
        const decrypted = await Promise.all(
          res.data.map(async (row: ItemRow): Promise<TrashItem> => {
            let title = '(无法解密)';
            try {
              const enc = parseEncrypted(row.title_encrypted);
              title = await decrypt(symmetricKey, enc, `item:${row.id}:title`);
            } catch {
              // 解密失败保留默认标题
            }
            return {
              id: row.id,
              itemTypeId: row.item_type_id,
              title,
              deletedAt: row.deleted_at ?? new Date().toISOString(),
              remainingDays: calcRemainingDays(row.deleted_at ?? new Date().toISOString()),
            };
          }),
        );
        if (!cancelled) {
          setItems(decrypted);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          toast.error('加载回收站失败');
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [symmetricKey]);

  const handleRestore = async (itemId: string) => {
    setActionLoading(itemId);
    try {
      const res = await restoreItem(itemId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      toast.success('已恢复到原保险库');
      // 重新加载 vault 数据以同步列表（恢复的条目需重新出现在密码库中）
      // 注意：完整重载由 vault-view 的路由刷新或用户切换触发
      // 此处仅从回收站列表移除，避免重复拉取
    } catch {
      toast.error('恢复失败，请稍后重试');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePurge = async (itemId: string) => {
    setActionLoading(itemId);
    try {
      const res = await purgeItem(itemId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      toast.success('已彻底删除');
    } catch {
      toast.error('删除失败，请稍后重试');
    } finally {
      setActionLoading(null);
      setConfirmPurgeId(null);
    }
  };

  const handlePurgeAll = async () => {
    setActionLoading('purge-all');
    try {
      const res = await purgeAllItems();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setItems([]);
      toast.success(`已清空回收站（共 ${res.data.deletedCount} 项）`);
    } catch {
      toast.error('清空失败，请稍后重试');
    } finally {
      setActionLoading(null);
      setConfirmPurgeAll(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-md border border-border bg-muted/40" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Trash2 className="h-10 w-10 text-muted-foreground/50" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">回收站为空</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            删除的条目将在此保留 {TRASH_RETENTION_DAYS} 天，之后自动清理
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 顶部说明 + 清空按钮 */}
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">
          共 {items.length} 项，超过 {TRASH_RETENTION_DAYS} 天将自动清理
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={actionLoading !== null}
          onClick={() => setConfirmPurgeAll(true)}
        >
          <Trash2 className="h-4 w-4" />
          <span className="ml-1.5">清空全部</span>
        </Button>
      </div>

      {/* 条目列表 */}
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-md border border-border p-3"
          >
            <TypeIcon itemTypeId={item.itemTypeId} className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="truncate text-sm font-medium">{item.title}</div>
              <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                <span>删除于 {formatDate(item.deletedAt)}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5',
                    item.remainingDays <= 3
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  剩余 {item.remainingDays} 天
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={actionLoading !== null}
                onClick={() => handleRestore(item.id)}
                aria-label={`恢复 ${item.title}`}
              >
                {actionLoading === item.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                <span className="ml-1.5 hidden sm:inline">恢复</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={actionLoading !== null}
                onClick={() => setConfirmPurgeId(item.id)}
                aria-label={`彻底删除 ${item.title}`}
              >
                <Trash2 className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">彻底删除</span>
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* 单条彻底删除确认 */}
      <Dialog open={confirmPurgeId !== null} onOpenChange={(o) => !o && setConfirmPurgeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认彻底删除</DialogTitle>
            <DialogDescription>
              彻底删除后该条目将无法恢复，且会级联删除其历史版本、附件和标签关联。确定继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPurgeId(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={actionLoading !== null}
              onClick={() => confirmPurgeId && handlePurge(confirmPurgeId)}
            >
              {actionLoading !== null && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              彻底删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 清空全部确认 */}
      <Dialog open={confirmPurgeAll} onOpenChange={setConfirmPurgeAll}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认清空回收站</DialogTitle>
            <DialogDescription>
              将彻底删除回收站中全部 {items.length} 项条目，此操作不可撤销。确定继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPurgeAll(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={actionLoading !== null}
              onClick={handlePurgeAll}
            >
              {actionLoading === 'purge-all' && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              清空回收站
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
