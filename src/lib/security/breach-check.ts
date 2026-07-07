/**
 * 泄露密码检测模块 (T6.6)
 *
 * 基于 HIBP (Have I Been Pwned) k-anonymity 协议检测密码是否已泄露：
 * 1. 对密码计算 SHA-1 哈希（大写 hex）
 * 2. 取前 5 位前缀，请求 HIBP API: GET https://api.pwnedpasswords.com/range/{prefix}
 * 3. 客户端本地比对返回的哈希后缀列表
 *
 * k-anonymity 保证：只发送前 5 位前缀，不泄露完整哈希。
 * 相同前缀的密码批量查询（一次 API 调用覆盖多个密码）。
 *
 * @see TASK_BREAKDOWN T6.6 验收标准
 */

/** 单个条目的泄露检测结果 */
export interface BreachResult {
  itemId: string;
  title: string;
  breachCount: number;
}

/** HIBP API 基础地址 */
const HIBP_API_BASE = 'https://api.pwnedpasswords.com/range/';

/** 请求超时时间（毫秒） */
const REQUEST_TIMEOUT_MS = 10_000;

/** SHA-1 前缀长度（k-anonymity 协议固定 5 位） */
const SHA1_PREFIX_LENGTH = 5;

/**
 * 计算字符串的 SHA-1 哈希，返回大写 hex 字符串。
 */
async function sha1Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * 请求 HIBP API，返回指定前缀下所有泄露哈希后缀及次数的映射。
 *
 * @param prefix SHA-1 哈希前 5 位（大写 hex）
 * @returns 后缀 → 泄露次数 映射；请求失败时返回 null
 */
async function fetchBreachRange(
  prefix: string,
): Promise<Map<string, number> | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(`${HIBP_API_BASE}${prefix}`, {
      signal: controller.signal,
      headers: { 'Add-Padding': 'true' },
    });

    if (!response.ok) {
      return null;
    }

    const text = await response.text();
    const map = new Map<string, number>();

    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;

      const suffix = trimmed.substring(0, colonIndex).toUpperCase();
      const countStr = trimmed.substring(colonIndex + 1);
      const count = parseInt(countStr, 10);

      if (!Number.isNaN(count)) {
        map.set(suffix, count);
      }
    }

    return map;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 检测单个密码的泄露次数。
 *
 * @param password 明文密码
 * @returns 泄露次数（0 表示未泄露）；-1 表示暂时无法检测
 */
export async function checkPasswordBreach(password: string): Promise<number> {
  const hash = await sha1Hex(password);
  const prefix = hash.substring(0, SHA1_PREFIX_LENGTH);
  const suffix = hash.substring(SHA1_PREFIX_LENGTH);

  const rangeMap = await fetchBreachRange(prefix);
  if (rangeMap === null) {
    return -1;
  }

  return rangeMap.get(suffix) ?? 0;
}

/**
 * 批量检测多个条目的密码泄露情况。
 *
 * 利用 k-anonymity 协议对相同 SHA-1 前缀的密码合并请求，
 * 一次 API 调用即可覆盖多个密码。
 *
 * @param items 待检测的条目列表（须包含 id、title、password）
 * @returns 每个条目的泄露检测结果（breachCount 为 -1 表示检测失败）
 */
export async function checkItemsBreach(
  items: Array<{ id: string; title: string; password: string }>,
): Promise<BreachResult[]> {
  if (items.length === 0) {
    return [];
  }

  // 计算每个条目的 SHA-1 哈希（每个密码只计算一次）
  const hashedItems = await Promise.all(
    items.map(async (item) => {
      const hash = await sha1Hex(item.password);
      return {
        itemId: item.id,
        title: item.title,
        prefix: hash.substring(0, SHA1_PREFIX_LENGTH),
        suffix: hash.substring(SHA1_PREFIX_LENGTH),
      };
    }),
  );

  // 按前缀分组，相同前缀只请求一次 API
  const prefixGroups = new Map<string, Array<{ itemId: string; title: string; suffix: string }>>();
  for (const item of hashedItems) {
    const group = prefixGroups.get(item.prefix);
    if (group) {
      group.push({ itemId: item.itemId, title: item.title, suffix: item.suffix });
    } else {
      prefixGroups.set(item.prefix, [
        { itemId: item.itemId, title: item.title, suffix: item.suffix },
      ]);
    }
  }

  // 并发请求各前缀的泄露数据
  const results: BreachResult[] = [];
  const prefixEntries = Array.from(prefixGroups.entries());

  const rangeResults = await Promise.all(
    prefixEntries.map(async ([prefix, group]) => {
      const rangeMap = await fetchBreachRange(prefix);
      return { group, rangeMap };
    }),
  );

  for (const { group, rangeMap } of rangeResults) {
    for (const item of group) {
      const count = rangeMap?.get(item.suffix) ?? (rangeMap === null ? -1 : 0);
      results.push({
        itemId: item.itemId,
        title: item.title,
        breachCount: count,
      });
    }
  }

  return results;
}
