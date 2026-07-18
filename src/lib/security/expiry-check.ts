/**
 * 过期条目检测模块
 *
 * 遍历所有条目，根据条目类型提取过期字段并计算剩余天数：
 * - credit_card -> data.expiry（MM/YY 格式，解析为当月最后一天）
 * - software_license -> data.expiration（ISO date string）
 * - driver_license -> data.expiryDate（ISO date string）
 * - passport -> data.expiryDate（ISO date string）
 *
 * 状态判定：expired（已过期）/ soon（30 天内）/ upcoming（90 天内）。
 * 超过 90 天的条目不返回。结果按剩余天数升序排列。
 */
import type { DecryptedItem } from '@/types/vault';

/** 过期检测结果 */
export interface ExpiryCheckResult {
  item: DecryptedItem;
  expiryDate: Date;
  daysRemaining: number;
  status: 'expired' | 'soon' | 'upcoming';
}

/** soon 状态阈值（含） */
const SOON_DAYS = 30;
/** upcoming 状态阈值（含） */
const UPCOMING_DAYS = 90;
/** 毫秒/天 */
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * 根据条目类型获取过期字段值。
 * 不支持过期检测的类型返回 undefined。
 */
function getExpiryFieldValue(item: DecryptedItem): string | undefined {
  switch (item.itemTypeCode) {
    case 'credit_card':
      return item.data.expiry;
    case 'software_license':
      return item.data.expiration;
    case 'driver_license':
    case 'passport':
      return item.data.expiryDate;
    default:
      return undefined;
  }
}

/**
 * 解析 MM/YY 格式日期，返回当月最后一天的 Date。
 * 无效时返回 null。
 *
 * @param value MM/YY 格式字符串（如 "08/26"）
 */
function parseMMYY(value: string): Date | null {
  const parts = value.split('/');
  if (parts.length !== 2) return null;

  const month = parseInt(parts[0], 10);
  const yearShort = parseInt(parts[1], 10);

  if (Number.isNaN(month) || Number.isNaN(yearShort)) return null;
  if (month < 1 || month > 12) return null;

  const year = 2000 + yearShort;
  // new Date(year, month, 0) 返回 month（1-based）的最后一天
  return new Date(year, month, 0);
}

/**
 * 解析 ISO 日期字符串。
 * 无效时返回 null。
 */
function parseISODate(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/**
 * 根据条目类型解析过期日期。
 */
function getExpiryDate(item: DecryptedItem): Date | null {
  const value = getExpiryFieldValue(item);
  if (value === undefined || value.trim() === '') return null;

  if (item.itemTypeCode === 'credit_card') {
    return parseMMYY(value);
  }
  return parseISODate(value);
}

/**
 * 计算剩余天数（向上取整）。
 */
function calculateDaysRemaining(expiryDate: Date, now: Date): number {
  return Math.ceil((expiryDate.getTime() - now.getTime()) / MS_PER_DAY);
}

/**
 * 根据剩余天数判定状态。
 */
function getStatus(daysRemaining: number): ExpiryCheckResult['status'] {
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= SOON_DAYS) return 'soon';
  return 'upcoming';
}

/**
 * 检测过期条目。
 *
 * 遍历 items，提取过期日期并计算剩余天数。
 * 过滤掉无过期字段或解析失败的条目，以及超过 90 天的条目。
 * 结果按 daysRemaining 升序排列（最紧急的排最前）。
 *
 * @param items 已解密的条目列表
 * @returns 过期检测结果列表
 */
export function checkExpiry(items: DecryptedItem[]): ExpiryCheckResult[] {
  const now = new Date();
  const results: ExpiryCheckResult[] = [];

  for (const item of items) {
    const expiryDate = getExpiryDate(item);
    if (expiryDate === null) continue;

    const daysRemaining = calculateDaysRemaining(expiryDate, now);

    // 超过 90 天的不返回
    if (daysRemaining > UPCOMING_DAYS) continue;

    results.push({
      item,
      expiryDate,
      daysRemaining,
      status: getStatus(daysRemaining),
    });
  }

  // 按 daysRemaining 升序排列（最久前过期的排最前）
  results.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return results;
}

/**
 * 获取过期 + 30 天内的条目总数（用于侧边栏徽章）。
 *
 * @param items 已解密的条目列表
 * @returns expired + soon 状态的条目数量
 */
export function getExpiryCount(items: DecryptedItem[]): number {
  const results = checkExpiry(items);
  return results.filter((r) => r.status === 'expired' || r.status === 'soon').length;
}
