/**
 * 归一化与查重模块
 *
 * 导入时检测待导入条目与已有条目的重复，辅助用户决定导入策略。
 * 查重规则：title（忽略大小写 + 去空格）+ username（忽略大小写 + 去空格）同时匹配则判定为重复。
 */
import { ITEM_TYPE_CONFIGS } from '@/lib/item-types';
import type { DecryptedItem } from '@/types/vault';
import type { DuplicateMatch, ImportItem } from './types';

/**
 * 根据条目类型 code 查找对应的数据库 ID。
 *
 * @param code 条目类型代码（如 'login', 'secure_note'）
 * @returns 类型 ID；未找到时抛出 Error
 */
export function getItemTypeIdByCode(code: string): number {
  const config = ITEM_TYPE_CONFIGS.find((t) => t.code === code);
  if (!config) {
    throw new Error(`未知的条目类型代码: ${code}`);
  }
  return config.id;
}

/**
 * 规范化字符串用于比对：小写 + 去除首尾空格。
 */
function normalizeForKey(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * 检测导入条目与已有条目之间的重复。
 *
 * 查重算法：比对 title（normalize）+ username（normalize，从 importItem.fields.username 获取）。
 * 两者都匹配时标记为重复。
 *
 * 默认 action：
 *   - 重复项 -> 'skip'
 *   - 非重复项 -> 'import'
 *
 * @param importItems 待导入的条目列表
 * @param existingItems 当前密码库中已有的条目列表
 * @returns 查重结果数组，与 importItems 一一对应
 */
export function detectDuplicates(
  importItems: ImportItem[],
  existingItems: DecryptedItem[],
): DuplicateMatch[] {
  // 预构建已有条目的查找索引：key = normalizedTitle + '\0' + normalizedUsername
  const existingIndex = new Map<string, DecryptedItem>();
  for (const item of existingItems) {
    const titleKey = normalizeForKey(item.title);
    const usernameKey = normalizeForKey(item.data.username);
    const key = `${titleKey}\0${usernameKey}`;
    // 首次出现优先；后续重复条目忽略
    if (!existingIndex.has(key)) {
      existingIndex.set(key, item);
    }
  }

  return importItems.map((importItem): DuplicateMatch => {
    const titleKey = normalizeForKey(importItem.title);
    const usernameKey = normalizeForKey(importItem.fields.username);
    const key = `${titleKey}\0${usernameKey}`;

    const existingItem = existingIndex.get(key);
    const isDuplicate = existingItem !== undefined;

    return {
      importItem,
      existingItem: isDuplicate ? existingItem : undefined,
      isDuplicate,
      action: isDuplicate ? 'skip' : 'import',
    };
  });
}
