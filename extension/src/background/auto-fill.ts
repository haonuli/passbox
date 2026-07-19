/**
 * 自动填充逻辑
 */
import * as vaultCache from './vault-cache';
import type { FillIdentity, FillCard } from '../types';

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

/**
 * 处理身份信息填充请求
 *
 * 返回所有 identity 类型条目，由调用方自行选择。
 */
export async function handleFillIdentityRequest(): Promise<FillIdentity[]> {
  return await vaultCache.findAllIdentities();
}

/**
 * 处理信用卡填充请求
 *
 * 返回所有 credit_card 类型条目，由调用方自行选择。
 */
export async function handleFillCardRequest(): Promise<FillCard[]> {
  return await vaultCache.findAllCards();
}

