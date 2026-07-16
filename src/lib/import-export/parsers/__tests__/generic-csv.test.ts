import { describe, it, expect } from 'vitest';
import { getCsvColumns, parseGenericCsv } from '../generic-csv';
import type { ColumnMapping } from '../../types';

describe('getCsvColumns', () => {
  it('应返回正确的列名', () => {
    const csv = ['name,url,username,password', 'Google,https://google.com,user,pass'].join('\n');

    const columns = getCsvColumns(csv);

    expect(columns).toEqual(['name', 'url', 'username', 'password']);
  });

  it('应处理单行列的 CSV', () => {
    const csv = 'title,username,password';

    const columns = getCsvColumns(csv);

    expect(columns).toEqual(['title', 'username', 'password']);
  });
});

describe('parseGenericCsv', () => {
  it('应根据映射正确解析基本字段（title, username, password, url）', () => {
    const csv = [
      '网站,网址,账号,密码',
      'Google,https://google.com,user1,pass1',
      'GitHub,https://github.com,user2,pass2',
    ].join('\n');

    const mappings: ColumnMapping[] = [
      { csvColumn: '网站', targetField: 'title' },
      { csvColumn: '网址', targetField: 'url' },
      { csvColumn: '账号', targetField: 'username' },
      { csvColumn: '密码', targetField: 'password' },
    ];

    const items = parseGenericCsv(csv, mappings);

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      title: 'Google',
      itemType: 'login',
      fields: {
        url: 'https://google.com',
        username: 'user1',
        password: 'pass1',
      },
      favorite: false,
      tags: [],
    });
    expect(items[1].title).toBe('GitHub');
    expect(items[1].fields.password).toBe('pass2');
  });

  it('targetField=null 的列应被跳过', () => {
    const csv = ['name,url,username,password,extra', 'Item1,https://a.com,u1,p1,ignore_me'].join('\n');

    const mappings: ColumnMapping[] = [
      { csvColumn: 'name', targetField: 'title' },
      { csvColumn: 'url', targetField: 'url' },
      { csvColumn: 'username', targetField: 'username' },
      { csvColumn: 'password', targetField: 'password' },
      { csvColumn: 'extra', targetField: null },
    ];

    const items = parseGenericCsv(csv, mappings);

    expect(items).toHaveLength(1);
    expect(items[0].fields).toEqual({
      url: 'https://a.com',
      username: 'u1',
      password: 'p1',
    });
    expect(items[0].fields).not.toHaveProperty('extra');
  });

  it('标题为空时应填充"未命名条目"', () => {
    const csv = ['name,url,username,password', ',https://example.com,user,pass'].join('\n');

    const mappings: ColumnMapping[] = [
      { csvColumn: 'name', targetField: 'title' },
      { csvColumn: 'url', targetField: 'url' },
      { csvColumn: 'username', targetField: 'username' },
      { csvColumn: 'password', targetField: 'password' },
    ];

    const items = parseGenericCsv(csv, mappings);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('未命名条目');
    expect(items[0].fields.url).toBe('https://example.com');
  });

  it('应跳过空行', () => {
    const csv = [
      'name,url,username,password',
      'Item1,https://a.com,u1,p1',
      '',
      'Item2,https://b.com,u2,p2',
    ].join('\n');

    const mappings: ColumnMapping[] = [
      { csvColumn: 'name', targetField: 'title' },
      { csvColumn: 'url', targetField: 'url' },
    ];

    const items = parseGenericCsv(csv, mappings);

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('Item1');
    expect(items[1].title).toBe('Item2');
  });

  it('应支持自定义 itemType（如 secure_note）', () => {
    const csv = ['title,notes', 'MyNote,这是笔记内容'].join('\n');

    const mappings: ColumnMapping[] = [
      { csvColumn: 'title', targetField: 'title' },
      { csvColumn: 'notes', targetField: 'notes' },
    ];

    const items = parseGenericCsv(csv, mappings, 'secure_note');

    expect(items).toHaveLength(1);
    expect(items[0].itemType).toBe('secure_note');
    expect(items[0].title).toBe('MyNote');
    expect(items[0].fields.notes).toBe('这是笔记内容');
  });

  it('应支持 totpSecret 字段映射', () => {
    const csv = ['name,totp', 'Item1,JBSWY3DPEHPK3PXP'].join('\n');

    const mappings: ColumnMapping[] = [
      { csvColumn: 'name', targetField: 'title' },
      { csvColumn: 'totp', targetField: 'totpSecret' },
    ];

    const items = parseGenericCsv(csv, mappings);

    expect(items).toHaveLength(1);
    expect(items[0].fields.totpSecret).toBe('JBSWY3DPEHPK3PXP');
  });

  it('默认 itemType 应为 login', () => {
    const csv = ['name', 'Item1'].join('\n');

    const mappings: ColumnMapping[] = [{ csvColumn: 'name', targetField: 'title' }];

    const items = parseGenericCsv(csv, mappings);

    expect(items).toHaveLength(1);
    expect(items[0].itemType).toBe('login');
  });
});
