/**
 * chrome.storage.session 包装
 *
 * 管理扩展缓存数据（symmetricKey + 解密的 vault 数据）。
 * chrome.storage.session 在浏览器关闭时自动清除。
 */
import type { ExtensionCache, ExtensionStatus } from '../types';

const CACHE_KEY = 'passbox_cache';
const STATUS_KEY = 'passbox_status';
const AUTO_LOCK_MINUTES = 30;

/** 获取缓存数据 */
export async function getCache(): Promise<ExtensionCache | null> {
  const result = await chrome.storage.session.get(CACHE_KEY);
  return (result[CACHE_KEY] as ExtensionCache | undefined) ?? null;
}

/** 保存缓存数据 */
export async function setCache(cache: ExtensionCache): Promise<void> {
  await chrome.storage.session.set({ [CACHE_KEY]: cache });
}

/** 清除缓存（锁定） */
export async function clearCache(): Promise<void> {
  await chrome.storage.session.remove(CACHE_KEY);
}

/** 获取扩展状态 */
export async function getStatus(): Promise<ExtensionStatus> {
  const result = await chrome.storage.session.get(STATUS_KEY);
  return (result[STATUS_KEY] as ExtensionStatus | undefined) ?? 'logged_out';
}

/** 设置扩展状态 */
export async function setStatus(status: ExtensionStatus): Promise<void> {
  await chrome.storage.session.set({ [STATUS_KEY]: status });
}

/** 检查是否需要自动锁定 */
export async function checkAutoLock(): Promise<boolean> {
  const cache = await getCache();
  if (!cache) return false;

  const elapsed = Date.now() - cache.lastUnlockAt;
  const limit = AUTO_LOCK_MINUTES * 60 * 1000;
  if (elapsed > limit) {
    await clearCache();
    await setStatus('locked');
    return true;
  }
  return false;
}

/** 更新最后活动时间 */
export async function touchActivity(): Promise<void> {
  const cache = await getCache();
  if (cache) {
    cache.lastUnlockAt = Date.now();
    await setCache(cache);
  }
}
