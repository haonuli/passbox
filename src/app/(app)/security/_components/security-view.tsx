/**
 * 安全中心主视图 (T5.5 / T6.6 / T6.7)
 *
 * 汇总展示安全评分 + 三类问题清单（弱密码、重复密码、泄露密码）。
 */
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Shield, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVaultStore } from '@/stores/vault-store';
import { detectDuplicatePasswords, type DuplicateGroup } from '@/lib/security/duplicate-check';
import { assessPassword } from '@/lib/crypto/strength';
import { DuplicateList } from './duplicate-list';
import { BreachList } from './breach-list';

export function SecurityView() {
  const items = useVaultStore((s) => s.items);
  const loaded = useVaultStore((s) => s.loaded);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

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
    return () => { cancelled = true; };
  }, [items, loaded]);

  // 弱密码检测
  const weakPasswords = useMemo(() => {
    return items
      .filter((i) => i.itemTypeCode === 'login' && i.data.password)
      .filter((i) => assessPassword(i.data.password!).label === 'weak')
      .map((i) => ({ id: i.id, title: i.title }));
  }, [items]);

  // 安全评分计算 (T6.7)
  const score = useMemo(() => {
    const totalItems = items.filter((i) => i.itemTypeCode === 'login' && i.data.password).length;
    if (totalItems === 0) return 100;

    const weakCount = weakPasswords.length;
    const dupCount = duplicates.reduce((sum, g) => sum + g.items.length, 0);

    // 每个问题扣分，最低 0
    const deduction = Math.min(100, weakCount * 10 + dupCount * 5);
    return Math.max(0, 100 - deduction);
  }, [items, weakPasswords, duplicates]);

  const scoreColor = score > 80 ? 'text-green-500' : score >= 60 ? 'text-yellow-500' : 'text-red-500';
  const scoreBg = score > 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500';

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
          {/* 安全评分 (T6.7) */}
          <div className="rounded-lg border border-border p-6 text-center">
            <div className="text-xs text-muted-foreground">总体安全评分</div>
            <div className={cn('mt-2 text-5xl font-bold tabular-nums', scoreColor)}>{score}</div>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full transition-all', scoreBg)} style={{ width: `${score}%` }} />
            </div>
            {score === 100 ? (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-green-500">
                <ShieldCheck className="h-4 w-4" />
                你的密码库很安全
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                发现 {weakPasswords.length + duplicates.reduce((s, g) => s + g.items.length, 0)} 个安全问题
              </p>
            )}
          </div>

          {/* 弱密码清单 */}
          <section>
            <button
              onClick={() => setExpandedSection(expandedSection === 'weak' ? null : 'weak')}
              className="flex w-full items-center justify-between border-b border-border pb-2"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                弱密码
                {weakPasswords.length > 0 && (
                  <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-600">
                    {weakPasswords.length}
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {weakPasswords.length > 0 ? '立即处理' : '无问题'}
              </span>
            </button>
            {expandedSection === 'weak' && (
              <div className="mt-2 space-y-1">
                {weakPasswords.length === 0 ? (
                  <div className="flex items-center gap-2 p-3">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">未发现弱密码</span>
                  </div>
                ) : (
                  weakPasswords.map((item) => (
                    <a
                      key={item.id}
                      href={`/items/${item.id}/edit`}
                      className="block rounded p-2 text-sm hover:bg-muted/50"
                    >
                      {item.title}
                    </a>
                  ))
                )}
              </div>
            )}
          </section>

          {/* 重复密码清单 (T5.5) */}
          <section>
            <button
              onClick={() => setExpandedSection(expandedSection === 'duplicate' ? null : 'duplicate')}
              className="flex w-full items-center justify-between border-b border-border pb-2"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                重复密码
                {duplicates.length > 0 && (
                  <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-600">
                    {duplicates.reduce((s, g) => s + g.items.length, 0)}
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {duplicates.length > 0 ? '立即处理' : '无问题'}
              </span>
            </button>
            {expandedSection === 'duplicate' && (
              <div className="mt-2">
                <DuplicateList duplicates={duplicates} loading={loading} />
              </div>
            )}
          </section>

          {/* 泄露密码清单 (T6.6) */}
          <section>
            <button
              onClick={() => setExpandedSection(expandedSection === 'breach' ? null : 'breach')}
              className="flex w-full items-center justify-between border-b border-border pb-2"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                泄露密码
              </span>
              <span className="text-xs text-muted-foreground">检测</span>
            </button>
            {expandedSection === 'breach' && (
              <div className="mt-2">
                <BreachList />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
