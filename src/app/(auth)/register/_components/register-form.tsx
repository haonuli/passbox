/**
 * 注册表单 (T3.5)
 *
 * react-hook-form + zod 校验，实时密码强度指示器，
 * 提交时调用 useRegister 执行客户端加密 + API 注册。
 * 注册成功后切换到 Emergency Kit 展示。
 */
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/password-input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useRegister } from '@/hooks/use-register';
import { emailSchema, passwordSchema } from '@/lib/validations';
import { EmergencyKit } from './emergency-kit';

// zxcvbn-ts 在 SSR 时会尝试读取文件系统中的字典文件导致 500 错误，
// 使用 dynamic + ssr:false 确保仅在客户端加载
const StrengthIndicator = dynamic(
  () => import('@/components/common/strength-indicator').then((m) => m.StrengthIndicator),
  { ssr: false },
);

/** 注册表单校验 schema */
const registerSchema = z
  .object({
    email: emailSchema,
    masterPassword: passwordSchema,
    confirmPassword: z.string().min(1, '请再次输入主密码'),
  })
  .refine((data) => data.masterPassword === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const { status, error, recoveryCode, user, register } = useRegister();
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: { email: '', masterPassword: '', confirmPassword: '' },
  });

  // 注册成功 → 展示 Emergency Kit
  if (status === 'success' && recoveryCode && user) {
    return <EmergencyKit email={user.email} recoveryCode={recoveryCode} registeredAt={new Date().toISOString()} />;
  }

  const onSubmit = async (values: RegisterFormValues) => {
    await register(values.email, values.masterPassword);
  };

  const isProcessing = status === 'deriving' || status === 'encrypting' || status === 'submitting';
  const statusText =
    status === 'deriving'
      ? '正在派生主密钥…'
      : status === 'encrypting'
        ? '正在加密密钥…'
        : status === 'submitting'
          ? '正在提交…'
          : '创建账户';

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl">创建 PassBox 账户</CardTitle>
        <CardDescription>零知识加密 · 您的主密码永远不会上传服务器</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="register-email">邮箱地址</FormLabel>
                  <FormControl>
                    <Input id="register-email" type="email" placeholder="you@example.com" autoComplete="email" inputMode="email" autoFocus disabled={isProcessing} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="masterPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="register-password">主密码</FormLabel>
                  <FormControl>
                    <PasswordInput id="register-password" placeholder="至少 12 位，含大小写字母和数字" autoComplete="new-password" disabled={isProcessing} {...field} />
                  </FormControl>
                  <StrengthIndicator password={field.value} />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="register-confirm-password">确认主密码</FormLabel>
                  <FormControl>
                    <PasswordInput id="register-confirm-password" placeholder="再次输入主密码" autoComplete="new-password" disabled={isProcessing} {...field} />
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
              已有账户？{' '}
              <Link href="/login" className="font-medium text-primary hover:underline">
                立即登录
              </Link>
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
