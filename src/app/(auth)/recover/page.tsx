/**
 * 恢复账户页 (T3.8)
 *
 * Server Component 壳，使用 AuthSplitLayout 左右分栏布局渲染 RecoverForm。
 * 用户主密码丢失时通过恢复码重置主密码，恢复密码库数据访问。
 */
import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { RecoverForm } from './_components/recover-form';

export default function RecoverPage() {
  return (
    <AuthSplitLayout>
      <RecoverForm />
    </AuthSplitLayout>
  );
}
