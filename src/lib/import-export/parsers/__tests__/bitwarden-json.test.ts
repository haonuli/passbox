import { describe, it, expect } from 'vitest';
import { parseBitwardenJson } from '../bitwarden-json';

describe('parseBitwardenJson', () => {
  it('应正确解析 login 类型（含 uris 数组）', () => {
    const json = JSON.stringify({
      encrypted: false,
      items: [
        {
          type: 1,
          name: 'GitHub',
          notes: '我的备注',
          favorite: false,
          folder: 'Personal',
          login: {
            username: 'ghuser',
            password: 'ghpass',
            uris: [{ uri: 'https://github.com' }],
            totp: 'otpsecret',
          },
        },
      ],
    });

    const items = parseBitwardenJson(json);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('GitHub');
    expect(items[0].itemType).toBe('login');
    expect(items[0].fields.url).toBe('https://github.com');
    expect(items[0].fields.username).toBe('ghuser');
    expect(items[0].fields.password).toBe('ghpass');
    expect(items[0].fields.totpSecret).toBe('otpsecret');
    expect(items[0].fields.notes).toBe('我的备注');
    expect(items[0].favorite).toBe(false);
    expect(items[0].tags).toEqual(['Personal']);
  });

  it('应正确解析 secure_note 类型', () => {
    const json = JSON.stringify({
      encrypted: false,
      items: [
        {
          type: 2,
          name: '我的笔记',
          notes: '这是笔记内容',
        },
      ],
    });

    const items = parseBitwardenJson(json);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('我的笔记');
    expect(items[0].itemType).toBe('secure_note');
    expect(items[0].fields.noteText).toBe('这是笔记内容');
    expect(items[0].tags).toEqual([]);
  });

  it('应正确解析 credit_card 类型（验证 expiry 格式）', () => {
    const json = JSON.stringify({
      encrypted: false,
      items: [
        {
          type: 3,
          name: '我的信用卡',
          notes: '信用卡备注',
          card: {
            cardholderName: 'Zhang San',
            number: '4111111111111111',
            code: '123',
            expMonth: 6,
            expYear: 28,
          },
        },
      ],
    });

    const items = parseBitwardenJson(json);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('我的信用卡');
    expect(items[0].itemType).toBe('credit_card');
    expect(items[0].fields.cardholder).toBe('Zhang San');
    expect(items[0].fields.cardNumber).toBe('4111111111111111');
    expect(items[0].fields.expiry).toBe('6/28');
    expect(items[0].fields.cvv).toBe('123');
    expect(items[0].fields.notes).toBe('信用卡备注');
  });

  it('应正确解析 identity 类型', () => {
    const json = JSON.stringify({
      encrypted: false,
      items: [
        {
          type: 4,
          name: '我的身份',
          notes: '备注',
          folder: 'Work',
          identity: {
            firstName: 'San',
            lastName: 'Zhang',
            address1: 'No.1 Street',
            phone: '13800000000',
            email: 'zhang@example.com',
          },
        },
      ],
    });

    const items = parseBitwardenJson(json);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('我的身份');
    expect(items[0].itemType).toBe('identity');
    expect(items[0].fields.firstName).toBe('San');
    expect(items[0].fields.lastName).toBe('Zhang');
    expect(items[0].fields.address).toBe('No.1 Street');
    expect(items[0].fields.phone).toBe('13800000000');
    expect(items[0].fields.email).toBe('zhang@example.com');
    expect(items[0].fields.notes).toBe('备注');
    expect(items[0].tags).toEqual(['Work']);
  });

  it('应将 folder 映射到 tags', () => {
    const json = JSON.stringify({
      encrypted: false,
      items: [
        {
          type: 1,
          name: 'Twitter',
          folder: 'Social',
          login: {
            uris: [{ uri: 'https://twitter.com' }],
            username: 'user',
            password: 'pass',
          },
        },
      ],
    });

    const items = parseBitwardenJson(json);

    expect(items).toHaveLength(1);
    expect(items[0].tags).toEqual(['Social']);
  });

  it('应正确解析 favorite 字段', () => {
    const json = JSON.stringify({
      encrypted: false,
      items: [
        {
          type: 1,
          name: 'FavItem',
          favorite: true,
          login: {
            uris: [{ uri: 'https://example.com' }],
            username: 'u',
            password: 'p',
          },
        },
        {
          type: 1,
          name: 'NoFavItem',
          favorite: false,
          login: {
            uris: [{ uri: 'https://example.org' }],
            username: 'u2',
            password: 'p2',
          },
        },
      ],
    });

    const items = parseBitwardenJson(json);

    expect(items[0].favorite).toBe(true);
    expect(items[1].favorite).toBe(false);
  });

  it('空标题应填充"未命名条目"', () => {
    const json = JSON.stringify({
      encrypted: false,
      items: [
        {
          type: 1,
          name: '',
          login: {
            uris: [{ uri: 'https://example.com' }],
            username: 'user',
            password: 'pass',
          },
        },
      ],
    });

    const items = parseBitwardenJson(json);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('未命名条目');
    expect(items[0].fields.url).toBe('https://example.com');
  });

  it('uris 为空数组时不崩溃', () => {
    const json = JSON.stringify({
      encrypted: false,
      items: [
        {
          type: 1,
          name: 'NoUri',
          login: {
            username: 'user',
            password: 'pass',
            uris: [],
          },
        },
      ],
    });

    const items = parseBitwardenJson(json);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('NoUri');
    expect(items[0].fields.url).toBeUndefined();
    expect(items[0].fields.username).toBe('user');
    expect(items[0].fields.password).toBe('pass');
  });

  it('加密文件应抛出错误', () => {
    const json = JSON.stringify({
      encrypted: true,
      items: [],
    });

    expect(() => parseBitwardenJson(json)).toThrow(
      '不支持加密的 Bitwarden 导出文件，请先解密',
    );
  });
});
