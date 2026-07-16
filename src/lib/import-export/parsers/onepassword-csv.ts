/**
 * 1Password CSV 解析器
 *
 * 1Password CSV 导出以登录项为主，全部映射为 login 类型。
 * 列名大小写不敏感，支持多种列名变体。
 */
import Papa from 'papaparse';
import type { ImportItem } from '../types';

/**
 * 不区分大小写地从 CSV 行中查找列值。
 *
 * @param row CSV 解析后的行对象
 * @param possibleKeys 可能的列名（按优先级匹配）
 * @returns 第一个匹配到的列值（去除首尾空格），未匹配返回空字符串
 */
function getField(row: Record<string, string>, ...possibleKeys: string[]): string {
  const lowerRow: Record<string, string> = {};
  for (const key of Object.keys(row)) {
    lowerRow[key.toLowerCase()] = row[key];
  }
  for (const key of possibleKeys) {
    const value = lowerRow[key.toLowerCase()];
    if (value !== undefined && value !== null) {
      return value.trim();
    }
  }
  return '';
}

/**
 * 将 1Password 导出的 CSV 内容解析为 ImportItem[]。
 *
 * @param csvContent 1Password 导出的 CSV 原文
 * @returns 归一化后的 ImportItem 数组
 */
export function parseOnepasswordCsv(csvContent: string): ImportItem[] {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = result.data ?? [];

  return rows
    .map((row): ImportItem | null => {
      const title = getField(row, 'Title', 'Name');
      const url = getField(row, 'Url', 'Website', 'URL');
      const username = getField(row, 'Username', 'Email');
      const password = getField(row, 'Password');
      const notes = getField(row, 'Notes', 'Note');

      // 空行跳过
      if (!title && !url && !username && !password && !notes) {
        return null;
      }

      const fields: Record<string, string> = {};
      if (url) fields.url = url;
      if (username) fields.username = username;
      if (password) fields.password = password;
      if (notes) fields.notes = notes;

      return {
        title: title || '未命名条目',
        itemType: 'login',
        fields,
        favorite: false,
        tags: [],
      };
    })
    .filter((item): item is ImportItem => item !== null);
}
