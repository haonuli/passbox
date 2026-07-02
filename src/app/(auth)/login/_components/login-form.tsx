/**
 * 登录表单 (T3.6)
 *
 * react-hook-form + zod 校验，提交时调用 useLogin 执行
 * 客户端加密流程（prelogin → Argon2id → authHash → login → 解密 Symmetric Key）。
 * 登录成功后跳转到 redirect 参数指向的页面（默认 /vault）。
 */
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useLogin } from '@/hooks/use-login';
import { getSafeRedirect } from '@/lib/redirect';

/** 登录表单校验 schema（主密码仅需非空，强度校验在注册阶段完成） */
const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, '请输入邮箱地址')
    .email('请输入有效的邮箱地址'),
  masterPassword: z.string().min(1, '请输入主密码'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { status, error, login } = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
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
        <CardTitle className="text-2xl">登录 passbox</CardTitle>
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

            {/* 主密码 */}
            <FormField
              control={form.control}
              name="masterPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>主密码</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="输入主密码"
                        autoComplete="current-password"
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
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 忘记主密码 */}
            <div className="text-right">
              <Link
                href="/recover"
                className="text-sm text-muted-foreground hover:text-primary hover:underline"
              >
                忘记主密码？
              </Link>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
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
