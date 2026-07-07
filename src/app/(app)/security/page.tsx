/**
 * 安全中心页面 (T5.5)
 *
 * 当前阶段实现重复密码检测展示。
 * 完整安全仪表盘（弱密码/泄露检测/评分）在 T6.7 实现。
 *
 * Server Component 壳，渲染 SecurityView 客户端组件。
 */
import { SecurityView } from './_components/security-view';

export default function SecurityPage() {
  return <SecurityView />;
}
