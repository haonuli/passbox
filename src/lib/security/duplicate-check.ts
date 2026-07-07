/**
 * 重复密码检测模块 (T5.5)
 *
 * 遍历所有已解密的 login 类型条目，对密码计算 SHA-256 哈希，
 * 构建哈希到条目的映射，筛选出重复分组。
 * 全程在客户端本地完成，不向服务端发送密码或哈希（零知识）。
 *
 * @see TASK_BREAKDOWN T5.5 验收标准
 */
import type { DecryptedItem } from '@/types/vault';

/** 重复密码分组 */
export interface DuplicateGroup {
  /** SHA-256 哈希前 8 位（用于标识，不含完整哈希） */
  hashPrefix: string;
  /** 使用相同密码的条目列表 */
  items: DecryptedItem[];
}

/**
 * 计算 SHA-256 哈希（hex 格式）。
 */
async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 检测重复密码。
 *
 * @param items 已解密的条目列表
 * @returns 重复分组列表（每组包含 2+ 个使用相同密码的条目）
 */
export async function detectDuplicatePasswords(
  items: DecryptedItem[],
): Promise<DuplicateGroup[]> {
  // 筛选有密码的 login 类型条目
  const loginItems = items.filter(
    (i) => i.itemTypeCode === 'login' && i.data.password,
  );

  // 计算哈希并分组
  const hashMap = new Map<string, DecryptedItem[]>();
  for (const item of loginItems) {
    const password = item.data.password!;
    const hash = await sha256(password);
    const group = hashMap.get(hash);
    if (group) {
      group.push(item);
    } else {
      hashMap.set(hash, [item]);
    }
  }

  // 筛选出 2+ 个条目的分组
  const duplicates: DuplicateGroup[] = [];
  for (const [hash, group] of hashMap) {
    if (group.length >= 2) {
      duplicates.push({
        hashPrefix: hash.substring(0, 8),
        items: group,
      });
    }
  }

  return duplicates;
}
