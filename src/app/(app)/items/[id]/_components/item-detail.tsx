/**
 * 条目详情组件 (T4.5 / T5.4 / T5.6)
 *
 * 展示登录条目的完整信息：标题、URL、用户名、密码（默认隐藏）、备注。
 * 提供编辑、删除、收藏切换操作按钮。
 * T5.4: TOTP 验证码实时展示
 * T5.6: 复制用户名/密码、打开网站便捷操作
 *
 * @see TASK_BREAKDOWN T4.5 / T5.4 / T5.6 验收标准
 */
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Star,
  Globe,
  User,
  KeyRound,
  FileText,
  Loader2,
  Copy,
  ExternalLink,
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
import { deleteItem, toggleFavorite } from '@/actions/item';
import { useClipboard } from '@/hooks/use-clipboard';
import { TotpDisplay } from '@/components/item/totp-display';

interface ItemDetailProps {
  itemId: string;
}

/** 详情字段行 */
function DetailField({
  icon: Icon,
  label,
  value,
  isPassword = false,
}: {
  icon: typeof Globe;
  label: string;
  value?: string;
  isPassword?: boolean;
}) {
  const [show, setShow] = useState(false);

  if (!value) return null;

  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-0.5 break-all text-sm font-medium">
          {isPassword && !show ? '••••••••' : value}
        </div>
      </div>
      {isPassword && (
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={show ? '隐藏' : '显示'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
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

  const item = items.find((i) => i.id === itemId);

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

  const handleCopyUsername = useCallback(() => {
    if (item?.data.username) {
      copy(item.data.username, 0, '用户名');
    }
  }, [item, copy]);

  const handleCopyPassword = useCallback(() => {
    if (item?.data.password) {
      copy(item.data.password, 30, '密码');
    }
  }, [item, copy]);

  const handleOpenWebsite = useCallback(() => {
    if (item?.data.url) {
      let url = item.data.url;
      // 确保 URL 有协议前缀
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
        {item.itemTypeCode === 'login' && (
          <>
            <DetailField icon={Globe} label="网址" value={item.data.url} />
            <DetailField icon={User} label="用户名" value={item.data.username} />
            <DetailField
              icon={KeyRound}
              label="密码"
              value={item.data.password}
              isPassword
            />
          </>
        )}

        {item.itemTypeCode === 'secure_note' && (
          <DetailField icon={FileText} label="笔记内容" value={item.data.noteText} />
        )}

        {item.itemTypeCode === 'credit_card' && (
          <>
            <DetailField icon={User} label="持卡人" value={item.data.cardholder} />
            <DetailField
              icon={KeyRound}
              label="卡号"
              value={item.data.cardNumber}
              isPassword
            />
            <DetailField icon={Globe} label="有效期" value={item.data.expiry} />
            <DetailField
              icon={KeyRound}
              label="CVV"
              value={item.data.cvv}
              isPassword
            />
          </>
        )}

        {/* TOTP 验证码展示（T5.4） */}
        {item.data.totpSecret && (
          <div className="px-4 py-3">
            <TotpDisplay base32Secret={item.data.totpSecret} />
          </div>
        )}

        {item.data.notes && (
          <DetailField icon={FileText} label="备注" value={item.data.notes} />
        )}

        {/* 便捷操作按钮（T5.6） */}
        {item.itemTypeCode === 'login' && (
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {item.data.username && (
              <Button size="sm" variant="outline" onClick={handleCopyUsername}>
                <Copy className="h-4 w-4" />
                复制用户名
              </Button>
            )}
            {item.data.password && (
              <Button size="sm" variant="outline" onClick={handleCopyPassword}>
                <Copy className="h-4 w-4" />
                复制密码
              </Button>
            )}
            {item.data.url && (
              <Button size="sm" variant="outline" onClick={handleOpenWebsite}>
                <ExternalLink className="h-4 w-4" />
                打开网站
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
