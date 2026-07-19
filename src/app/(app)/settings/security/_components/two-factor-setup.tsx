/**
 * 2FA 设置组件 (T6.1)
 *
 * 客户端组件，管理 2FA 开启/关闭流程：
 *   idle → verify → backup-codes → enabled
 *
 * 未开启时：点击"开启 2FA" → 生成密钥 → 输入验证码 → 显示备用码
 * 已开启时：显示状态 + "关闭 2FA"按钮（需主密码确认）
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, ShieldCheck, KeyRound, Copy, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/stores/auth-store';
import { deriveMasterKeyViaWorker } from '@/lib/crypto/kdf-worker-client';
import { buildKdfConfig } from '@/lib/crypto/kdf';
import { deriveAuthHash } from '@/lib/crypto/hkdf';
import { fromBase64, toBase64, zeroFill } from '@/lib/crypto/encoding';
import type { SessionResponse } from '@/types/api';

type Step = 'idle' | 'verify' | 'backup-codes' | 'enabled';

interface SetupResponse {
  success: boolean;
  secret?: string;
  otpauthUrl?: string;
  error?: string;
}

interface EnableResponse {
  success: boolean;
  backupCodes?: string[];
  error?: string;
}

interface DisableResponse {
  success: boolean;
  error?: string;
}

export function TwoFactorSetup() {
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('idle');
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 关闭 2FA 对话框状态
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disabling, setDisabling] = useState(false);

  const { user, kdfSalt, kdfParams } = useAuthStore();

  // 初始化：获取 2FA 状态
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/session', { method: 'GET' });
        if (!res.ok) return;
        const data: SessionResponse = await res.json();
        if (!cancelled) {
          setStep(data.twoFactorEnabled ? 'enabled' : 'idle');
        }
      } catch {
        // 忽略错误，默认 idle
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 复制到剪贴板
  const handleCopy = useCallback(async (text: string, field: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success(`${label}已复制`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('复制失败，请手动复制');
    }
  }, []);

  // 开启 2FA：调用 setup API
  const handleSetup = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' });
      const data: SetupResponse = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error ?? '生成密钥失败');
        return;
      }
      setSecret(data.secret ?? '');
      setOtpauthUrl(data.otpauthUrl ?? '');
      setStep('verify');
    } catch {
      toast.error('网络错误，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 验证码验证：调用 enable API
  const handleEnable = async () => {
    if (!code.trim()) {
      toast.error('请输入验证码');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, code: code.trim() }),
      });
      const data: EnableResponse = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error ?? '验证码错误');
        return;
      }
      setBackupCodes(data.backupCodes ?? []);
      setStep('backup-codes');
      toast.success('2FA 已成功开启');
    } catch {
      toast.error('网络错误，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 关闭 2FA：派生 authHash 并调用 disable API
  const handleDisable = async () => {
    if (!disablePassword.trim()) {
      toast.error('请输入主密码');
      return;
    }
    if (!user || !kdfSalt || !kdfParams) {
      toast.error('会话信息不完整，请刷新页面重试');
      return;
    }

    setDisabling(true);
    let masterKey: Uint8Array | null = null;
    try {
      const kdfConfig = buildKdfConfig(fromBase64(kdfSalt), kdfParams);
      masterKey = await deriveMasterKeyViaWorker(disablePassword, kdfConfig);
      const authHashBytes = await deriveAuthHash(masterKey, user.email);
      const authHash = toBase64(authHashBytes);

      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: authHash }),
      });
      const data: DisableResponse = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error ?? '主密码错误');
        return;
      }

      setStep('idle');
      setDisableDialogOpen(false);
      setDisablePassword('');
      toast.success('2FA 已关闭');
    } catch {
      toast.error('操作失败，请稍后重试');
    } finally {
      zeroFill(masterKey);
      masterKey = null;
      setDisabling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Shield className="h-4 w-4" />
          安全设置
        </h1>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* 2FA 设置卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                两步验证 (2FA)
              </CardTitle>
              <CardDescription>
                使用 TOTP 验证器应用（如 Google Authenticator、Authy）生成验证码，为账户增加一层额外保护。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {step === 'idle' && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="h-4 w-4" />
                    2FA 未开启
                  </div>
                  <Button onClick={handleSetup} disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    开启 2FA
                  </Button>
                </div>
              )}

              {step === 'verify' && (
                <div className="space-y-4">
                  {/* 密钥 */}
                  <div className="space-y-2">
                    <Label>密钥（手动输入）</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-md border border-border bg-muted px-3 py-2 text-sm break-all">
                        {secret}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopy(secret, 'secret', '密钥')}
                        aria-label="复制密钥"
                      >
                        {copiedField === 'secret' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* otpauth URI */}
                  <div className="space-y-2">
                    <Label>OTP URI（扫码导入）</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-md border border-border bg-muted px-3 py-2 text-xs break-all">
                        {otpauthUrl}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopy(otpauthUrl, 'url', 'URI')}
                        aria-label="复制 OTP URI"
                      >
                        {copiedField === 'url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* 验证码输入 */}
                  <div className="space-y-2">
                    <Label htmlFor="totp-code">输入验证码</Label>
                    <Input
                      id="totp-code"
                      placeholder="6 位验证码"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEnable();
                      }}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setStep('idle');
                        setCode('');
                        setSecret('');
                        setOtpauthUrl('');
                      }}
                    >
                      取消
                    </Button>
                    <Button onClick={handleEnable} disabled={submitting || code.length !== 6}>
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      验证并启用
                    </Button>
                  </div>
                </div>
              )}

              {step === 'backup-codes' && (
                <div className="space-y-4">
                  <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
                    请妥善保存以下备用恢复码。每个码仅可使用一次，在无法访问验证器时可用于登录。此为唯一一次展示机会。
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-muted p-4">
                    {backupCodes.map((c, i) => (
                      <code key={i} className="text-sm font-mono text-center">
                        {c}
                      </code>
                    ))}
                  </div>
                  <Button
                    onClick={() => {
                      setStep('enabled');
                      setBackupCodes([]);
                      setCode('');
                      setSecret('');
                      setOtpauthUrl('');
                    }}
                    className="w-full"
                  >
                    <Check className="h-4 w-4" />
                    我已保存备用码
                  </Button>
                </div>
              )}

              {step === 'enabled' && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-success">
                    <ShieldCheck className="h-4 w-4" />
                    2FA 已开启
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setDisableDialogOpen(true)}
                  >
                    关闭 2FA
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 关闭 2FA 确认对话框 */}
      <Dialog open={disableDialogOpen} onOpenChange={(open) => {
        setDisableDialogOpen(open);
        if (!open) setDisablePassword('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认关闭 2FA</DialogTitle>
            <DialogDescription>
              关闭后账户安全性将降低。请输入主密码以确认操作。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="disable-password">主密码</Label>
            <Input
              id="disable-password"
              type="password"
              placeholder="输入主密码"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleDisable();
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDisableDialogOpen(false);
                setDisablePassword('');
              }}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={handleDisable} disabled={disabling}>
              {disabling && <Loader2 className="h-4 w-4 animate-spin" />}
              确认关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
