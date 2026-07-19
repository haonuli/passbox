/**
 * 解锁表单 (T3.7)
 *
 * 会话有效但密钥未加载时，输入主密码重新派生密钥解锁。
 * 解锁成功后跳转到 redirect 参数指向的页面（默认 /vault）；
 * 会话过期时跳转 /login 重新登录。
 */
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Lock } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
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
import { useUnlock } from '@/hooks/use-unlock';
import { useAuthStore } from '@/stores/auth-store';
import { getSafeRedirect } from '@/lib/redirect';

const unlockSchema = z.object({
  masterPassword: z.string().min(1, '请输入主密码'),
});

type UnlockFormValues = z.infer<typeof unlockSchema>;

export function UnlockForm() {
  const { status, error, sessionExpired, unlock } = useUnlock();
  const user = useAuthStore((s) => s.user);
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

  const handleSwitchAccount = async () => {
    // 登出当前会话，返回登录页
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // 忽略网络错误，仍跳转登录页
    }
    useAuthStore.getState().logout();
    router.replace('/login');
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
          {user?.email ? (
            <>
              以 <span className="font-medium text-foreground">{user.email}</span> 登录
            </>
          ) : (
            '会话保持有效，输入主密码即可恢复访问'
          )}
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
                  <FormLabel htmlFor="unlock-password">主密码</FormLabel>
                  <FormControl>
                    <PasswordInput
                      id="unlock-password"
                      placeholder="输入主密码"
                      autoComplete="current-password"
                      disabled={isProcessing}
                      autoFocus
                      {...field}
                    />
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

            {/* 切换账号 */}
            {user?.email && (
              <p className="text-center text-sm text-muted-foreground">
                不是这个账号？{' '}
                <button
                  type="button"
                  onClick={handleSwitchAccount}
                  className="font-medium text-primary hover:underline"
                  disabled={isProcessing}
                >
                  切换账号
                </button>
              </p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
