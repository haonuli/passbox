/**
 * 登录页 (T3.6)
 *
 * Server Component 壳，使用 AuthSplitLayout 左右分栏布局渲染 LoginForm。
 * useSearchParams 需 Suspense 包裹以满足 Next.js 预渲染要求。
 */
import { Suspense } from 'react';
import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { LoginForm } from './_components/login-form';

export default function LoginPage() {
  return (
    <AuthSplitLayout>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthSplitLayout>
  );
}
