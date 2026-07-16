import { describe, it, expect } from 'vitest';
import { parseBrowserCsv } from '../browser-csv';

describe('parseBrowserCsv', () => {
  it('应正确解析标准 CSV（3 条登录数据）', () => {
    const csv = [
      'name,url,username,password',
      'Google,https://google.com,user1,pass1',
      'GitHub,https://github.com,user2,pass2',
      'Twitter,https://twitter.com,user3,pass3',
    ].join('\n');

    const items = parseBrowserCsv(csv);

    expect(items).toHaveLength(3);

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

    expect(items[2].title).toBe('Twitter');
    expect(items[2].fields.url).toBe('https://twitter.com');
  });

  it('应处理 password 为空的情况', () => {
    const csv = ['name,url,username,password', 'NoPass,https://example.com,user,'].join('\n');

    const items = parseBrowserCsv(csv);

    expect(items).toHaveLength(1);
    expect(items[0].fields.password).toBe('');
    expect(items[0].title).toBe('NoPass');
  });

  it('应正确处理包含逗号和引号的特殊密码', () => {
    const csv = [
      'name,url,username,password',
      'Special,https://example.com,user,"p@ss,word""quote"',
    ].join('\n');

    const items = parseBrowserCsv(csv);

    expect(items).toHaveLength(1);
    expect(items[0].fields.password).toBe('p@ss,word"quote');
  });

  it('应跳过空行', () => {
    const csv = [
      'name,url,username,password',
      'Item1,https://example.com,user1,pass1',
      '',
      ',,,',
      'Item2,https://example.org,user2,pass2',
    ].join('\n');

    const items = parseBrowserCsv(csv);

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('Item1');
    expect(items[1].title).toBe('Item2');
  });

  it('标题为空时应填充"未命名条目"', () => {
    const csv = ['name,url,username,password', ',https://example.com,user,pass'].join('\n');

    const items = parseBrowserCsv(csv);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('未命名条目');
    expect(items[0].fields.url).toBe('https://example.com');
  });

  it('应将 note 列映射到 notes', () => {
    const csv = [
      'name,url,username,password,note',
      'WithNote,https://example.com,user,pass,这是备注',
    ].join('\n');

    const items = parseBrowserCsv(csv);

    expect(items).toHaveLength(1);
    expect(items[0].fields.notes).toBe('这是备注');
  });
});
