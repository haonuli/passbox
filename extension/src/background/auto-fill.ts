/**
 * 自动填充逻辑
 */
import * as vaultCache from './vault-cache';

/** 填充请求返回的凭证列表 */
export interface FillCredential {
  username: string;
  password: string;
}

/**
 * 处理填充请求
 *
 * 根据域名查找匹配的条目，返回 { username, password } 列表。
 * 无匹配返回 null。
 */
export async function handleFillRequest(domain: string): Promise<FillCredential[] | null> {
  const items = await vaultCache.findItemsByDomain(domain);

  if (items.length === 0) {
    return null;
  }

  return items
    .filter((item) => item.data.username && item.data.password)
    .map((item) => ({
      username: item.data.username ?? '',
      password: item.data.password ?? '',
    }));
}
