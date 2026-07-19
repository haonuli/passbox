/**
 * 密码库路由 loading 骨架屏 (UX-045)
 *
 * 路由切换或数据加载时展示与最终布局一致的占位骨架。
 */
import { VaultSkeleton } from './_components/vault-skeleton';

export default function VaultLoading() {
  return <VaultSkeleton />;
}
