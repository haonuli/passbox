/**
 * 登录页 (T3.6)
 *
 * Server Component 壳，渲染 LoginForm。
 * useSearchParams 需 Suspense 包裹以满足 Next.js 预渲染要求。
 */
import { Suspense } from 'react';
import { LoginForm } from './_components/login-form';

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
