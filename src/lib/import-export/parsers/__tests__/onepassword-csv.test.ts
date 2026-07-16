import { describe, it, expect } from 'vitest';
import { parseOnepasswordCsv } from '../onepassword-csv';

describe('parseOnepasswordCsv', () => {
  it('应正确解析标准 CSV（3 条数据）', () => {
    const csv = [
      'Title,Url,Username,Password,Notes',
      'Google,https://google.com,user1,pass1,备注1',
      'GitHub,https://github.com,user2,pass2,备注2',
      'Twitter,https://twitter.com,user3,pass3,备注3',
    ].join('\n');

    const items = parseOnepasswordCsv(csv);

    expect(items).toHaveLength(3);

    expect(items[0]).toEqual({
      title: 'Google',
      itemType: 'login',
      fields: {
        url: 'https://google.com',
        username: 'user1',
        password: 'pass1',
        notes: '备注1',
      },
      favorite: false,
      tags: [],
    });

    expect(items[1].title).toBe('GitHub');
    expect(items[1].fields.password).toBe('pass2');

    expect(items[2].title).toBe('Twitter');
    expect(items[2].fields.url).toBe('https://twitter.com');
  });

  it('列名大小写不敏感（Title vs title vs TITLE）', () => {
    const csv1 = [
      'Title,Url,Username,Password',
      'Item1,https://a.com,u1,p1',
    ].join('\n');

    const csv2 = [
      'title,url,username,password',
      'Item2,https://b.com,u2,p2',
    ].join('\n');

    const csv3 = [
      'TITLE,URL,USERNAME,PASSWORD',
      'Item3,https://c.com,u3,p3',
    ].join('\n');

    const items1 = parseOnepasswordCsv(csv1);
    const items2 = parseOnepasswordCsv(csv2);
    const items3 = parseOnepasswordCsv(csv3);

    expect(items1[0].title).toBe('Item1');
    expect(items1[0].fields.url).toBe('https://a.com');

    expect(items2[0].title).toBe('Item2');
    expect(items2[0].fields.url).toBe('https://b.com');

    expect(items3[0].title).toBe('Item3');
    expect(items3[0].fields.url).toBe('https://c.com');
  });

  it('应支持列名变体（Name/Website/Email/Note）', () => {
    const csv = [
      'Name,Website,Email,Password,Note',
      'TestItem,https://test.com,test@example.com,pass,备注内容',
    ].join('\n');

    const items = parseOnepasswordCsv(csv);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('TestItem');
    expect(items[0].fields.url).toBe('https://test.com');
    expect(items[0].fields.username).toBe('test@example.com');
    expect(items[0].fields.password).toBe('pass');
    expect(items[0].fields.notes).toBe('备注内容');
  });

  it('应处理空值', () => {
    const csv = ['Title,Url,Username,Password,Notes', 'NoPass,,,'].join('\n');

    const items = parseOnepasswordCsv(csv);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('NoPass');
    expect(items[0].fields.url).toBeUndefined();
    expect(items[0].fields.username).toBeUndefined();
    expect(items[0].fields.password).toBeUndefined();
    expect(items[0].fields.notes).toBeUndefined();
  });

  it('应跳过空行', () => {
    const csv = [
      'Title,Url,Username,Password',
      'Item1,https://a.com,u1,p1',
      '',
      ',,,',
      'Item2,https://b.com,u2,p2',
    ].join('\n');

    const items = parseOnepasswordCsv(csv);

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('Item1');
    expect(items[1].title).toBe('Item2');
  });

  it('标题为空时应填充"未命名条目"', () => {
    const csv = [
      'Title,Url,Username,Password',
      ',https://example.com,user,pass',
    ].join('\n');

    const items = parseOnepasswordCsv(csv);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('未命名条目');
    expect(items[0].fields.url).toBe('https://example.com');
  });
});
