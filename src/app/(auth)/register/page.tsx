/**
 * 注册页 (T3.5)
 *
 * Server Component 壳，渲染 RegisterForm（Client Component）。
 * 注册成功后表单内部切换为 Emergency Kit 展示。
 */
import { RegisterForm } from './_components/register-form';

export default function RegisterPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <RegisterForm />
    </div>
  );
}
