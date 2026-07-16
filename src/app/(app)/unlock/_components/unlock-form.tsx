/**
 * 解锁表单 (T3.7)
 *
 * 会话有效但密钥未加载时，输入主密码重新派生密钥解锁。
 * 解锁成功后跳转到 redirect 参数指向的页面（默认 /vault）；
 * 会话过期时跳转 /login 重新登录。
 */
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Eye, EyeOff, Lock } from 'lucide-react';
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
import { useUnlock } from '@/hooks/use-unlock';
import { getSafeRedirect } from '@/lib/redirect';

const unlockSchema = z.object({
  masterPassword: z.string().min(1, '请输入主密码'),
});

type UnlockFormValues = z.infer<typeof unlockSchema>;

export function UnlockForm() {
  const { status, error, sessionExpired, unlock } = useUnlock();
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const form = useForm<UnlockFormValues>({
    resolver: zodResolver(unlockSchema),
    mode: 'onBlur',
    defaultValues: { masterPassword: '' },
  });

  // 解锁成功 → 跳转到 redirect 参数或默认 /vault（M-2：校验防止开放重定向）
  useEffect(() => {
    if (status === 'success') {
      const redirect = getSafeRedirect(searchParams.get('redirect'));
      router.replace(redirect);
    }
  }, [status, searchParams, router]);

  // 会话过期 → 跳转登录页（透传 redirect，登录后回到原页面）
  useEffect(() => {
    if (sessionExpired) {
      const redirect = getSafeRedirect(searchParams.get('redirect'));
      const loginUrl = redirect === '/vault' ? '/login' : `/login?redirect=${encodeURIComponent(redirect)}`;
      router.replace(loginUrl);
    }
  }, [sessionExpired, searchParams, router]);

  const onSubmit = async (values: UnlockFormValues) => {
    await unlock(values.masterPassword);
  };

  const isProcessing = status === 'fetching' || status === 'deriving';
  const statusText =
    status === 'fetching' ? '正在获取参数…' : status === 'deriving' ? '正在派生密钥…' : '解锁';

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <CardTitle className="text-2xl">解锁密码库</CardTitle>
        <CardDescription>
          会话保持有效，输入主密码即可恢复访问
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        autoFocus
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
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
