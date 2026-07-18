/**
 * SSH 密钥管理主组件
 *
 * 展示密码库中所有 SSH 密钥条目，支持生成新密钥与导入已有密钥。
 * 列表行点击跳转条目编辑页；复制公钥使用安全剪贴板（自动清除）。
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  TerminalSquare,
  Plus,
  Download,
  KeyRound,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVaultStore } from '@/stores/vault-store';
import { computeFingerprint } from '@/lib/ssh/ssh-utils';
import { copyToClipboard } from '@/lib/security/clipboard';
import { useSaveSshKey, SSH_KEY_ITEM_TYPE_ID } from './use-save-ssh-key';
import { SshKeyRow } from './ssh-key-row';
import { GenerateKeyDialog } from './generate-key-dialog';
import { ImportKeyDialog } from './import-key-dialog';

export function SshKeysView() {
  const router = useRouter();
  const items = useVaultStore((s) => s.items);
  const loaded = useVaultStore((s) => s.loaded);
  const loading = useVaultStore((s) => s.loading);
  const { saveKey, saving } = useSaveSshKey();

  const [generateOpen, setGenerateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [fingerprints, setFingerprints] = useState<Record<string, string>>({});

  const sshKeys = useMemo(
    () => items.filter((i) => i.itemTypeId === SSH_KEY_ITEM_TYPE_ID),
    [items],
  );

  // 计算公钥指纹
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      sshKeys.map(async (item) => {
        const pub = item.data.publicKey ?? '';
        return [item.id, pub ? await computeFingerprint(pub) : ''] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const [id, fp] of entries) map[id] = fp;
      setFingerprints(map);
    });
    return () => {
      cancelled = true;
    };
  }, [sshKeys]);

  const handleCopyPublicKey = useCallback(async (publicKey: string) => {
    const ok = await copyToClipboard(publicKey);
    if (ok) toast.success('公钥已复制');
    else toast.error('复制失败，请手动复制');
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <TerminalSquare className="h-4 w-4" />
          <h1 className="flex-1 text-base font-semibold">SSH 密钥管理</h1>
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Download className="mr-1.5 h-4 w-4" />
            导入密钥
          </Button>
          <Button size="sm" onClick={() => setGenerateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            生成密钥
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-3xl space-y-2">
          {loading && !loaded ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载中…
            </div>
          ) : sshKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <KeyRound className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                暂无 SSH 密钥，点击生成或导入
              </p>
            </div>
          ) : (
            sshKeys.map((item) => (
              <SshKeyRow
                key={item.id}
                item={item}
                fingerprint={fingerprints[item.id] ?? ''}
                onCopyPublicKey={handleCopyPublicKey}
                onClick={() => router.push(`/items/${item.id}/edit`)}
              />
            ))
          )}
        </div>
      </div>

      <GenerateKeyDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        saving={saving}
        onSave={saveKey}
      />
      <ImportKeyDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        saving={saving}
        onSave={saveKey}
      />
    </div>
  );
}
