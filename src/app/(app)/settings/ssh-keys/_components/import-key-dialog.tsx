/**
 * 导入 SSH 密钥弹窗
 *
 * 粘贴已有私钥，自动检测密钥类型，填写主机名/用户名后保存到密码库。
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
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
import {
  detectKeyInfo,
  type SshKeyDetectResult,
} from '@/lib/ssh/ssh-utils';
import { cn } from '@/lib/utils';
import type { SshKeySavePayload } from './use-save-ssh-key';

interface ImportKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onSave: (payload: SshKeySavePayload) => Promise<boolean>;
}

const KEY_TYPE_LABELS: Record<string, string> = {
  ed25519: 'Ed25519',
  rsa: 'RSA',
  ecdsa: 'ECDSA',
  unknown: '未知',
};

const TEXTAREA_CLASS =
  'flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export function ImportKeyDialog({
  open,
  onOpenChange,
  saving,
  onSave,
}: ImportKeyDialogProps) {
  const [privateKey, setPrivateKey] = useState('');
  const [hostname, setHostname] = useState('');
  const [username, setUsername] = useState('');
  const [detectResult, setDetectResult] = useState<SshKeyDetectResult | null>(null);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setPrivateKey('');
        setHostname('');
        setUsername('');
        setDetectResult(null);
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  // 自动检测密钥类型（异步，仅在私钥非空时触发）
  useEffect(() => {
    const trimmed = privateKey.trim();
    if (!trimmed) return;
    let cancelled = false;
    void detectKeyInfo(trimmed).then((res) => {
      if (!cancelled) setDetectResult(res);
    });
    return () => {
      cancelled = true;
    };
  }, [privateKey]);

  const handleSave = useCallback(async () => {
    if (!privateKey.trim()) {
      toast.error('请粘贴私钥');
      return;
    }
    if (!hostname.trim()) {
      toast.error('请输入主机名');
      return;
    }
    const keyType = detectResult?.keyType ?? 'unknown';
    const payload: SshKeySavePayload = {
      title: hostname.trim(),
      data: {
        hostname: hostname.trim(),
        username: username.trim(),
        port: '22',
        keyType,
        publicKey: detectResult?.publicKey ?? '',
        privateKey: privateKey.trim(),
        passphrase: '',
        notes: '',
      },
    };
    const ok = await onSave(payload);
    if (ok) handleOpenChange(false);
  }, [privateKey, hostname, username, detectResult, onSave, handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>导入 SSH 密钥</DialogTitle>
          <DialogDescription>
            粘贴已有私钥，自动检测密钥类型后保存到密码库。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ssh-private-key">私钥</Label>
            <textarea
              id="ssh-private-key"
              className={cn(TEXTAREA_CLASS, 'min-h-[140px]')}
              placeholder={'-----BEGIN OPENSSH PRIVATE KEY-----\n...'}
              value={privateKey}
              onChange={(e) => {
                const val = e.target.value;
                setPrivateKey(val);
                if (!val.trim()) setDetectResult(null);
              }}
            />
            {detectResult && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  类型：{KEY_TYPE_LABELS[detectResult.keyType] ?? detectResult.keyType}
                </span>
                {detectResult.hasPassphrase && (
                  <span className="text-warning">
                    已加密（有口令）
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ssh-hostname">主机名</Label>
              <Input
                id="ssh-hostname"
                placeholder="example.com"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ssh-username">用户名</Label>
              <Input
                id="ssh-username"
                placeholder="root"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !privateKey.trim()}
          >
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            保存到密码库
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
