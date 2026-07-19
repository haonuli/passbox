/**
 * 保险库创建/重命名弹窗（共享组件）
 *
 * 零知识架构下，保险库名称在客户端用 Symmetric Key 加密后，
 * 才提交到服务端。AAD 绑定 'passbox:vault-name:v1' 防止跨域重放。
 *
 * 被侧边栏 VaultSection 和设置页 VaultsView 共用。
 */
'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { encrypt } from '@/lib/crypto/aes';
import { createVaultEncrypted, renameVault } from '@/actions/vault';
import { useAuthStore } from '@/stores/auth-store';
import { useVaultStore } from '@/stores/vault-store';
import type { DecryptedVault } from '@/types/vault';
import type { EncryptedData } from '@/types/crypto';

/** 保险库名称加密 AAD — 与 vault-store 解密时保持一致 */
const VAULT_NAME_AAD = 'passbox:vault-name:v1';

/** 保险库名称最大长度 */
const MAX_VAULT_NAME_LENGTH = 50;

interface VaultFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'create' 新建 | 'rename' 重命名 */
  mode: 'create' | 'rename';
  /** 重命名时传入的现有保险库 */
  vault?: DecryptedVault;
  /** 操作成功后回调（store 已更新） */
  onSaved?: () => void;
}

export function VaultFormDialog({
  open,
  onOpenChange,
  mode,
  vault,
  onSaved,
}: VaultFormDialogProps) {
  const symmetricKey = useAuthStore((s) => s.symmetricKey);
  const upsertVault = useVaultStore((s) => s.upsertVault);

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  // 打开时重置表单（render-time setState，替代 effect）
  // 参考：https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName(mode === 'rename' && vault ? vault.name : '');
    }
  }

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('保险库名称不能为空');
      return;
    }
    if (!symmetricKey) {
      toast.error('会话已过期，请重新解锁');
      return;
    }

    setSaving(true);
    try {
      const encryptedName: EncryptedData = await encrypt(
        symmetricKey,
        trimmed,
        VAULT_NAME_AAD,
      );

      if (mode === 'create') {
        const result = await createVaultEncrypted(encryptedName);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        const row = result.data;
        upsertVault({
          id: row.id,
          name: trimmed,
          displayOrder: row.display_order,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
        toast.success('保险库已创建');
      } else if (mode === 'rename' && vault) {
        const result = await renameVault(vault.id, encryptedName);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        const row = result.data;
        upsertVault({
          ...vault,
          name: trimmed,
          updatedAt: row.updated_at,
        });
        toast.success('保险库已重命名');
      }

      onSaved?.();
      onOpenChange(false);
    } catch {
      toast.error('操作失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新建保险库' : '重命名保险库'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? '创建一个新的保险库来分类管理你的条目。'
              : '为保险库设置一个新的名称。'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="vault-name">名称</Label>
          <Input
            id="vault-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：个人、工作、家庭"
            maxLength={MAX_VAULT_NAME_LENGTH}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !saving) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            {name.length} / {MAX_VAULT_NAME_LENGTH}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {mode === 'create' ? '创建' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
