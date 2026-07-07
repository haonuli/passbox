/**
 * 恢复码重置主密码表单 (T3.8)
 *
 * react-hook-form + zod 校验，提交时调用 useRecover 执行两阶段恢复流程。
 * M-15：恢复成功后展示新恢复码（RecoveryCodeDisplay 组件）。
 */
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/password-input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { isValidRecoveryCodeFormat } from '@/lib/recovery-code';
import { useRecover } from '@/hooks/use-recover';
import { RecoveryCodeDisplay } from './recovery-code-display';

const recoverSchema = z
  .object({
    email: z.string().trim().min(1, '请输入邮箱地址').email('请输入有效的邮箱地址'),
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
  const { status, error, newRecoveryCode, recover } = useRecover();
  const form = useForm<RecoverFormValues>({
    resolver: zodResolver(recoverSchema),
    defaultValues: { email: '', recoveryCode: '', newMasterPassword: '', confirmPassword: '' },
  });

  // M-15：恢复成功 → 展示新恢复码
  if (status === 'success' && newRecoveryCode) {
    return <RecoveryCodeDisplay recoveryCode={newRecoveryCode} />;
  }

  const isProcessing = status === 'verifying' || status === 'deriving' || status === 'submitting';
  const statusText =
    status === 'verifying'
      ? '正在验证恢复码…'
      : status === 'deriving'
        ? '正在派生密钥…'
        : status === 'submitting'
          ? '正在重置主密码…'
          : '重置主密码';

  const onSubmit = async (values: RecoverFormValues) => {
    await recover(values.email, values.recoveryCode, values.newMasterPassword);
  };

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
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>邮箱地址</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="you@example.com" autoComplete="email" disabled={isProcessing} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="recoveryCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>恢复码</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="PBOX-XXXX-XXXX-XXXX-XXXX" autoComplete="off" disabled={isProcessing} className="font-mono" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newMasterPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>新主密码</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="至少 12 位，含大小写字母和数字" autoComplete="new-password" disabled={isProcessing} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>确认新主密码</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="再次输入新主密码" autoComplete="new-password" disabled={isProcessing} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {statusText}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              想起主密码了？{' '}
              <Link href="/login" className="font-medium text-primary hover:underline">
                返回登录
              </Link>
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
