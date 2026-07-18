/**
 * 自动保存逻辑
 */
import * as vaultCache from './vault-cache';
import type { SaveItemResult } from './vault-cache';

/**
 * 处理保存检测请求
 *
 * 调用 vault-cache.saveItem 保存凭证，返回操作结果。
 */
export async function handleSaveDetected(
  domain: string,
  username: string,
  password: string,
): Promise<SaveItemResult> {
  return vaultCache.saveItem(domain, username, password);
}
