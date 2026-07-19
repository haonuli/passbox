// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useVaultStore } from '../vault-store';
import type { DecryptedItem, DecryptedVault, DecryptedTag } from '@/types/vault';
import type { EncryptedData } from '@/types/crypto';

/**
 * Vault Store 单元测试 (L5 测试补全)
 *
 * 重点覆盖 M5 修复新增的 API：lockItemData / decryptItemData，
 * 以及 upsertItem / removeItem / updateFavorite / upsertVault 等基础逻辑。
 *
 * 解密依赖被 mock：通过 spy on decrypt 模块避免真实 WebCrypto 调用。
 */

// Mock crypto/aes decrypt — 使用 vi.mock 必须在文件顶层
vi.mock('@/lib/crypto/aes', () => ({
  decrypt: vi.fn(),
}));

// 动态导入以拿到被 mock 后的模块
import { decrypt } from '@/lib/crypto/aes';

const mockedDecrypt = decrypt as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedDecrypt.mockReset();
});

/** 构造已解密的测试条目 */
function makeItem(id: string, overrides: Partial<DecryptedItem> = {}): DecryptedItem {
  return {
    id,
    vaultId: 'vault-1',
    itemTypeId: 1,
    itemTypeCode: 'login',
    title: `Item ${id}`,
    data: { username: 'alice', password: 'secret-' + id },
    isFavorite: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    deletedAt: null,
    tagIds: [],
    ...overrides,
  };
}

describe('Vault Store - 基础状态', () => {
  beforeEach(() => {
    useVaultStore.setState({
      vaults: [],
      items: [],
      tags: [],
      encryptedItemData: new Map(),
      loaded: false,
      loading: false,
      searchQuery: '',
    });
  });

  it('初始状态应为空', () => {
    const state = useVaultStore.getState();
    expect(state.vaults).toEqual([]);
    expect(state.items).toEqual([]);
    expect(state.tags).toEqual([]);
    expect(state.loaded).toBe(false);
    expect(state.loading).toBe(false);
    expect(state.searchQuery).toBe('');
  });

  it('clear 应清空所有状态', () => {
    useVaultStore.setState({
      items: [makeItem('1')],
      vaults: [{ id: 'v1', name: 'test', displayOrder: 0, createdAt: '', updatedAt: '' }],
      loaded: true,
    });
    useVaultStore.getState().clear();
    const state = useVaultStore.getState();
    expect(state.items).toEqual([]);
    expect(state.vaults).toEqual([]);
    expect(state.loaded).toBe(false);
  });
});

describe('Vault Store - upsertItem', () => {
  beforeEach(() => {
    useVaultStore.setState({
      vaults: [],
      items: [],
      tags: [],
      encryptedItemData: new Map(),
      loaded: true,
      loading: false,
      searchQuery: '',
    });
  });

  it('新条目应插入到列表头部', () => {
    const item1 = makeItem('1');
    const item2 = makeItem('2');
    useVaultStore.getState().upsertItem(item1);
    useVaultStore.getState().upsertItem(item2);
    const items = useVaultStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('2');
    expect(items[1].id).toBe('1');
  });

  it('更新已有条目应替换并移到头部', () => {
    useVaultStore.getState().upsertItem(makeItem('1'));
    useVaultStore.getState().upsertItem(makeItem('2'));
    useVaultStore.getState().upsertItem(makeItem('1', { title: 'updated' }));
    const items = useVaultStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('1');
    expect(items[0].title).toBe('updated');
    expect(items[1].id).toBe('2');
  });
});

describe('Vault Store - removeItem / removeItems', () => {
  beforeEach(() => {
    useVaultStore.setState({
      vaults: [],
      items: [makeItem('1'), makeItem('2'), makeItem('3')],
      tags: [],
      encryptedItemData: new Map(),
      loaded: true,
      loading: false,
      searchQuery: '',
    });
  });

  it('removeItem 应按 id 移除单个条目', () => {
    useVaultStore.getState().removeItem('2');
    const items = useVaultStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.id === '2')).toBeUndefined();
  });

  it('removeItems 应批量移除', () => {
    useVaultStore.getState().removeItems(['1', '3']);
    const items = useVaultStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('2');
  });
});

