import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import { exportToCsv } from '../exporter-csv';
import type { DecryptedItem } from '@/types/vault';

/** 构造测试用 DecryptedItem */
function makeItem(overrides: Partial<DecryptedItem> = {}): DecryptedItem {
  return {
    id: 'item-1',
    vaultId: 'vault-1',
    itemTypeId: 1,
    itemTypeCode: 'login',
    title: 'Test Item',
    data: {},
    isFavorite: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    tagIds: [],
    ...overrides,
  };
}

describe('exportToCsv', () => {
  it('基本导出：2 个 login 条目', () => {
    const items = [
      makeItem({
        id: '1',
        title: 'GitHub',
        itemTypeCode: 'login',
        data: {
          url: 'https://github.com',
          username: 'user1',
          password: 'pass123',
          totpSecret: 'SECRET123',
          notes: '个人账号',
        },
      }),
      makeItem({
        id: '2',
        title: 'GitLab',
        itemTypeCode: 'login',
        data: {
          url: 'https://gitlab.com',
          username: 'user2',
          password: 'pass456',
          totpSecret: '',
          notes: '工作账号',
        },
      }),
    ];

    const csv = exportToCsv(items);
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true });

    expect(parsed.data).toHaveLength(2);
    expect(parsed.meta.fields).toEqual([
      'title',
      'itemType',
      'url',
      'username',
      'password',
      'totpSecret',
      'notes',
    ]);

    expect(parsed.data[0].title).toBe('GitHub');
    expect(parsed.data[0].itemType).toBe('login');
    expect(parsed.data[0].url).toBe('https://github.com');
    expect(parsed.data[0].username).toBe('user1');
    expect(parsed.data[0].password).toBe('pass123');
    expect(parsed.data[0].totpSecret).toBe('SECRET123');
    expect(parsed.data[0].notes).toBe('个人账号');

    expect(parsed.data[1].title).toBe('GitLab');
    expect(parsed.data[1].username).toBe('user2');
  });

  it('空字段处理：非 login 类型条目', () => {
    const items = [
      makeItem({
        id: '1',
        title: '我的笔记',
        itemTypeCode: 'secure_note',
        itemTypeId: 2,
        data: {
          noteText: '这是一段笔记内容',
        },
      }),
    ];

    const csv = exportToCsv(items);
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true });

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].title).toBe('我的笔记');
    expect(parsed.data[0].itemType).toBe('secure_note');
    expect(parsed.data[0].url).toBe('');
    expect(parsed.data[0].username).toBe('');
    expect(parsed.data[0].password).toBe('');
    expect(parsed.data[0].totpSecret).toBe('');
  });

  it('notes 和 noteText 映射：优先使用 notes', () => {
    const items = [
      makeItem({
        id: '1',
        title: '有 notes 字段',
        data: {
          notes: '这是 notes',
          noteText: '这是 noteText',
        },
      }),
    ];

    const csv = exportToCsv(items);
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true });

    expect(parsed.data[0].notes).toBe('这是 notes');
  });

  it('notes 和 noteText 映射：notes 为空时回退到 noteText', () => {
    const items = [
      makeItem({
        id: '1',
        title: '只有 noteText',
        data: {
          noteText: '这是 noteText 内容',
        },
      }),
    ];

    const csv = exportToCsv(items);
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true });

    expect(parsed.data[0].notes).toBe('这是 noteText 内容');
  });

  it('CSV 格式正确性：含表头且首行为数据', () => {
    const items = [
      makeItem({
        title: 'Test',
        data: { username: 'u1' },
      }),
    ];

    const csv = exportToCsv(items);
    const lines = csv.split('\n');

    // 首行是表头
    expect(lines[0]).toContain('title');
    expect(lines[0]).toContain('itemType');
    expect(lines[0]).toContain('url');
    expect(lines[0]).toContain('username');
    expect(lines[0]).toContain('password');
    expect(lines[0]).toContain('totpSecret');
    expect(lines[0]).toContain('notes');
  });

  it('空列表导出仅含表头', () => {
    const csv = exportToCsv([]);

    // 首行是表头，无数据行
    expect(csv).toContain('title');
    expect(csv).toContain('itemType');
    const parsed = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
    });
    expect(parsed.data).toHaveLength(0);
  });

  it('含特殊字符（逗号、引号、换行）的字段正确转义', () => {
    const items = [
      makeItem({
        title: 'Hello, World',
        data: {
          password: 'pass"word',
          notes: 'line1\nline2',
        },
      }),
    ];

    const csv = exportToCsv(items);
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true });

    expect(parsed.data[0].title).toBe('Hello, World');
    expect(parsed.data[0].password).toBe('pass"word');
    expect(parsed.data[0].notes).toBe('line1\nline2');
  });
});
