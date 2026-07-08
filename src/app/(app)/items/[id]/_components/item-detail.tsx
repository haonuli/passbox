/**
 * 条目详情组件 (T4.5 / T5.4 / T5.6)
 *
 * 数据驱动渲染：从 ITEM_TYPE_CONFIGS 读取当前类型的字段配置，
 * 动态渲染详情字段，新增类型无需修改本组件。
 *
 * 提供编辑、删除、收藏切换操作按钮。
 * T5.4: TOTP 验证码实时展示
 * T5.6: 复制用户名/密码、打开网站便捷操作
 */
'use client';

import { useState, useCallback, useMemo, createElement } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Star,
  Copy,
  ExternalLink,
  Loader2,
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

interface ItemDetailProps {
  itemId: string;
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

export function ItemDetail({ itemId }: ItemDetailProps) {
  const router = useRouter();
  const items = useVaultStore((s) => s.items);
  const removeItem = useVaultStore((s) => s.removeItem);
  const updateFavorite = useVaultStore((s) => s.updateFavorite);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { copy } = useClipboard();
  const clipboardClearSeconds = useSettingsStore((s) => s.clipboardClearSeconds);

  const item = items.find((i) => i.id === itemId);

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
        router.push('/vault');
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('删除失败，请稍后重试');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }, [item, removeItem, router]);

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

  const handleOpenWebsite = useCallback(() => {
    if (item?.data.url) {
      let url = item.data.url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [item]);

  // 条目不存在
  if (!item) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-sm text-muted-foreground">条目不存在或已被删除</p>
        <Button size="sm" variant="outline" onClick={() => router.push('/vault')}>
          返回密码库
        </Button>
      </div>
    );
  }

  // 未知类型兜底
  const fields = typeConfig?.fields ?? [];

  return (
    <div className="flex h-full flex-col">
      {/* 顶部操作栏 */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => router.push('/vault')}
          aria-label="返回"
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
        {/* 动态字段渲染 */}
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

        {/* TOTP 验证码展示（T5.4） */}
        {item.data.totpSecret && (
          <div className="px-4 py-3">
            <TotpDisplay base32Secret={item.data.totpSecret} />
          </div>
        )}

        {/* 便捷操作按钮（T5.6） */}
        {(item.data.url || item.data.website || item.data.adminConsoleUrl) && (
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {item.data.url && (
              <Button size="sm" variant="outline" onClick={handleOpenWebsite}>
                <ExternalLink className="h-4 w-4" />
                打开网站
              </Button>
            )}
            {item.data.website && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  let url = item.data.website!;
                  if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = `https://${url}`;
                  }
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
              >
                <ExternalLink className="h-4 w-4" />
                打开网站
              </Button>
            )}
            {item.data.adminConsoleUrl && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  let url = item.data.adminConsoleUrl!;
                  if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = `https://${url}`;
                  }
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
              >
                <ExternalLink className="h-4 w-4" />
                管理控制台
              </Button>
            )}
          </div>
        )}

        {/* 元数据 */}
        <div className="px-4 py-3 text-xs text-muted-foreground">
          <div>创建时间：{new Date(item.createdAt).toLocaleString('zh-CN')}</div>
          <div>修改时间：{new Date(item.updatedAt).toLocaleString('zh-CN')}</div>
        </div>
      </div>

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
