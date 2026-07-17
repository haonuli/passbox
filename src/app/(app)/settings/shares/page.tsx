/**
 * 共享管理页
 *
 * Server Component 壳，渲染 ShareList 客户端组件。
 */
import { Share2 } from 'lucide-react';
import { ShareList } from './_components/share-list';

export default function SharesSettingsPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Share2 className="h-4 w-4" />
          共享管理
        </h1>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-2xl">
          <ShareList />
        </div>
      </div>
    </div>
  );
}
