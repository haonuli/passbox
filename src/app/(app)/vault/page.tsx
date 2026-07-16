/**
 * 密码库列表页 (T4.4)
 *
 * Server Component 壳，渲染 VaultView 客户端组件。
 * VaultView 使用 useSearchParams，需 Suspense 包裹。
 */
import { Suspense } from 'react';
import { VaultView } from './_components/vault-view';

export default function VaultPage() {
  return (
    <Suspense fallback={null}>
      <VaultView />
    </Suspense>
  );
}
