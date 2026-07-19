/**
 * 登录表单 (T3.6)
 *
 * react-hook-form + zod 校验，提交时调用 useLogin 执行
 * 客户端加密流程（prelogin → Argon2id → authHash → login → 解密 Symmetric Key）。
 * 登录成功后跳转到 redirect 参数指向的页面（默认 /vault）。
 */
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/password-input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useSrpLogin } from '@/hooks/use-srp-login';
import { getSafeRedirect } from '@/lib/redirect';
import { emailSchema, loginPasswordSchema } from '@/lib/validations';
import { TotpChallenge } from './totp-challenge';

/** 登录表单校验 schema */
const loginSchema = z.object({
  email: emailSchema,
  masterPassword: loginPasswordSchema,
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { status, error, errorType, login, totpChallenge, completeTotpChallenge } = useSrpLogin();
  const router = useRouter();
  const searchParams = useSearchParams();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: {
      email: '',
      masterPassword: '',
    },
  });

  // 登录成功 → 跳转到 redirect 参数或默认 /vault（M-2：校验防止开放重定向）
  useEffect(() => {
    if (status === 'success') {
      const redirect = getSafeRedirect(searchParams.get('redirect'));
      router.replace(redirect);
    }
  }, [status, searchParams, router]);

  // 2FA 挑战：密码已验证，渲染 TOTP 验证码输入组件
  if (status === 'totp_required' && totpChallenge) {
    return (
      <TotpChallenge
        ticket={totpChallenge.ticket}
        email={form.getValues('email')}
        onSuccess={completeTotpChallenge}
      />
    );
  }

  const onSubmit = async (values: LoginFormValues) => {
    await login(values.email, values.masterPassword);
  };

  const isProcessing = status === 'preloging' || status === 'deriving' || status === 'submitting';
  const statusText =
    status === 'preloging'
      ? '正在获取参数…'
      : status === 'deriving'
        ? '正在派生密钥…'
        : status === 'submitting'
          ? '正在验证…'
          : '登录';

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl">登录 PassBox</CardTitle>
        <CardDescription>
          零知识加密 · 您的主密码永远不会上传服务器
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
                  <FormLabel htmlFor="login-email">邮箱地址</FormLabel>
                  <FormControl>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      inputMode="email"
                      autoFocus
                      disabled={isProcessing}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 主密码 */}
            <FormField
              control={form.control}
              name="masterPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="login-password">主密码</FormLabel>
                  <FormControl>
                    <PasswordInput
                      id="login-password"
                      placeholder="输入主密码"
                      autoComplete="current-password"
                      disabled={isProcessing}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 忘记主密码 */}
            <div className="flex items-center justify-end gap-1.5 text-sm">
              <span className="text-xs text-muted-foreground" title="使用注册时生成的恢复码重置主密码">
                使用恢复码重置
              </span>
              <Link
                href="/recover"
                className="font-medium text-muted-foreground hover:text-primary hover:underline"
                title="使用恢复码重置主密码"
              >
                忘记主密码？
              </Link>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <p>{error}</p>
                {/* 根据错误类型显示恢复建议 */}
                {errorType === 'credentials' && (
                  <Link
                    href="/recover"
                    className="mt-1 inline-block font-medium text-destructive underline underline-offset-2 hover:opacity-80"
                  >
                    忘记主密码？
                  </Link>
                )}
                {errorType === 'network' && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    请检查网络连接后重试
                  </p>
                )}
                {errorType === 'server' && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    服务暂时不可用，请稍后重试
                  </p>
                )}
              </div>
            )}

            {/* 提交按钮 */}
            <Button type="submit" className="w-full" disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {statusText}
            </Button>

            {/* 注册链接 */}
            <p className="text-center text-sm text-muted-foreground">
              还没有账户？{' '}
              <Link href="/register" className="font-medium text-primary hover:underline">
                创建账户
              </Link>
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
