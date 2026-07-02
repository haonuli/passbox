/**
 * 注册表单 (T3.5)
 *
 * react-hook-form + zod 校验，实时密码强度指示器，
 * 提交时调用 useRegister 执行客户端加密 + API 注册。
 * 注册成功后切换到 Emergency Kit 展示。
 */
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
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
import { useRegister } from '@/hooks/use-register';
import { StrengthIndicator } from './strength-indicator';
import { EmergencyKit } from './emergency-kit';

/** 注册表单校验 schema */
const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, '请输入邮箱地址')
      .email('请输入有效的邮箱地址'),
    masterPassword: z
      .string()
      .min(12, '主密码至少 12 位')
      .regex(/[a-z]/, '需包含小写字母')
      .regex(/[A-Z]/, '需包含大写字母')
      .regex(/\d/, '需包含数字'),
    confirmPassword: z.string().min(1, '请再次输入主密码'),
  })
  .refine((data) => data.masterPassword === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const { status, error, recoveryCode, user, register } = useRegister();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      masterPassword: '',
      confirmPassword: '',
    },
  });

  // 注册成功 → 展示 Emergency Kit
  if (status === 'success' && recoveryCode && user) {
    return (
      <EmergencyKit
        email={user.email}
        recoveryCode={recoveryCode}
        registeredAt={new Date().toISOString()}
      />
    );
  }

  const onSubmit = async (values: RegisterFormValues) => {
    await register(values.email, values.masterPassword);
  };

  const isProcessing = status === 'encrypting' || status === 'submitting';
  const statusText = status === 'encrypting' ? '正在加密…' : status === 'submitting' ? '正在提交…' : '创建账户';

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl">创建 passbox 账户</CardTitle>
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
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <StrengthIndicator password={field.value} />
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 确认密码 */}
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>确认主密码</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="再次输入主密码"
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
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {statusText}
            </Button>

            {/* 登录链接 */}
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
