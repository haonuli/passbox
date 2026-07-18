/**
 * SSH 密钥管理页
 *
 * Server Component 壳，渲染 SshKeysView 客户端组件。
 */
import { SshKeysView } from './_components/ssh-keys-view';

export default function SshKeysSettingsPage() {
  return <SshKeysView />;
}
