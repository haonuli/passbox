/**
 * 注册页 (T3.5)
 *
 * Server Component 壳，使用 AuthSplitLayout 左右分栏布局渲染 RegisterForm。
 * 注册成功后表单内部切换为 Emergency Kit 展示。
 */
import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { RegisterForm } from './_components/register-form';

export default function RegisterPage() {
  return (
    <AuthSplitLayout>
      <RegisterForm />
    </AuthSplitLayout>
  );
}
