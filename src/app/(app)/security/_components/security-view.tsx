/**
 * 安全中心主视图 (T5.5)
 *
 * 客户端组件，检测重复密码并展示。
 * 完整安全仪表盘（弱密码/泄露检测/评分）在 T6.7 实现。
 */
'use client';

import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { useVaultStore } from '@/stores/vault-store';
import { detectDuplicatePasswords, type DuplicateGroup } from '@/lib/security/duplicate-check';
import { DuplicateList } from './duplicate-list';

export function SecurityView() {
  const items = useVaultStore((s) => s.items);
  const loaded = useVaultStore((s) => s.loaded);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loaded) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await detectDuplicatePasswords(items);
      if (!cancelled) {
        setDuplicates(result);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [items, loaded]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <Shield className="h-4 w-4" />
          安全中心
        </h1>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-2xl space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold">重复密码检测</h2>
            <DuplicateList duplicates={duplicates} loading={loading} />
          </section>
          <p className="text-xs text-muted-foreground">
            完整安全分析（弱密码检测、泄露密码检测、安全评分）将在后续版本中提供。
          </p>
        </div>
      </div>
    </div>
  );
}
