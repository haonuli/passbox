/**
 * 安全设置页 (T6.1)
 *
 * Server Component 壳，渲染 TwoFactorSetup 客户端组件。
 */
import { TwoFactorSetup } from './_components/two-factor-setup';

export default function SecuritySettingsPage() {
  return <TwoFactorSetup />;
}
