import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { parseOnepassword1pux } from '../onepassword-1pux';

/** 构造 1PUX 文件（ZIP 包含 data.json） */
async function create1puxFile(data: unknown): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file('data.json', JSON.stringify(data));
  return await zip.generateAsync({ type: 'arraybuffer' });
}

describe('parseOnepassword1pux', () => {
  it('应正确解析 login 类型（category=001，含 username/password/url fields）', async () => {
    const data = {
      accounts: [
        {
          vaults: [
            {
              items: [
                {
                  title: 'GitHub',
                  category: '001',
                  fields: [
                    { label: 'username', value: 'user@example.com' },
                    { label: 'password', value: 'secret' },
                    { label: 'url', value: 'https://github.com' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const fileBuffer = await create1puxFile(data);
    const items = await parseOnepassword1pux(fileBuffer);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      title: 'GitHub',
      itemType: 'login',
      fields: {
        username: 'user@example.com',
        password: 'secret',
        url: 'https://github.com',
      },
      favorite: false,
      tags: [],
    });
  });

  it('应正确解析 secure_note 类型（category=003）', async () => {
    const data = {
      accounts: [
        {
          vaults: [
            {
              items: [
                {
                  title: '我的笔记',
                  category: '003',
                  fields: [{ label: 'notes', value: '这是笔记内容' }],
                },
              ],
            },
          ],
        },
      ],
    };

    const fileBuffer = await create1puxFile(data);
    const items = await parseOnepassword1pux(fileBuffer);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('我的笔记');
    expect(items[0].itemType).toBe('secure_note');
    expect(items[0].fields.notes).toBe('这是笔记内容');
  });

  it('未知 category 应兜底为 login', async () => {
    const data = {
      accounts: [
        {
          vaults: [
            {
              items: [
                {
                  title: '未知类型条目',
                  category: '999',
                  fields: [{ label: 'password', value: 'pass123' }],
                },
              ],
            },
          ],
        },
      ],
    };

    const fileBuffer = await create1puxFile(data);
    const items = await parseOnepassword1pux(fileBuffer);

    expect(items).toHaveLength(1);
    expect(items[0].itemType).toBe('login');
  });

  it('应遍历多个 vault 和多个 item', async () => {
    const data = {
      accounts: [
        {
          vaults: [
            {
              items: [
                {
                  title: 'Item1',
                  category: '001',
                  fields: [{ label: 'username', value: 'user1' }],
                },
                {
                  title: 'Item2',
                  category: '001',
                  fields: [{ label: 'username', value: 'user2' }],
                },
              ],
            },
            {
              items: [
                {
                  title: 'Item3',
                  category: '003',
                  fields: [{ label: 'notes', value: 'note3' }],
                },
              ],
            },
          ],
        },
      ],
    };

    const fileBuffer = await create1puxFile(data);
    const items = await parseOnepassword1pux(fileBuffer);

    expect(items).toHaveLength(3);
    expect(items[0].title).toBe('Item1');
    expect(items[1].title).toBe('Item2');
    expect(items[2].title).toBe('Item3');
  });

  it('空标题应填充"未命名条目"', async () => {
    const data = {
      accounts: [
        {
          vaults: [
            {
              items: [
                {
                  title: '',
                  category: '001',
                  fields: [{ label: 'username', value: 'user1' }],
                },
              ],
            },
          ],
        },
      ],
    };

    const fileBuffer = await create1puxFile(data);
    const items = await parseOnepassword1pux(fileBuffer);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('未命名条目');
    expect(items[0].fields.username).toBe('user1');
  });

  it('应能提取 sections 中的字段', async () => {
    const data = {
      accounts: [
        {
          vaults: [
            {
              items: [
                {
                  title: 'WithSections',
                  category: '001',
                  fields: [
                    { label: 'username', value: 'main_user' },
                    { label: 'password', value: 'main_pass' },
                  ],
                  sections: [
                    {
                      fields: [
                        { label: 'notes', value: 'section notes' },
                        { label: 'totp', value: 'totp_secret_value' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const fileBuffer = await create1puxFile(data);
    const items = await parseOnepassword1pux(fileBuffer);

    expect(items).toHaveLength(1);
    expect(items[0].fields.username).toBe('main_user');
    expect(items[0].fields.password).toBe('main_pass');
    expect(items[0].fields.notes).toBe('section notes');
    expect(items[0].fields.totpSecret).toBe('totp_secret_value');
  });

  it('item.fields 中的值应优先于 sections 中的同名字段', async () => {
    const data = {
      accounts: [
        {
          vaults: [
            {
              items: [
                {
                  title: 'PriorityTest',
                  category: '001',
                  fields: [{ label: 'notes', value: 'top_level_notes' }],
                  sections: [
                    {
                      fields: [{ label: 'notes', value: 'section_notes' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const fileBuffer = await create1puxFile(data);
    const items = await parseOnepassword1pux(fileBuffer);

    expect(items).toHaveLength(1);
    expect(items[0].fields.notes).toBe('top_level_notes');
  });
});
