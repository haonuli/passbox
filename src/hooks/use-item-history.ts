/**
 * 条目历史版本 Hook
 *
 * 封装历史版本的状态管理与操作：加载列表、解密选中版本、恢复版本。
 * 解密使用与条目一致的 AAD（item:${itemId}:title / :data）。
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useVaultStore } from '@/stores/vault-store';
import { decrypt } from '@/lib/crypto/aes';
import { getItemTypeConfigByCode, type FieldConfig } from '@/lib/item-types';
import { listHistory, getHistoryVersion, restoreVersion } from '@/actions/item-history';
import type { HistoryListItem, HistoryVersion } from '@/actions/item-history';

interface DecryptedSnapshot {
  title: string;
  fields: Record<string, string>;
}

export interface UseItemHistoryReturn {
  versions: HistoryListItem[];
  loading: boolean;
  selectedId: string | null;
  selectedVersion: HistoryVersion | null;
  decrypting: boolean;
  decryptedData: DecryptedSnapshot | null;
  restoring: boolean;
  fields: FieldConfig[];
  handleSelect: (versionId: string) => void;
  handleRestore: () => Promise<void>;
}

/**
 * 管理条目历史版本的状态与操作。
 *
 * @param itemId 条目 ID
 * @param open Dialog 是否打开（打开时自动加载版本列表）
 * @param onOpenChange Dialog 开关回调（恢复成功后关闭）
 */
export function useItemHistory(
  itemId: string,
  open: boolean,
  onOpenChange: (open: boolean) => void,
): UseItemHistoryReturn {
  const symmetricKey = useAuthStore((s) => s.symmetricKey);
  const items = useVaultStore((s) => s.items);

  const [versions, setVersions] = useState<HistoryListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<HistoryVersion | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptedData, setDecryptedData] = useState<DecryptedSnapshot | null>(null);
  const [restoring, setRestoring] = useState(false);

  const item = items.find((i) => i.id === itemId);
  const fields: FieldConfig[] =
    getItemTypeConfigByCode(item?.itemTypeCode ?? '')?.fields ?? [];

  const loadVersions = useCallback(async () => {
    setVersions([]);
    setSelectedVersion(null);
    setSelectedId(null);
    setDecryptedData(null);
    setLoading(true);
    try {
      const result = await listHistory(itemId);
      if (result.ok) setVersions(result.data);
      else toast.error(result.error);
    } catch {
      toast.error('加载历史版本失败');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadVersions();
    }
  }, [open, loadVersions]);

  const handleSelect = useCallback(
    async (versionId: string) => {
      if (!symmetricKey) {
        toast.error('密钥未加载，请先解锁');
        return;
      }
      setSelectedId(versionId);
      setDecrypting(true);
      setDecryptedData(null);
      try {
        const result = await getHistoryVersion(versionId);
        if (!result.ok) {
          toast.error(result.error);
          setSelectedVersion(null);
          return;
        }
        const version = result.data;
        setSelectedVersion(version);
        const [title, dataStr] = await Promise.all([
          decrypt(symmetricKey, version.titleEncrypted, `item:${itemId}:title`),
          decrypt(symmetricKey, version.dataEncrypted, `item:${itemId}:data`),
        ]);
        let parsed: Record<string, string>;
        try {
          parsed = JSON.parse(dataStr) as Record<string, string>;
        } catch {
          parsed = {};
        }
        setDecryptedData({ title, fields: parsed });
      } catch {
        toast.error('解密历史版本失败');
        setSelectedVersion(null);
      } finally {
        setDecrypting(false);
      }
    },
    [symmetricKey, itemId],
  );

  const handleRestore = useCallback(async () => {
    if (!selectedId) return;
    setRestoring(true);
    try {
      const result = await restoreVersion(selectedId);
      if (result.ok) {
        toast.success('已恢复到选定版本');
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('恢复失败，请稍后重试');
    } finally {
      setRestoring(false);
    }
  }, [selectedId, onOpenChange]);

  return {
    versions,
    loading,
    selectedId,
    selectedVersion,
    decrypting,
    decryptedData,
    restoring,
    fields,
    handleSelect,
    handleRestore,
  };
}
