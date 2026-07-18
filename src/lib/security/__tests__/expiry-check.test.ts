/**
 * 过期条目检测模块单元测试
 *
 * 验证 checkExpiry / getExpiryCount 的日期解析、状态判定、过滤与排序逻辑。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkExpiry, getExpiryCount } from '../expiry-check';
import type { DecryptedItem, ItemData } from '@/types/vault';

/** 构造测试用 DecryptedItem */
function makeItem(
  id: string,
  itemTypeCode: string,
  title: string,
  data: ItemData,
): DecryptedItem {
  return {
    id,
    vaultId: 'vault-1',
    itemTypeId: 1,
    itemTypeCode,
    title,
    data,
    isFavorite: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    tagIds: [],
  };
}

describe('checkExpiry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('信用卡 expiry (MM/YY)', () => {
    it('正确解析 MM/YY 格式为当月最后一天', () => {
      // "08/26" -> 2026-08-31（8 月最后一天）
      const item = makeItem('cc1', 'credit_card', 'Visa', { expiry: '08/26' });
      const results = checkExpiry([item]);
      expect(results).toHaveLength(1);
      expect(results[0].expiryDate.getFullYear()).toBe(2026);
      expect(results[0].expiryDate.getMonth()).toBe(7); // 0-based: 7 = 8 月
      expect(results[0].expiryDate.getDate()).toBe(31);
    });

    it('正常值 "09/26" 解析为 9 月 30 日', () => {
      const item = makeItem('cc2', 'credit_card', 'Mastercard', { expiry: '09/26' });
      const results = checkExpiry([item]);
      expect(results).toHaveLength(1);
      expect(results[0].expiryDate.getDate()).toBe(30); // 9 月只有 30 天
    });

    it('边界：月份 1 解析为 1 月 31 日', () => {
      const item = makeItem('cc3', 'credit_card', 'Visa', { expiry: '01/27' });
      const results = checkExpiry([item]);
      // 从 2026-07-18 到 2027-01-31 超过 90 天，不返回
      expect(results).toHaveLength(0);
    });

    it('无效月份 "13/26" 跳过', () => {
      const item = makeItem('cc4', 'credit_card', 'Visa', { expiry: '13/26' });
      const results = checkExpiry([item]);
      expect(results).toHaveLength(0);
    });

    it('无效月份 "00/26" 跳过', () => {
      const item = makeItem('cc5', 'credit_card', 'Visa', { expiry: '00/26' });
      const results = checkExpiry([item]);
      expect(results).toHaveLength(0);
    });

    it('无效格式 "abc" 跳过', () => {
      const item = makeItem('cc6', 'credit_card', 'Visa', { expiry: 'abc' });
      const results = checkExpiry([item]);
      expect(results).toHaveLength(0);
    });

    it('空字段跳过', () => {
      const item = makeItem('cc7', 'credit_card', 'Visa', { expiry: '' });
      const results = checkExpiry([item]);
      expect(results).toHaveLength(0);
    });
  });

  describe('信用卡跨年解析', () => {
    // 使用 12 月作为当前时间，测试跨年到次年 1 月
    beforeEach(() => {
      vi.setSystemTime(new Date('2026-12-15'));
    });

    it('"01/27" 解析为 2027-01-31', () => {
      const item = makeItem('cc8', 'credit_card', 'Visa', { expiry: '01/27' });
      const results = checkExpiry([item]);
      expect(results).toHaveLength(1);
      expect(results[0].expiryDate.getFullYear()).toBe(2027);
      expect(results[0].expiryDate.getMonth()).toBe(0); // 1 月
      expect(results[0].expiryDate.getDate()).toBe(31);
    });

    it('"12/26" 解析为 2026-12-31', () => {
      const item = makeItem('cc9', 'credit_card', 'Visa', { expiry: '12/26' });
      const results = checkExpiry([item]);
      expect(results).toHaveLength(1);
      expect(results[0].expiryDate.getFullYear()).toBe(2026);
      expect(results[0].expiryDate.getMonth()).toBe(11); // 12 月
      expect(results[0].expiryDate.getDate()).toBe(31);
    });
  });

  describe('软件许可证 expiration', () => {
    it('正确解析 ISO 日期字符串', () => {
      const item = makeItem('sl1', 'software_license', 'Office', { expiration: '2026-08-15' });
      const results = checkExpiry([item]);
      expect(results).toHaveLength(1);
      expect(results[0].daysRemaining).toBe(28); // 7/18 -> 8/15 = 28 天
      expect(results[0].status).toBe('soon');
    });
  });

  describe('驾驶证 expiryDate', () => {
    it('正确解析 ISO 日期字符串', () => {
      const item = makeItem('dl1', 'driver_license', '驾照', { expiryDate: '2026-09-15' });
      const results = checkExpiry([item]);
      expect(results).toHaveLength(1);
      expect(results[0].daysRemaining).toBe(59); // 7/18 -> 9/15 = 59 天
      expect(results[0].status).toBe('upcoming');
    });
  });

  describe('护照 expiryDate', () => {
    it('正确解析 ISO 日期字符串', () => {
      const item = makeItem('pp1', 'passport', '护照', { expiryDate: '2026-06-01' });
      const results = checkExpiry([item]);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('expired');
      expect(results[0].daysRemaining).toBeLessThan(0);
    });
  });

  describe('状态判定', () => {
    it('已过期 status=expired', () => {
      const item = makeItem('s1', 'software_license', 'Old', { expiration: '2026-06-01' });
      const results = checkExpiry([item]);
      expect(results[0].status).toBe('expired');
    });

    it('30 天内 status=soon', () => {
      const item = makeItem('s2', 'software_license', 'Soon', { expiration: '2026-08-15' });
      const results = checkExpiry([item]);
      expect(results[0].status).toBe('soon');
    });

    it('恰好 30 天 status=soon', () => {
      // 7/18 + 30 天 = 8/17
      const item = makeItem('s3', 'software_license', 'Boundary', { expiration: '2026-08-17' });
      const results = checkExpiry([item]);
      expect(results[0].daysRemaining).toBe(30);
      expect(results[0].status).toBe('soon');
    });

    it('90 天内 status=upcoming', () => {
      const item = makeItem('s4', 'software_license', 'Upcoming', { expiration: '2026-09-15' });
      const results = checkExpiry([item]);
      expect(results[0].status).toBe('upcoming');
    });

    it('恰好 90 天 status=upcoming', () => {
      // 7/18 + 90 天 = 10/16
      const item = makeItem('s5', 'software_license', 'Boundary90', { expiration: '2026-10-16' });
      const results = checkExpiry([item]);
      expect(results[0].daysRemaining).toBe(90);
      expect(results[0].status).toBe('upcoming');
    });

    it('超过 90 天不返回', () => {
      const item = makeItem('s6', 'software_license', 'Far', { expiration: '2026-12-15' });
      const results = checkExpiry([item]);
      expect(results).toHaveLength(0);
    });
  });

  describe('过滤逻辑', () => {
    it('无过期字段的条目类型跳过（login）', () => {
      const item = makeItem('l1', 'login', 'GitHub', { username: 'user', password: 'pass' });
      const results = checkExpiry([item]);
      expect(results).toHaveLength(0);
    });

    it('无过期字段的条目类型跳过（secure_note）', () => {
      const item = makeItem('l2', 'secure_note', '笔记', { noteText: 'hello' });
      const results = checkExpiry([item]);
      expect(results).toHaveLength(0);
    });

    it('空字段跳过', () => {
      const item = makeItem('e1', 'software_license', 'Empty', {});
      const results = checkExpiry([item]);
      expect(results).toHaveLength(0);
    });

    it('无效 ISO 日期格式跳过', () => {
      const item = makeItem('e2', 'software_license', 'Invalid', { expiration: 'not-a-date' });
      const results = checkExpiry([item]);
      expect(results).toHaveLength(0);
    });
  });

  describe('排序', () => {
    it('结果按 daysRemaining 升序排列', () => {
      const items = [
        makeItem('o1', 'software_license', 'Upcoming', { expiration: '2026-09-15' }), // 59 天
        makeItem('o2', 'software_license', 'Expired', { expiration: '2026-06-01' }), // 已过期
        makeItem('o3', 'software_license', 'Soon', { expiration: '2026-08-15' }), // 28 天
      ];
      const results = checkExpiry(items);
      expect(results).toHaveLength(3);
      // 最负的（最久前过期）排最前
      expect(results[0].item.id).toBe('o2');
      expect(results[1].item.id).toBe('o3');
      expect(results[2].item.id).toBe('o1');
    });
  });

  describe('空列表', () => {
    it('空列表返回空结果', () => {
      const results = checkExpiry([]);
      expect(results).toEqual([]);
    });
  });
});

describe('getExpiryCount', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('返回 expired + soon 的总数', () => {
    const items = [
      makeItem('c1', 'software_license', 'Expired', { expiration: '2026-06-01' }), // expired
      makeItem('c2', 'software_license', 'Soon', { expiration: '2026-08-15' }), // soon (28 天)
      makeItem('c3', 'software_license', 'Upcoming', { expiration: '2026-09-15' }), // upcoming (59 天)
      makeItem('c4', 'software_license', 'Far', { expiration: '2026-12-15' }), // > 90 天，不返回
    ];
    const count = getExpiryCount(items);
    expect(count).toBe(2); // expired + soon
  });

  it('无过期条目返回 0', () => {
    const items = [makeItem('c5', 'login', 'GitHub', { password: 'pass' })];
    const count = getExpiryCount(items);
    expect(count).toBe(0);
  });

  it('空列表返回 0', () => {
    const count = getExpiryCount([]);
    expect(count).toBe(0);
  });
});
