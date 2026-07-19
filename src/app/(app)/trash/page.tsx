/**
 * 回收站页 (D-11)
 *
 * Server Component 壳，渲染 TrashView 客户端组件。
 * 展示已软删除的条目，支持恢复、彻底删除、清空回收站。
 */
import { Trash2 } from 'lucide-react';
import { TrashView } from './_components/trash-view';

export default function TrashPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Trash2 className="h-4 w-4" />
          回收站
        </h1>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-2xl">
          <TrashView />
        </div>
      </div>
    </div>
  );
}