describe('Vault Store - updateItemsVault', () => {
  beforeEach(() => {
    useVaultStore.setState({
      vaults: [],
      items: [makeItem('1', { vaultId: 'v1' }), makeItem('2', { vaultId: 'v1' })],
      tags: [],
      encryptedItemData: new Map(),
      loaded: true,
      loading: false,
      searchQuery: '',
    });
  });

  it('应批量更新 vaultId', () => {
    useVaultStore.getState().updateItemsVault(['1', '2'], 'v2');
    const items = useVaultStore.getState().items;
    expect(items[0].vaultId).toBe('v2');
    expect(items[1].vaultId).toBe('v2');
  });

  it('应同步更新 updatedAt', () => {
    const before = useVaultStore.getState().items[0].updatedAt;
    useVaultStore.getState().updateItemsVault(['1'], 'v2');
    const after = useVaultStore.getState().items.find((i) => i.id === '1')!.updatedAt;
    expect(after).not.toBe(before);
  });
});

describe('Vault Store - updateFavorite', () => {
  beforeEach(() => {
    useVaultStore.setState({
      vaults: [],
      items: [makeItem('1', { isFavorite: false })],
      tags: [],
      encryptedItemData: new Map(),
      loaded: true,
      loading: false,
      searchQuery: '',
    });
  });

  it('应切换收藏状态', () => {
    useVaultStore.getState().updateFavorite('1', true);
    expect(useVaultStore.getState().items[0].isFavorite).toBe(true);
    useVaultStore.getState().updateFavorite('1', false);
    expect(useVaultStore.getState().items[0].isFavorite).toBe(false);
  });
});

describe('Vault Store - upsertVault / removeVault', () => {
  const v1: DecryptedVault = {
    id: 'v1',
    name: 'Vault 1',
    displayOrder: 1,
    createdAt: '',
    updatedAt: '',
  };
  const v2: DecryptedVault = {
    id: 'v2',
    name: 'Vault 2',
    displayOrder: 0,
    createdAt: '',
    updatedAt: '',
  };

  beforeEach(() => {
    useVaultStore.setState({
      vaults: [],
      items: [],
      tags: [],
      encryptedItemData: new Map(),
      loaded: true,
      loading: false,
      searchQuery: '',
    });
  });

  it('新增保险库应按 displayOrder 排序', () => {
    useVaultStore.getState().upsertVault(v1);
    useVaultStore.getState().upsertVault(v2);
    const vaults = useVaultStore.getState().vaults;
    expect(vaults[0].id).toBe('v2');
    expect(vaults[1].id).toBe('v1');
  });

  it('更新保险库应保持原位置', () => {
    useVaultStore.getState().upsertVault(v1);
    useVaultStore.getState().upsertVault(v2);
    useVaultStore.getState().upsertVault({ ...v1, name: 'updated' });
    const vaults = useVaultStore.getState().vaults;
    expect(vaults).toHaveLength(2);
    expect(vaults.find((v) => v.id === 'v1')!.name).toBe('updated');
  });

  it('removeVault 应按 id 移除', () => {
    useVaultStore.getState().upsertVault(v1);
    useVaultStore.getState().upsertVault(v2);
    useVaultStore.getState().removeVault('v1');
    const vaults = useVaultStore.getState().vaults;
    expect(vaults).toHaveLength(1);
    expect(vaults[0].id).toBe('v2');
  });
});

describe('Vault Store - upsertTag / removeTag', () => {
  const t1: DecryptedTag = { id: 't1', name: 'beta', createdAt: '' };
  const t2: DecryptedTag = { id: 't2', name: 'alpha', createdAt: '' };

  beforeEach(() => {
    useVaultStore.setState({
      vaults: [],
      items: [],
      tags: [],
      encryptedItemData: new Map(),
      loaded: true,
      loading: false,
      searchQuery: '',
    });
  });

  it('新增标签应按 name 字母序排序', () => {
    useVaultStore.getState().upsertTag(t1);
    useVaultStore.getState().upsertTag(t2);
    const tags = useVaultStore.getState().tags;
    expect(tags[0].id).toBe('t2'); // alpha 在前
    expect(tags[1].id).toBe('t1'); // beta 在后
  });

  it('removeTag 应按 id 移除', () => {
    useVaultStore.getState().upsertTag(t1);
    useVaultStore.getState().upsertTag(t2);
    useVaultStore.getState().removeTag('t1');
    const tags = useVaultStore.getState().tags;
    expect(tags).toHaveLength(1);
    expect(tags[0].id).toBe('t2');
  });
});

describe('Vault Store - setSearchQuery', () => {
  beforeEach(() => {
    useVaultStore.setState({
      vaults: [],
      items: [],
      tags: [],
      encryptedItemData: new Map(),
      loaded: true,
      loading: false,
      searchQuery: '',
    });
  });

  it('应设置搜索关键词', () => {
    useVaultStore.getState().setSearchQuery('github');
    expect(useVaultStore.getState().searchQuery).toBe('github');
  });
});

