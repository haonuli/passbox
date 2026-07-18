/**
 * 主密码验证 Dialog 子组件
 *
 * 旅行模式开启/关闭时需要验证主密码，派生 authHash 后调用 onSubmit。
 */
'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { PasswordInput } from '@/components/password-input';
import { useAuthStore } from '@/stores/auth-store';
import { deriveMasterKeyViaWorker } from '@/lib/crypto/kdf-worker-client';
import { buildKdfConfig } from '@/lib/crypto/kdf';
import { deriveAuthHash } from '@/lib/crypto/hkdf';
import { fromBase64, toBase64, zeroFill } from '@/lib/crypto/encoding';

interface VerifyPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 待操作：true=开启旅行模式, false=关闭 */
  pendingEnable: boolean;
  /** 验证成功后回调 */
  onSuccess: () => void;
}

export function VerifyPasswordDialog({
  open,
  onOpenChange,
  pendingEnable,
  onSuccess,
}: VerifyPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleConfirm = async () => {
    if (!password) {
      toast.error('请输入主密码');
      return;
    }

    const { kdfSalt, kdfParams, user } = useAuthStore.getState();
    if (!kdfSalt || !kdfParams || !user) {
      toast.error('无法获取加密参数，请重新解锁');
      return;
    }

    setVerifying(true);
    let masterKey: Uint8Array | null = null;
    let authHashBytes: Uint8Array | null = null;

    try {
      const salt = fromBase64(kdfSalt);
      const kdfConfig = buildKdfConfig(salt, kdfParams);
      masterKey = await deriveMasterKeyViaWorker(password, kdfConfig);
      authHashBytes = await deriveAuthHash(masterKey, user.email);
      const authHash = toBase64(authHashBytes);

      const res = await fetch('/api/travel-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authHash, enable: pendingEnable }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? '验证失败');
      }

      setPassword('');
      onOpenChange(false);
      onSuccess();
      toast.success(pendingEnable ? '旅行模式已开启' : '旅行模式已关闭');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失败，请稍后重试');
    } finally {
      zeroFill(masterKey);
      zeroFill(authHashBytes);
      setVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>验证主密码</DialogTitle>
          <DialogDescription>
            {pendingEnable
              ? '开启旅行模式需要验证主密码。开启后仅旅行安全的保险库可访问。'
              : '关闭旅行模式需要验证主密码。关闭后将恢复所有保险库的访问。'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="travel-mode-password">主密码</Label>
          <PasswordInput
            id="travel-mode-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入主密码"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !verifying) {
                void handleConfirm();
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={verifying}
          >
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={verifying || !password}>
            {verifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                验证中...
              </>
            ) : (
              '确认'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
