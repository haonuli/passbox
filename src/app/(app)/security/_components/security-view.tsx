/**
 * 安全中心主视图 (T5.5 / T6.6 / T6.7)
 *
 * 汇总展示安全评分 + 三类问题清单（弱密码、重复密码、泄露密码）。
 */
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Shield, ShieldCheck, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useVaultStore } from '@/stores/vault-store';
import { detectDuplicatePasswords, type DuplicateGroup } from '@/lib/security/duplicate-check';
import { getExpiryCount } from '@/lib/security/expiry-check';
import { assessPassword } from '@/lib/crypto/strength';
import { DuplicateList } from './duplicate-list';
import { BreachList } from './breach-list';
import { ExpiryList } from './expiry-list';

const PREV_SCORE_KEY = 'passbox:security-score:prev';

export function SecurityView() {
  const items = useVaultStore((s) => s.items);
  const loaded = useVaultStore((s) => s.loaded);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [weakPasswords, setWeakPasswords] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // 并行检测重复密码和弱密码（assessPassword 为异步）
      const [dupResult, weakResult] = await Promise.all([
        detectDuplicatePasswords(items),
        (async () => {
          const loginItems = items.filter((i) => i.itemTypeCode === 'login' && i.data.password);
          const weak: { id: string; title: string }[] = [];
          // 逐个评估密码强度
          for (const item of loginItems) {
            const assessment = await assessPassword(item.data.password!);
            if (assessment.label === 'weak') {
              weak.push({ id: item.id, title: item.title });
            }
          }
          return weak;
        })(),
      ]);
      if (!cancelled) {
        setDuplicates(dupResult);
        setWeakPasswords(weakResult);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [items, loaded]);

  // 安全评分计算 (T6.7)
  const score = useMemo(() => {
    const totalItems = items.filter((i) => i.itemTypeCode === 'login' && i.data.password).length;
    if (totalItems === 0) return 100;

    const weakCount = weakPasswords.length;
    const dupCount = duplicates.reduce((sum, g) => sum + g.items.length, 0);
    const expiryCount = getExpiryCount(items);

    // 每个问题扣分，最低 0
    const deduction = Math.min(100, weakCount * 10 + dupCount * 5 + expiryCount * 5);
    return Math.max(0, 100 - deduction);
  }, [items, weakPasswords, duplicates]);

  // DESIGN.md 语义色：success #0070f3 / warning #f5a623 / error #ee0000
  const scoreColor = score > 80 ? 'text-success' : score >= 60 ? 'text-warning' : 'text-destructive';
  const scoreBg = score > 80 ? 'bg-success' : score >= 60 ? 'bg-warning' : 'bg-destructive';

  // 评分改善提示（UX-011 AC4）：编辑返回后若评分提升，显示 toast
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      sessionStorage.setItem(PREV_SCORE_KEY, String(score));
      return;
    }
    const prevStr = sessionStorage.getItem(PREV_SCORE_KEY);
    if (prevStr !== null) {
      const prev = Number(prevStr);
      if (!Number.isNaN(prev) && score > prev) {
        toast.success(`安全评分已改善 ↑ ${score}`, {
          description: `较上次提升 ${score - prev} 分`,
        });
      }
    }
    sessionStorage.setItem(PREV_SCORE_KEY, String(score));
  }, [score, loading]);

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
          <div className="rounded-md border border-border bg-card p-6 text-center shadow-stack-2">
            <div className="text-xs text-muted-foreground">总体安全评分</div>
            <div className={cn('mt-2 text-5xl font-semibold tabular-nums tracking-tighter', scoreColor)}>{score}</div>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full transition-all', scoreBg)} style={{ width: `${score}%` }} />
            </div>
            {score === 100 ? (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-success">
                <ShieldCheck className="h-4 w-4" />
                你的密码库很安全
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                发现 {weakPasswords.length + duplicates.reduce((s, g) => s + g.items.length, 0) + getExpiryCount(items)} 个安全问题
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
                <AlertTriangle className="h-4 w-4 text-warning" />
                弱密码
                {weakPasswords.length > 0 && (
                  <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">
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
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-sm">未发现弱密码</span>
                  </div>
                ) : (
                  weakPasswords.map((item) => (
                    <a
                      key={item.id}
                      href={`/items/${item.id}/edit`}
                      className="block rounded-sm p-2 text-sm hover:bg-muted/50"
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
                <AlertTriangle className="h-4 w-4 text-warning" />
                重复密码
                {duplicates.length > 0 && (
                  <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">
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
                <AlertTriangle className="h-4 w-4 text-destructive" />
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

          {/* 过期条目清单 */}
          <section>
            <button
              onClick={() => setExpandedSection(expandedSection === 'expiry' ? null : 'expiry')}
              className="flex w-full items-center justify-between border-b border-border pb-2"
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-warning" />
                过期提醒
                {getExpiryCount(items) > 0 && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                    {getExpiryCount(items)}
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {getExpiryCount(items) > 0 ? '需处理' : '无问题'}
              </span>
            </button>
            {expandedSection === 'expiry' && (
              <div className="mt-2">
                <ExpiryList items={items} />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