// ============================================================
// M5 修复：lockItemData / decryptItemData 测试
// ============================================================
describe('Vault Store - M5: lockItemData', () => {
  beforeEach(() => {
    useVaultStore.setState({
      vaults: [],
      items: [makeItem('1', { data: { username: 'alice', password: 'p@ss' } })],
      tags: [],
      encryptedItemData: new Map(),
      loaded: true,
      loading: false,
      searchQuery: '',
    });
  });

  it('应清空 item.data 为 {}', () => {
    useVaultStore.getState().lockItemData('1');
    const item = useVaultStore.getState().items[0];
    expect(item.data).toEqual({});
  });

  it('不应影响其他条目', () => {
    useVaultStore.setState({
      items: [makeItem('1', { data: { password: 'a' } }), makeItem('2', { data: { password: 'b' } })],
    });
    useVaultStore.getState().lockItemData('1');
    const items = useVaultStore.getState().items;
    expect(items.find((i) => i.id === '1')!.data).toEqual({});
    expect(items.find((i) => i.id === '2')!.data).toEqual({ password: 'b' });
  });

  it('不存在的 itemId 应静默不报错', () => {
    expect(() => useVaultStore.getState().lockItemData('not-exist')).not.toThrow();
  });

  it('lock 后 title 仍保留', () => {
    useVaultStore.getState().lockItemData('1');
    const item = useVaultStore.getState().items[0];
    expect(item.title).toBe('Item 1');
  });
});

describe('Vault Store - M5: decryptItemData', () => {
  const fakeKey = {} as CryptoKey;
  const blob = {
    dataEncrypted: { v: 1, iv: 'a', ct: 'b' } as EncryptedData,
    dataAad: 'item:1:data',
  };

  beforeEach(() => {
    mockedDecrypt.mockReset();
    useVaultStore.setState({
      vaults: [],
      items: [makeItem('1', { data: {} })],
      tags: [],
      encryptedItemData: new Map([['1', blob]]),
      loaded: true,
      loading: false,
      searchQuery: '',
    });
  });

  it('blob 不存在时应返回 false', async () => {
    const result = await useVaultStore.getState().decryptItemData('not-exist', fakeKey);
    expect(result).toBe(false);
    expect(mockedDecrypt).not.toHaveBeenCalled();
  });

  it('解密成功应恢复 data 并返回 true', async () => {
    const decrypted = JSON.stringify({ username: 'alice', password: 'p@ss' });
    mockedDecrypt.mockResolvedValue(decrypted);
    const result = await useVaultStore.getState().decryptItemData('1', fakeKey);
    expect(result).toBe(true);
    expect(mockedDecrypt).toHaveBeenCalledWith(fakeKey, blob.dataEncrypted, blob.dataAad);
    const item = useVaultStore.getState().items[0];
    expect(item.data).toEqual({ username: 'alice', password: 'p@ss' });
  });

  it('解密抛异常应返回 false', async () => {
    mockedDecrypt.mockRejectedValue(new Error('decrypt failed'));
    const result = await useVaultStore.getState().decryptItemData('1', fakeKey);
    expect(result).toBe(false);
  });

  it('JSON 解析失败应返回 false', async () => {
    mockedDecrypt.mockResolvedValue('not a json');
    const result = await useVaultStore.getState().decryptItemData('1', fakeKey);
    expect(result).toBe(false);
  });

  it('调用应使用正确的 key（不混淆 itemId）', async () => {
    useVaultStore.setState({
      items: [makeItem('1', { data: {} }), makeItem('2', { data: {} })],
      encryptedItemData: new Map([
        ['1', { dataEncrypted: { v: 1, iv: 'a', ct: 'a' } as EncryptedData, dataAad: 'item:1:data' }],
        ['2', { dataEncrypted: { v: 1, iv: 'b', ct: 'b' } as EncryptedData, dataAad: 'item:2:data' }],
      ]),
    });
    mockedDecrypt.mockResolvedValue(JSON.stringify({ password: 'p2' }));
    await useVaultStore.getState().decryptItemData('2', fakeKey);
    expect(mockedDecrypt).toHaveBeenCalledWith(
      fakeKey,
      { v: 1, iv: 'b', ct: 'b' } as EncryptedData,
      'item:2:data',
    );
    const item2 = useVaultStore.getState().items.find((i) => i.id === '2')!;
    expect(item2.data).toEqual({ password: 'p2' });
    const item1 = useVaultStore.getState().items.find((i) => i.id === '1')!;
    expect(item1.data).toEqual({});
  });
});
