/**
 * 单条 SSH 密钥行组件
 *
 * 展示主机名、密钥类型、用户名、公钥指纹，支持复制公钥和点击跳转编辑。
 */
'use client';

import { KeyRound, Fingerprint, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DecryptedItem } from '@/types/vault';

const KEY_TYPE_LABELS: Record<string, string> = {
  ed25519: 'Ed25519',
  rsa: 'RSA',
  ecdsa: 'ECDSA',
  unknown: '未知',
};

interface SshKeyRowProps {
  item: DecryptedItem;
  fingerprint: string;
  onCopyPublicKey: (publicKey: string) => void;
  onClick: () => void;
}

export function SshKeyRow({
  item,
  fingerprint,
  onCopyPublicKey,
  onClick,
}: SshKeyRowProps) {
  const hostname = item.data.hostname ?? item.title;
  const username = item.data.username ?? '-';
  const rawKeyType = item.data.keyType ?? '';
  const keyType = rawKeyType
    ? (KEY_TYPE_LABELS[rawKeyType] ?? rawKeyType)
    : '-';
  const publicKey = item.data.publicKey ?? '';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 transition-colors hover:bg-muted/50"
    >
      <KeyRound className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{hostname}</span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {keyType}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="truncate">{username}</span>
          {fingerprint && (
            <span className="flex min-w-0 items-center gap-1">
              <Fingerprint className="h-3 w-3 shrink-0" />
              <span className="truncate">{fingerprint}</span>
            </span>
          )}
        </div>
      </div>
      {publicKey && (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onCopyPublicKey(publicKey);
          }}
        >
          <Copy className="mr-1 h-3.5 w-3.5" />
          复制公钥
        </Button>
      )}
    </div>
  );
}
