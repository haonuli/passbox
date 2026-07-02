/**
 * 解锁页 (T3.7)
 *
 * 会话有效但密钥未加载（手动锁定 / 自动锁定 / 页面刷新）时展示。
 * useSearchParams 需 Suspense 包裹以满足 Next.js 预渲染要求。
 */
import { Suspense } from 'react';
import { UnlockForm } from './_components/unlock-form';

export default function UnlockPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <Suspense fallback={null}>
        <UnlockForm />
      </Suspense>
    </div>
  );
}
