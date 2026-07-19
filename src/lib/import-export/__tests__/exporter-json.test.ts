// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { exportToEncryptedJson, importFromEncryptedJson } from '../exporter-json';
import type { EncryptedExport } from '../types';
import type { DecryptedItem } from '@/types/vault';
import type { KdfParams } from '@/types/crypto';

/** 测试用 KDF 参数（使用最低安全阈值以加速测试） */
const TEST_KDF_PARAMS: KdfParams = {
  type: 'argon2id',
  memoryKib: 16384, // 16 MiB（最低阈值）
  iterations: 2, // 最低阈值
  parallelism: 1,
};

const TEST_PASSWORD = 'TestMasterPassword123!';

/** 构造测试用 DecryptedItem */
function makeItem(overrides: Partial<DecryptedItem> = {}): DecryptedItem {
  return {
    id: 'item-1',
    vaultId: 'vault-1',
    itemTypeId: 1,
    itemTypeCode: 'login',
    title: 'GitHub',
    data: {
      url: 'https://github.com',
      username: 'testuser',
      password: 'secret-password',
      totpSecret: 'TOTPSECRET',
      notes: '测试备注',
    },
    isFavorite: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    deletedAt: null,
    tagIds: [],
    ...overrides,
  };
}

describe('exportToEncryptedJson / importFromEncryptedJson', () => {
  it('加密然后解密能恢复原始数据', async () => {
    const items = [
      makeItem({ id: '1', title: 'GitHub' }),
      makeItem({
        id: '2',
        title: 'GitLab',
        itemTypeCode: 'secure_note',
        itemTypeId: 2,
        data: { noteText: '笔记内容' },
      }),
    ];

    const encryptedJson = await exportToEncryptedJson(
      items,
      TEST_PASSWORD,
      'existing-salt-base64',
      TEST_KDF_PARAMS,
    );

    const importedItems = await importFromEncryptedJson(encryptedJson, TEST_PASSWORD);

    expect(importedItems).toHaveLength(2);
    expect(importedItems[0].title).toBe('GitHub');
    expect(importedItems[0].itemType).toBe('login');
    expect(importedItems[0].fields.username).toBe('testuser');
    expect(importedItems[0].fields.password).toBe('secret-password');
    expect(importedItems[0].fields.url).toBe('https://github.com');
    expect(importedItems[0].fields.notes).toBe('测试备注');
    expect(importedItems[0].favorite).toBe(true);

    expect(importedItems[1].title).toBe('GitLab');
    expect(importedItems[1].itemType).toBe('secure_note');
    expect(importedItems[1].fields.noteText).toBe('笔记内容');
  });

  it('不同密码无法解密', async () => {
    const items = [makeItem()];

    const encryptedJson = await exportToEncryptedJson(
      items,
      TEST_PASSWORD,
      '',
      TEST_KDF_PARAMS,
    );

    await expect(
      importFromEncryptedJson(encryptedJson, 'WrongPassword456!'),
    ).rejects.toThrow();
  });

  it('导出文件结构正确（version, format, kdf, encryptedData 字段存在）', async () => {
    const items = [makeItem()];

    const encryptedJson = await exportToEncryptedJson(
      items,
      TEST_PASSWORD,
      '',
      TEST_KDF_PARAMS,
    );

    const exportData = JSON.parse(encryptedJson) as EncryptedExport;

    expect(exportData.version).toBe(1);
    expect(exportData.format).toBe('passbox-encrypted-export');
    expect(typeof exportData.createdAt).toBe('string');
    expect(exportData.kdf).toBeDefined();
    expect(exportData.kdf.algorithm).toBe('argon2id');
    expect(typeof exportData.kdf.salt).toBe('string');
    expect(exportData.kdf.params.memoryCost).toBe(TEST_KDF_PARAMS.memoryKib);
    expect(exportData.kdf.params.timeCost).toBe(TEST_KDF_PARAMS.iterations);
    expect(exportData.kdf.params.parallelism).toBe(TEST_KDF_PARAMS.parallelism);
    expect(exportData.encryptedData).toBeDefined();
    expect(exportData.encryptedData.v).toBe(1);
    expect(typeof exportData.encryptedData.iv).toBe('string');
    expect(typeof exportData.encryptedData.ct).toBe('string');
  });

  it('每次导出生成不同的 salt（相同数据结果不同）', async () => {
    const items = [makeItem()];

    const json1 = await exportToEncryptedJson(items, TEST_PASSWORD, '', TEST_KDF_PARAMS);
    const json2 = await exportToEncryptedJson(items, TEST_PASSWORD, '', TEST_KDF_PARAMS);

    const data1 = JSON.parse(json1) as EncryptedExport;
    const data2 = JSON.parse(json2) as EncryptedExport;

    expect(data1.kdf.salt).not.toBe(data2.kdf.salt);
    expect(data1.encryptedData.iv).not.toBe(data2.encryptedData.iv);
  });

  it('无效的导出文件格式抛出异常', async () => {
    const badJson = JSON.stringify({ version: 1, format: 'unknown' });

    await expect(importFromEncryptedJson(badJson, TEST_PASSWORD)).rejects.toThrow(
      /无效的导出文件格式/,
    );
  });

  it('不支持的版本号抛出异常', async () => {
    const badJson = JSON.stringify({
      version: 99,
      format: 'passbox-encrypted-export',
    });

    await expect(importFromEncryptedJson(badJson, TEST_PASSWORD)).rejects.toThrow(
      /不支持的导出文件版本/,
    );
  });

  it('空条目列表可正常导出导入', async () => {
    const encryptedJson = await exportToEncryptedJson(
      [],
      TEST_PASSWORD,
      '',
      TEST_KDF_PARAMS,
    );

    const importedItems = await importFromEncryptedJson(encryptedJson, TEST_PASSWORD);

    expect(importedItems).toEqual([]);
  });
});
