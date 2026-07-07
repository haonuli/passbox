/**
 * 泄露密码检测 Hook (T6.6)
 *
 * 从 vault-store 读取已解密的 login 类型条目，自动检测密码泄露情况。
 * 基于 HIBP k-anonymity 协议，仅发送 SHA-1 前缀，不泄露完整密码。
 *
 * @see TASK_BREAKDOWN T6.6 验收标准
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useVaultStore } from '@/stores/vault-store';
import { checkItemsBreach, type BreachResult } from '@/lib/security/breach-check';

interface UseBreachCheckReturn {
  /** 泄露检测结果列表（仅包含已泄露或检测失败的条目） */
  results: BreachResult[];
  /** 是否正在检测 */
  loading: boolean;
  /** 错误信息（API 不可用时） */
  error: string | null;
  /** 重新检测 */
  refresh: () => void;
}

/**
 * 泄露密码检测 Hook。
 *
 * 自动从 vault-store 读取 login 类型且有密码的条目，
 * 调用 HIBP API 检测泄露情况。
 */
export function useBreachCheck(): UseBreachCheckReturn {
  const items = useVaultStore((s) => s.items);
  const loaded = useVaultStore((s) => s.loaded);

  const [results, setResults] = useState<BreachResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!loaded) return;

    let cancelled = false;

    (async () => {
      // 筛选 login 类型且有密码的条目
      const loginItems = items
        .filter((i) => i.itemTypeCode === 'login' && i.data.password)
        .map((i) => ({
          id: i.id,
          title: i.title,
          password: i.data.password!,
        }));

      if (loginItems.length === 0) {
        setResults([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const breachResults = await checkItemsBreach(loginItems);

        if (cancelled) return;

        // 检查是否有 API 不可用的情况
        const hasApiError = breachResults.some((r) => r.breachCount === -1);
        if (hasApiError && breachResults.every((r) => r.breachCount === -1)) {
          // 全部检测失败
          setError('暂时无法检测，请稍后重试');
          setResults([]);
        } else {
          // 只展示已泄露的条目（breachCount > 0）
          setResults(breachResults.filter((r) => r.breachCount > 0));
          if (hasApiError) {
            setError('部分密码暂时无法检测，请稍后重试');
          }
        }
      } catch {
        if (!cancelled) {
          setError('检测失败，请稍后重试');
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [items, loaded, refreshKey]);

  return { results, loading, error, refresh };
}
