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
 * 列名自动识别规则（按精确匹配 → 模糊匹配顺序排列）。
 * 顺序很重要：先尝试精确匹配，后做模糊匹配。
 */
const COLUMN_NAME_PATTERNS: ReadonlyArray<{ pattern: RegExp; target: string }> = [
  // 标题（精确）
  { pattern: /^(title|name|label|entry|item|name_of_site|site_name)$/i, target: 'title' },
  // 用户名（精确）
  { pattern: /^(user|username|login|account|account_name|user_id|userid|email|mail|e-mail)$/i, target: 'username' },
  // 密码（精确）
  { pattern: /^(password|pass|pwd|passwd|secret|passcode)$/i, target: 'password' },
  // 网址（精确）
  { pattern: /^(url|uri|website|site|link|domain|web|origin|href|hostname|web_site|web_url)$/i, target: 'url' },
  // 备注（精确）
  { pattern: /^(notes|note|comment|comments|description|desc|memo|remarks|remark)$/i, target: 'notes' },
  // TOTP（精确）
  { pattern: /^(totp|otp|totp_secret|otp_secret|secret_key|two_factor|2fa|otpauth)$/i, target: 'totpSecret' },
  // 模糊匹配
  { pattern: /(title|name|label)/i, target: 'title' },
  { pattern: /(user|login|account|email)/i, target: 'username' },
  { pattern: /(pass|pwd|secret)/i, target: 'password' },
  { pattern: /(url|website|site|link|domain)/i, target: 'url' },
  { pattern: /(note|comment|description|memo|remark)/i, target: 'notes' },
  { pattern: /(totp|otp|2fa)/i, target: 'totpSecret' },
];

/**
 * 根据列名自动识别建议的目标字段。
 *
 * @param column CSV 列名
 * @returns 建议的目标字段名；未识别返回 null
 */
export function suggestColumnMapping(column: string): string | null {
  const trimmed = column.trim();
  if (!trimmed) return null;
  for (const { pattern, target } of COLUMN_NAME_PATTERNS) {
    if (pattern.test(trimmed)) return target;
  }
  return null;
}

/**
 * 为一组 CSV 列名生成自动识别映射建议。
 *
 * 冲突处理：若多列命中同一目标字段，保留第一列（按 columns 顺序）。
 *
 * @param columns CSV 列名数组
 * @returns 列名 -> 目标字段 的映射（仅包含已识别的列）
 */
export function suggestColumnMappings(columns: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const claimedTargets = new Set<string>();
  for (const col of columns) {
    const target = suggestColumnMapping(col);
    if (target && !claimedTargets.has(target)) {
      result[col] = target;
      claimedTargets.add(target);
    }
  }
  return result;
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
