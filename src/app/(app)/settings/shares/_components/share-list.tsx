/**
 * 共享链接列表组件
 *
 * 拉取当前用户的共享链接列表，展示状态与操作。
 * 支持撤销链接（二次确认）、空状态、加载骨架屏。
 */
'use client';

import { useEffect, useState } from 'react';
import { Share2, Trash2, Loader2, Lock } from 'lucide-react';
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
import { getItemTypeConfigByCode } from '@/lib/item-types';
import type { ShareListItem } from '@/types/share';
import { cn } from '@/lib/utils';

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

/** 行内小图标 */
function TypeIcon({ code, className }: { code: string; className?: string }) {
  const config = getItemTypeConfigByCode(code);
  const Icon = config?.icon ?? Lock;
  return <Icon className={className} />;
}

/** 状态标签 */
function StatusBadge({ expired }: { expired: boolean }) {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';
  if (expired) {
    return <span className={cn(base, 'bg-muted text-muted-foreground')}>已过期</span>;
  }
  return (
    <span className={cn(base, 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400')}>
      活跃
    </span>
  );
}

export function ShareList() {
  const [items, setItems] = useState<ShareListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/share');
        if (!res.ok) return;
        const data = (await res.json()) as ShareListItem[];
        if (!cancelled) {
          setItems(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      const res = await fetch(`/api/share/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(body?.error ?? '撤销失败');
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== id));
      toast.success('链接已撤销');
    } catch {
      toast.error('撤销失败，请稍后重试');
    } finally {
      setRevokingId(null);
      setConfirmId(null);
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
        <Share2 className="h-10 w-10 text-muted-foreground/50" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">暂无共享链接</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            从条目详情面板创建共享链接
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 rounded-md border border-border p-3"
        >
          <TypeIcon code={item.itemTypeCode} className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <StatusBadge expired={item.expired} />
              <span className="text-xs text-muted-foreground">
                查看 {item.viewCount}
                {item.maxViews === null ? ' / 不限' : ` / ${item.maxViews}`}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
              <span>创建：{formatDate(item.createdAt)}</span>
              <span>过期：{formatDate(item.expiresAt)}</span>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={revokingId === item.id}
            onClick={() => setConfirmId(item.id)}
          >
            {revokingId === item.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            <span className="ml-1.5 hidden sm:inline">撤销</span>
          </Button>
        </div>
      ))}

      <Dialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认撤销链接</DialogTitle>
            <DialogDescription>
              撤销后该链接将立即失效，无法恢复。确定继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmId(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={revokingId !== null}
              onClick={() => confirmId && handleRevoke(confirmId)}
            >
              {revokingId !== null && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              撤销链接
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
