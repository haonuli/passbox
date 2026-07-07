/**
 * 密码生成器页面 (T5.1)
 *
 * Server Component 壳，渲染 GeneratorPanel 客户端组件。
 */
import { GeneratorPanel } from './_components/generator-panel';

export default function GeneratorPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h1 className="text-base font-semibold">密码生成器</h1>
      </div>
      <div className="flex-1 overflow-auto">
        <GeneratorPanel />
      </div>
    </div>
  );
}
