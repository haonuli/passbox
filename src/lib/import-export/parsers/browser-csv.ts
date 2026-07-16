/**
 * 浏览器 CSV 解析器（Chrome / Edge / Firefox 导出格式）
 *
 * CSV 列名：name, url, username, password（部分浏览器可能有 note 列）
 * 全部映射为 login 类型。
 */
import Papa from 'papaparse';
import type { ImportItem } from '../types';

/**
 * 将浏览器导出的 CSV 内容解析为 ImportItem[]。
 *
 * @param csvContent 浏览器导出的 CSV 原文
 * @returns 归一化后的 ImportItem 数组
 */
export function parseBrowserCsv(csvContent: string): ImportItem[] {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = result.data ?? [];

  return rows
    .map((row): ImportItem | null => {
      const title = (row.name ?? '').trim();
      const url = (row.url ?? '').trim();
      const username = (row.username ?? '').trim();
      const password = (row.password ?? '').trim();
      const notes = (row.note ?? '').trim();

      // 空行跳过
      if (!title && !url && !username && !password && !notes) {
        return null;
      }

      return {
        title: title || '未命名条目',
        itemType: 'login',
        fields: {
          url,
          username,
          password,
          ...(notes ? { notes } : {}),
        },
        favorite: false,
        tags: [],
      };
    })
    .filter(Boolean) as ImportItem[];
}
