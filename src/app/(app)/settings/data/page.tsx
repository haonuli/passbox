/**
 * 数据管理页
 *
 * Server Component 壳，渲染导入向导与导出区域。
 */
import { Database } from 'lucide-react';
import { ImportWizard } from './_components/import-wizard';
import { ExportSection } from './_components/export-section';

export default function DataSettingsPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Database className="h-4 w-4" />
          数据管理
        </h1>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-2xl space-y-8">
          <ImportWizard />
          <ExportSection />
        </div>
      </div>
    </div>
  );
}
