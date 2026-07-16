/**
 * CSV 导出器
 *
 * 将解密后的条目导出为通用 CSV 格式。
 * 使用 Papa.unparse 生成 CSV 字符串，调用方负责创建 Blob 下载。
 */
import Papa from 'papaparse';
import type { DecryptedItem } from '@/types/vault';

/** CSV 列定义 */
const CSV_COLUMNS = [
  'title',
  'itemType',
  'url',
  'username',
  'password',
  'totpSecret',
  'notes',
] as const;

/** CSV 行类型 */
type CsvRow = Record<(typeof CSV_COLUMNS)[number], string>;

/**
 * 将单个 DecryptedItem 转换为 CSV 行。
 */
function itemToRow(item: DecryptedItem): CsvRow {
  return {
    title: item.title,
    itemType: item.itemTypeCode,
    url: item.data.url ?? '',
    username: item.data.username ?? '',
    password: item.data.password ?? '',
    totpSecret: item.data.totpSecret ?? '',
    notes: item.data.notes ?? item.data.noteText ?? '',
  };
}

/**
 * 将解密后的条目列表导出为 CSV 字符串。
 *
 * CSV 列：title, itemType, url, username, password, totpSecret, notes
 *
 * @param items 解密后的条目列表
 * @returns CSV 字符串（含表头）
 */
export function exportToCsv(items: DecryptedItem[]): string {
  const rows = items.map(itemToRow);

  return Papa.unparse({
    fields: [...CSV_COLUMNS],
    data: rows.map((row) => [...CSV_COLUMNS].map((col) => row[col])),
  });
}
