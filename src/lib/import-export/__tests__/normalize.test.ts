import { describe, it, expect } from 'vitest';
import { detectDuplicates, getItemTypeIdByCode } from '../normalize';
import type { ImportItem, DuplicateMatch } from '../types';
import type { DecryptedItem } from '@/types/vault';

/** 构造测试用 ImportItem */
function makeImportItem(title: string, username?: string): ImportItem {
  return {
    title,
    itemType: 'login',
    fields: {
      ...(username !== undefined ? { username } : {}),
    },
    favorite: false,
    tags: [],
  };
}

/** 构造测试用 DecryptedItem */
function makeExistingItem(
  id: string,
  title: string,
  username?: string,
): DecryptedItem {
  return {
    id,
    vaultId: 'vault-1',
    itemTypeId: 1,
    itemTypeCode: 'login',
    title,
    data: {
      ...(username !== undefined ? { username } : {}),
    },
    isFavorite: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    tagIds: [],
  };
}

describe('detectDuplicates', () => {
  it('无重复：3 个导入项 vs 2 个已有项，标题都不同', () => {
    const importItems = [
      makeImportItem('GitHub', 'user1'),
      makeImportItem('GitLab', 'user2'),
      makeImportItem('Bitbucket', 'user3'),
    ];
    const existingItems = [
      makeExistingItem('e1', 'Amazon', 'amazon-user'),
      makeExistingItem('e2', 'Google', 'google-user'),
    ];

    const results = detectDuplicates(importItems, existingItems);

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.isDuplicate === false)).toBe(true);
    expect(results.every((r) => r.action === 'import')).toBe(true);
    expect(results.every((r) => r.existingItem === undefined)).toBe(true);
  });

  it('有重复：标题 + 用户名同时匹配', () => {
    const importItems = [
      makeImportItem('GitHub', 'user1'),
      makeImportItem('GitLab', 'user2'),
    ];
    const existingItems = [
      makeExistingItem('e1', 'GitHub', 'user1'),
      makeExistingItem('e2', 'Google', 'google-user'),
    ];

    const results = detectDuplicates(importItems, existingItems);

    expect(results).toHaveLength(2);
    expect(results[0].isDuplicate).toBe(true);
    expect(results[0].existingItem?.id).toBe('e1');
    expect(results[0].action).toBe('skip');

    expect(results[1].isDuplicate).toBe(false);
    expect(results[1].action).toBe('import');
  });

  it('大小写不敏感匹配', () => {
    const importItems = [makeImportItem('GITHUB', 'USER1')];
    const existingItems = [makeExistingItem('e1', 'github', 'user1')];

    const results = detectDuplicates(importItems, existingItems);

    expect(results[0].isDuplicate).toBe(true);
    expect(results[0].existingItem?.id).toBe('e1');
  });

  it('前后空格容错', () => {
    const importItems = [makeImportItem('  GitHub  ', '  user1  ')];
    const existingItems = [makeExistingItem('e1', 'GitHub', 'user1')];

    const results = detectDuplicates(importItems, existingItems);

    expect(results[0].isDuplicate).toBe(true);
    expect(results[0].existingItem?.id).toBe('e1');
  });

  it('重复项默认 action=skip，非重复项默认 action=import', () => {
    const importItems = [
      makeImportItem('Duplicate', 'dup-user'),
      makeImportItem('New', 'new-user'),
    ];
    const existingItems = [makeExistingItem('e1', 'Duplicate', 'dup-user')];

    const results = detectDuplicates(importItems, existingItems);

    expect(results[0].isDuplicate).toBe(true);
    expect(results[0].action).toBe('skip');
    expect(results[1].isDuplicate).toBe(false);
    expect(results[1].action).toBe('import');
  });

  it('标题匹配但用户名不同不算重复', () => {
    const importItems = [makeImportItem('GitHub', 'user1')];
    const existingItems = [makeExistingItem('e1', 'GitHub', 'user2')];

    const results = detectDuplicates(importItems, existingItems);

    expect(results[0].isDuplicate).toBe(false);
    expect(results[0].action).toBe('import');
  });

  it('两个导入项匹配同一个已有条目时都标记为重复', () => {
    const importItems = [
      makeImportItem('GitHub', 'user1'),
      makeImportItem('GitHub', 'user1'),
    ];
    const existingItems = [makeExistingItem('e1', 'GitHub', 'user1')];

    const results = detectDuplicates(importItems, existingItems);

    expect(results).toHaveLength(2);
    expect(results[0].isDuplicate).toBe(true);
    expect(results[0].existingItem?.id).toBe('e1');
    expect(results[1].isDuplicate).toBe(true);
    expect(results[1].existingItem?.id).toBe('e1');
  });

  it('空导入列表返回空结果', () => {
    const results = detectDuplicates([], [makeExistingItem('e1', 'Test', 'user')]);
    expect(results).toEqual([]);
  });
});

describe('getItemTypeIdByCode', () => {
  it('正确返回 login 的 ID', () => {
    expect(getItemTypeIdByCode('login')).toBe(1);
  });

  it('正确返回 secure_note 的 ID', () => {
    expect(getItemTypeIdByCode('secure_note')).toBe(2);
  });

  it('正确返回 credit_card 的 ID', () => {
    expect(getItemTypeIdByCode('credit_card')).toBe(3);
  });

  it('正确返回 identity 的 ID', () => {
    expect(getItemTypeIdByCode('identity')).toBe(4);
  });

  it('未知类型代码抛出异常', () => {
    expect(() => getItemTypeIdByCode('unknown_type')).toThrow(/未知的条目类型代码/);
  });
});
