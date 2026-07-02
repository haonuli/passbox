/**
 * 恢复码重置主密码表单 (T3.8)
 *
 * react-hook-form + zod 校验，提交时调用 useRecover 执行两阶段恢复流程：
 *   阶段一：验证恢复码 + 解密 Symmetric Key
 *   阶段二：新主密码重新加密 + 提交重置
 *
 * 成功后跳转 /vault（恢复后已自动登录）。
 *
 * 表单字段：
 *   - email：邮箱地址
 *   - recoveryCode：恢复码 PBOX-XXXX-XXXX-XXXX-XXXX
 *   - newMasterPassword：新主密码（≥12 位，含大小写+数字）
 *   - confirmPassword：确认新主密码
 */
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Eye, EyeOff, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { isValidRecoveryCodeFormat } from '@/lib/recovery-code';
import { useRecover } from '@/hooks/use-recover';

/** 恢复表单校验 schema（新主密码强度与注册一致） */
const recoverSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, '请输入邮箱地址')
      .email('请输入有效的邮箱地址'),
    recoveryCode: z
      .string()
      .trim()
      .min(1, '请输入恢复码')
      .refine(isValidRecoveryCodeFormat, '恢复码格式应为 PBOX-XXXX-XXXX-XXXX-XXXX'),
    newMasterPassword: z
      .string()
      .min(12, '主密码至少 12 位')
      .regex(/[a-z]/, '需包含小写字母')
      .regex(/[A-Z]/, '需包含大写字母')
      .regex(/\d/, '需包含数字'),
    confirmPassword: z.string().min(1, '请再次输入新主密码'),
  })
  .refine((data) => data.newMasterPassword === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

type RecoverFormValues = z.infer<typeof recoverSchema>;

export function RecoverForm() {
  const { status, error, recover } = useRecover();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  const form = useForm<RecoverFormValues>({
    resolver: zodResolver(recoverSchema),
    defaultValues: {
      email: '',
      recoveryCode: '',
      newMasterPassword: '',
      confirmPassword: '',
    },
  });

  // 恢复成功 → 跳转 /vault（已自动登录）
  useEffect(() => {
    if (status === 'success') {
      router.replace('/vault');
    }
  }, [status, router]);

  const onSubmit = async (values: RecoverFormValues) => {
    await recover(
      values.email,
      values.recoveryCode,
      values.newMasterPassword,
    );
  };

  const isProcessing =
    status === 'verifying' ||
    status === 'deriving' ||
    status === 'submitting';
  const statusText =
    status === 'verifying'
      ? '正在验证恢复码…'
      : status === 'deriving'
        ? '正在派生密钥…'
        : status === 'submitting'
          ? '正在重置主密码…'
          : '重置主密码';

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <KeyRound className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl">恢复账户</CardTitle>
        <CardDescription>
          输入邮箱与恢复码，设置新主密码。您的密码库数据将被完整保留。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* 邮箱 */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>邮箱地址</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      disabled={isProcessing}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 恢复码 */}
            <FormField
              control={form.control}
              name="recoveryCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>恢复码</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="PBOX-XXXX-XXXX-XXXX-XXXX"
                      autoComplete="off"
                      disabled={isProcessing}
                      className="font-mono"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 新主密码 */}
            <FormField
              control={form.control}
              name="newMasterPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>新主密码</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="至少 12 位，含大小写字母和数字"
                        autoComplete="new-password"
                        disabled={isProcessing}
                        className="pr-10"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                        aria-label={showPassword ? '隐藏密码' : '显示密码'}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 确认新主密码 */}
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>确认新主密码</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="再次输入新主密码"
                        autoComplete="new-password"
                        disabled={isProcessing}
                        className="pr-10"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                        aria-label={showConfirm ? '隐藏密码' : '显示密码'}
                      >
                        {showConfirm ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 错误提示 */}
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* 提交按钮 */}
            <Button type="submit" className="w-full" disabled={isProcessing}>
              {isProcessing && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {statusText}
            </Button>

            {/* 返回登录 */}
            <p className="text-center text-sm text-muted-foreground">
              想起主密码了？{' '}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                返回登录
              </Link>
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
