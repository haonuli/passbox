/**
 * 保存 SSH 密钥到密码库的 Hook
 *
 * 封装加密 + createItem + 更新 vault-store 的完整流程，
 * 生成与导入弹窗共用。
 */
'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useVaultStore } from '@/stores/vault-store';
import { createItem } from '@/actions/item';
import { encrypt } from '@/lib/crypto/aes';
import type { EncryptedData } from '@/types/crypto';
import type { DecryptedItem, ItemData } from '@/types/vault';

/** SSH 密钥条目类型 ID（与 item-types.ts / 数据库一致） */
export const SSH_KEY_ITEM_TYPE_ID = 17;

/** 保存到密码库的 payload（生成/导入共用） */
export interface SshKeySavePayload {
  title: string;
  data: {
    hostname: string;
    username: string;
    port: string;
    keyType: string;
    publicKey: string;
    privateKey: string;
    passphrase: string;
    notes: string;
  };
}

export function useSaveSshKey() {
  const symmetricKey = useAuthStore((s) => s.symmetricKey);
  const vaults = useVaultStore((s) => s.vaults);
  const upsertItem = useVaultStore((s) => s.upsertItem);
  const [saving, setSaving] = useState(false);

  const saveKey = useCallback(
    async (payload: SshKeySavePayload): Promise<boolean> => {
      if (!symmetricKey) {
        toast.error('密码库未解锁');
        return false;
      }
      const targetVaultId = vaults[0]?.id;
      if (!targetVaultId) {
        toast.error('未找到可用保险库');
        return false;
      }
      setSaving(true);
      try {
        const itemId = crypto.randomUUID();
        const titleEncrypted: EncryptedData = await encrypt(
          symmetricKey,
          payload.title,
          `item:${itemId}:title`,
        );
        const dataEncrypted: EncryptedData = await encrypt(
          symmetricKey,
          JSON.stringify(payload.data),
          `item:${itemId}:data`,
        );
        const result = await createItem({
          itemId,
          vaultId: targetVaultId,
          itemTypeId: SSH_KEY_ITEM_TYPE_ID,
          titleEncrypted,
          dataEncrypted,
          tagIds: [],
        });
        if (result.ok) {
          const newItem: DecryptedItem = {
            id: result.data.id,
            vaultId: result.data.vault_id,
            itemTypeId: result.data.item_type_id,
            itemTypeCode: 'ssh_key',
            title: payload.title,
            data: payload.data as ItemData,
            isFavorite: false,
            createdAt: result.data.created_at,
            updatedAt: result.data.updated_at,
            tagIds: [],
          };
          upsertItem(newItem);
          toast.success('已保存到密码库');
          return true;
        }
        toast.error(result.error);
        return false;
      } catch {
        toast.error('保存失败，请稍后重试');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [symmetricKey, vaults, upsertItem],
  );

  return { saveKey, saving };
}
