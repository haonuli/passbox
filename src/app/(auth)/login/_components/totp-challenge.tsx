/**
 * TOTP 验证码输入组件 (T6.2)
 *
 * 登录密码验证通过后，若用户开启了 2FA，login API 返回 202 + ticket。
 * 本组件渲染 6 位 TOTP 验证码输入框，用户输入完成后自动提交到
 * /api/auth/2fa/verify 完成验证。
 *
 * 支持两种验证方式：
 *   1. TOTP 验证码（6 位数字，输入满 6 位自动提交）
 *   2. 备用恢复码（手动输入 + 提交按钮）
 *
 * 验证成功后调用 onSuccess(LoginResponse)，由父组件（useLogin hook）
 * 用保留的 masterKey 完成零知识解密流程。
 *
 * @see TASK_BREAKDOWN T6.2
 */
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { toast } from 'sonner';
import type { LoginResponse, ApiErrorResponse } from '@/types/api';

interface TotpChallengeProps {
  /** login API 返回的 2FA 临时令牌 */
  ticket: string;
  /** 用户邮箱（仅用于展示） */
  email: string;
  /** 验证成功回调，传入 LoginResponse 供 hook 完成解密 */
  onSuccess: (response: LoginResponse) => Promise<void>;
}

/** TOTP 验证码长度 */
const TOTP_CODE_LENGTH = 6;

export function TotpChallenge({ ticket, email, onSuccess }: TotpChallengeProps) {
  const [mode, setMode] = useState<'totp' | 'backup'>('totp');
  const [totpCode, setTotpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动聚焦输入框
  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  const submitVerify = useCallback(
    async (code: string, useBackupCode: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/auth/2fa/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticket, code, useBackupCode }),
        });

        if (!res.ok) {
          const err: ApiErrorResponse = await res.json();
          const msg = err.error ?? '验证码错误';
          setError(msg);
          toast.error(msg);
          // 清空输入，允许重试
          setTotpCode('');
          setBackupCode('');
          inputRef.current?.focus();
          return;
        }

        // 验证成功：交给父组件完成解密 + 跳转
        const data: LoginResponse = await res.json();
        await onSuccess(data);
      } catch {
        const msg = '网络错误，请稍后重试';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [ticket, onSuccess],
  );

  // TOTP 输入变化：仅允许数字，满 6 位自动提交
  const handleTotpChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, TOTP_CODE_LENGTH);
    setTotpCode(digits);
    if (digits.length === TOTP_CODE_LENGTH && !loading) {
      void submitVerify(digits, false);
    }
  };

  // 备用码提交
  const handleBackupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (backupCode.trim().length === 0 || loading) return;
    void submitVerify(backupCode.trim(), true);
  };

  const baseInputClass = 'text-center text-2xl tracking-[0.5em] font-mono';

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl">两步验证</CardTitle>
        <CardDescription>
          {mode === 'totp'
            ? `请输入验证器 App 中的 6 位验证码`
            : '请输入备用恢复码完成登录'}
          {email && (
            <span className="mt-1 block text-xs text-muted-foreground">{email}</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mode === 'totp' ? (
          <div className="space-y-4">
            {/* TOTP 验证码输入 */}
            <div className="relative">
              <Input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={TOTP_CODE_LENGTH}
                value={totpCode}
                onChange={(e) => handleTotpChange(e.target.value)}
                disabled={loading}
                placeholder="000000"
                className={baseInputClass}
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* 切换到备用码 */}
            <button
              type="button"
              onClick={() => {
                setMode('backup');
                setError(null);
                setTotpCode('');
              }}
              className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-primary hover:underline"
            >
              <KeyRound className="h-3.5 w-3.5" />
              使用备用恢复码
            </button>
          </div>
        ) : (
          <form onSubmit={handleBackupSubmit} className="space-y-4">
            {/* 备用恢复码输入 */}
            <Input
              ref={inputRef}
              type="text"
              autoComplete="off"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value)}
              disabled={loading}
              placeholder="输入备用恢复码"
            />

            {/* 错误提示 */}
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* 提交按钮 */}
            <Button type="submit" className="w-full" disabled={loading || backupCode.trim().length === 0}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              验证
            </Button>

            {/* 返回 TOTP 模式 */}
            <button
              type="button"
              onClick={() => {
                setMode('totp');
                setError(null);
                setBackupCode('');
              }}
              className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-primary hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回验证器验证码
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
