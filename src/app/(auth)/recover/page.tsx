/**
 * 恢复账户页 (T3.8)
 *
 * Server Component 壳，渲染 RecoverForm。
 * 用户主密码丢失时通过恢复码重置主密码，恢复密码库数据访问。
 */
import { RecoverForm } from './_components/recover-form';

export default function RecoverPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <RecoverForm />
    </div>
  );
}
