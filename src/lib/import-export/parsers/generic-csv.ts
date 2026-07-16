/**
 * 通用 CSV 解析器（带列映射）
 *
 * 用户通过 ColumnMapping 手动指定 CSV 列与 PassBox 字段的对应关系。
 */
import Papa from 'papaparse';
import type { ImportItem, ColumnMapping } from '../types';

/** 允许映射的目标字段 */
const VALID_TARGET_FIELDS = new Set([
  'title',
  'username',
  'password',
  'url',
  'notes',
  'totpSecret',
]);

/**
 * 获取 CSV 文件的列名列表（用于 UI 展示映射界面）。
 *
 * @param csvContent CSV 原文
 * @returns 列名数组
 */
export function getCsvColumns(csvContent: string): string[] {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  return result.meta.fields ?? [];
}

/**
 * 根据用户提供的列映射，将 CSV 内容解析为 ImportItem[]。
 *
 * @param csvContent CSV 原文
 * @param mappings 列映射配置
 * @param itemType 导入条目类型，默认 'login'
 * @returns 归一化后的 ImportItem 数组
 */
export function parseGenericCsv(
  csvContent: string,
  mappings: ColumnMapping[],
  itemType: string = 'login',
): ImportItem[] {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = result.data ?? [];

  // 构建映射查找表：csvColumn -> targetField
  const mappingLookup = new Map<string, string>();
  for (const mapping of mappings) {
    if (mapping.targetField && VALID_TARGET_FIELDS.has(mapping.targetField)) {
      mappingLookup.set(mapping.csvColumn, mapping.targetField);
    }
  }

  return rows
    .map((row): ImportItem | null => {
      const fields: Record<string, string> = {};
      let title = '';

      for (const [csvColumn, targetField] of mappingLookup) {
        const value = (row[csvColumn] ?? '').trim();
        if (!value) continue;

        if (targetField === 'title') {
          title = value;
        } else {
          fields[targetField] = value;
        }
      }

      // 空行跳过
      if (!title && Object.keys(fields).length === 0) {
        return null;
      }

      return {
        title: title || '未命名条目',
        itemType,
        fields,
        favorite: false,
        tags: [],
      };
    })
    .filter((item): item is ImportItem => item !== null);
}
