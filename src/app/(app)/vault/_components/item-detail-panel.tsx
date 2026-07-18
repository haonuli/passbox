/**
 * 条目详情面板（三栏布局右侧）
 *
 * 选中条目时展示详情（复用 ItemDetail 核心逻辑），
 * 未选中时展示空状态引导。
 * 移动端覆盖列表全屏展示，提供返回按钮。
 */
'use client';

import { useCallback, useMemo, useState, createElement } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Star,
  Share2,
  Copy,
  ExternalLink,
  Loader2,
  MousePointerClick,
  History,
} from 'lucide-react';
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
import { useSettingsStore } from '@/stores/settings-store';
import { deleteItem, toggleFavorite } from '@/actions/item';
import { useClipboard } from '@/hooks/use-clipboard';
import { TotpDisplay } from '@/components/item/totp-display';
import { getItemTypeConfigByCode, getFieldIcon, type FieldConfig } from '@/lib/item-types';
import { ShareDialog } from '@/app/(app)/settings/shares/_components/share-dialog';
import { HistoryDialog } from '@/app/(app)/items/_components/history-dialog';

interface ItemDetailPanelProps {
  itemId: string | null;
  onBack: () => void;
}

/** 字段图标渲染 */
function FieldIcon({ name, className }: { name: string; className?: string }) {
  return createElement(getFieldIcon(name), { className });
}

/** 详情字段行 */
function DetailField({
  field,
  value,
  onCopy,
}: {
  field: FieldConfig;
  value: string;
  onCopy?: (value: string, label: string) => void;
}) {
  const [show, setShow] = useState(false);
  const isPassword = field.type === 'password';

  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-3">
      <FieldIcon name={field.name} className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{field.label}</div>
        <div className="mt-0.5 break-all text-sm font-medium">
          {isPassword && !show ? '••••••••' : value}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={show ? '隐藏' : '显示'}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
        {onCopy && (
          <button
            type="button"
            onClick={() => onCopy(value, field.label)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`复制${field.label}`}
          >
            <Copy className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/** 空状态 */
function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <MousePointerClick className="h-10 w-10 text-muted-foreground/50" />
      <div>
        <p className="text-sm font-medium text-muted-foreground">选择一个条目查看详情</p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          点击左侧列表中的任意条目，详情将在此处展示
        </p>
      </div>
    </div>
  );
}

export function ItemDetailPanel({ itemId, onBack }: ItemDetailPanelProps) {
  const router = useRouter();
  const items = useVaultStore((s) => s.items);
  const removeItem = useVaultStore((s) => s.removeItem);
  const updateFavorite = useVaultStore((s) => s.updateFavorite);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const { copy } = useClipboard();
  const clipboardClearSeconds = useSettingsStore((s) => s.clipboardClearSeconds);

  const item = useMemo(
    () => (itemId ? items.find((i) => i.id === itemId) : undefined),
    [items, itemId],
  );

  const typeConfig = useMemo(
    () => (item ? getItemTypeConfigByCode(item.itemTypeCode) : undefined),
    [item],
  );

  const handleDelete = useCallback(async () => {
    if (!item) return;
    setDeleting(true);
    try {
      const result = await deleteItem(item.id);
      if (result.ok) {
        removeItem(item.id);
        toast.success('条目已删除');
        onBack();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('删除失败，请稍后重试');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }, [item, removeItem, onBack]);

  const handleToggleFavorite = useCallback(async () => {
    if (!item) return;
    const newValue = !item.isFavorite;
    updateFavorite(item.id, newValue);
    try {
      const result = await toggleFavorite(item.id, newValue);
      if (!result.ok) {
        updateFavorite(item.id, !newValue);
        toast.error(result.error);
      }
    } catch {
      updateFavorite(item.id, !newValue);
      toast.error('更新收藏状态失败');
    }
  }, [item, updateFavorite]);

  const handleCopy = useCallback(
    (value: string, label: string, sensitive: boolean) => {
      copy(value, sensitive ? clipboardClearSeconds : 0, label);
    },
    [copy, clipboardClearSeconds],
  );

  const handleOpenWebsite = useCallback((url: string) => {
    let finalUrl = url;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = `https://${finalUrl}`;
    }
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
  }, []);

  // 空状态
  if (!item) {
    return (
      <div className="flex h-full flex-col">
        <EmptyState />
      </div>
    );
  }

  const fields = typeConfig?.fields ?? [];

  return (
    <div className="flex h-full flex-col">
      {/* 顶部操作栏 */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Button
          size="icon"
          variant="ghost"
          onClick={onBack}
          aria-label="返回列表"
          className="md:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="flex-1 truncate text-base font-semibold">{item.title}</h1>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleToggleFavorite}
          aria-label="收藏"
        >
          <Star
            className={
              item.isFavorite
                ? 'h-4 w-4 fill-yellow-400 text-yellow-400'
                : 'h-4 w-4 text-muted-foreground'
            }
          />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShareDialogOpen(true)}
        >
          <Share2 className="h-4 w-4" />
          <span className="ml-1.5 hidden sm:inline">分享</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setHistoryDialogOpen(true)}
        >
          <History className="h-4 w-4" />
          <span className="ml-1.5 hidden sm:inline">历史</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => router.push(`/items/${item.id}/edit`)}
        >
          <Pencil className="h-4 w-4" />
          <span className="ml-1.5 hidden sm:inline">编辑</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDeleteDialogOpen(true)}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          <span className="ml-1.5 hidden sm:inline">删除</span>
        </Button>
      </div>

      {/* 详情内容 */}
      <div className="flex-1 overflow-auto">
        {fields.map((field) => {
          const value = (item.data as Record<string, string | undefined>)[field.name];
          if (!value) return null;
          return (
            <DetailField
              key={field.name}
              field={field}
              value={value}
              onCopy={
                field.copyable
                  ? (v, label) => handleCopy(v, label, field.type === 'password')
                  : undefined
              }
            />
          );
        })}

        {item.data.totpSecret && (
          <div className="px-4 py-3">
            <TotpDisplay base32Secret={item.data.totpSecret} />
          </div>
        )}

        {(item.data.url || item.data.website || item.data.adminConsoleUrl) && (
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {item.data.url && (
              <Button size="sm" variant="outline" onClick={() => handleOpenWebsite(item.data.url!)}>
                <ExternalLink className="h-4 w-4" />
                打开网站
              </Button>
            )}
            {item.data.website && (
              <Button size="sm" variant="outline" onClick={() => handleOpenWebsite(item.data.website!)}>
                <ExternalLink className="h-4 w-4" />
                打开网站
              </Button>
            )}
            {item.data.adminConsoleUrl && (
              <Button size="sm" variant="outline" onClick={() => handleOpenWebsite(item.data.adminConsoleUrl!)}>
                <ExternalLink className="h-4 w-4" />
                管理控制台
              </Button>
            )}
          </div>
        )}

        <div className="px-4 py-3 text-xs text-muted-foreground">
          <div>创建时间：{new Date(item.createdAt).toLocaleString('zh-CN')}</div>
          <div>修改时间：{new Date(item.updatedAt).toLocaleString('zh-CN')}</div>
        </div>
      </div>

      {/* 分享弹窗 */}
      <ShareDialog
        item={item}
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
      />

      {/* 历史版本弹窗 */}
      <HistoryDialog
        itemId={item.id}
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
      />

      {/* 删除确认弹窗 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定删除「{item.title}」？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
