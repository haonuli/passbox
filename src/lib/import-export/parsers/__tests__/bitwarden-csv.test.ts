import { describe, it, expect } from 'vitest';
import { parseBitwardenCsv } from '../bitwarden-csv';

describe('parseBitwardenCsv', () => {
  it('应正确解析 login 类型（type=1）', () => {
    const csv = [
      'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp',
      'Personal,0,1,GitHub,我的备注,,0,https://github.com,ghuser,ghpass,otpsecret',
    ].join('\n');

    const items = parseBitwardenCsv(csv);

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

  it('应正确解析 secure_note 类型（type=2）', () => {
    const csv = [
      'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp',
      ',0,2,我的笔记,这是笔记内容,,,',
    ].join('\n');

    const items = parseBitwardenCsv(csv);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('我的笔记');
    expect(items[0].itemType).toBe('secure_note');
    expect(items[0].fields.noteText).toBe('这是笔记内容');
    expect(items[0].tags).toEqual([]);
  });

  it('应正确解析 credit_card 类型（type=3，expiry 为 MM/YY 格式）', () => {
    const csv = [
      'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp,card_cardholdername,card_expmonth,card_expyear,card_cvv,card_number',
      ',0,3,我的信用卡,信用卡备注,,,,,,,Zhang San,06,28,123,4111111111111111',
    ].join('\n');

    const items = parseBitwardenCsv(csv);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('我的信用卡');
    expect(items[0].itemType).toBe('credit_card');
    expect(items[0].fields.cardholder).toBe('Zhang San');
    expect(items[0].fields.cardNumber).toBe('4111111111111111');
    expect(items[0].fields.expiry).toBe('06/28');
    expect(items[0].fields.cvv).toBe('123');
    expect(items[0].fields.notes).toBe('信用卡备注');
  });

  it('应正确解析 identity 类型（type=4）', () => {
    const csv = [
      'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp,card_cardholdername,card_expmonth,card_expyear,card_cvv,card_number,identity_title,identity_firstname,identity_lastname,identity_address1,identity_phone,identity_email',
      'Work,0,4,我的身份,备注,,,,,,,,,,,,Mr,San,Zhang,No.1 Street,13800000000,zhang@example.com',
    ].join('\n');

    const items = parseBitwardenCsv(csv);

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
    const csv = [
      'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp',
      'Social,0,1,Twitter,,https://twitter.com,user,pass,',
    ].join('\n');

    const items = parseBitwardenCsv(csv);

    expect(items).toHaveLength(1);
    expect(items[0].tags).toEqual(['Social']);
  });

  it('应正确解析 favorite 字段（"1" -> true, "true" -> true, "0" -> false）', () => {
    const csv = [
      'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp',
      ',1,1,Fav1,,https://a.com,u1,p1,',
      ',true,1,Fav2,,https://b.com,u2,p2,',
      ',0,1,NoFav,,https://c.com,u3,p3,',
    ].join('\n');

    const items = parseBitwardenCsv(csv);

    expect(items[0].favorite).toBe(true);
    expect(items[1].favorite).toBe(true);
    expect(items[2].favorite).toBe(false);
  });

  it('应跳过空行', () => {
    const csv = [
      'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp',
      ',0,1,Item1,,https://a.com,u1,p1,',
      '',
      ',0,1,Item2,,https://b.com,u2,p2,',
    ].join('\n');

    const items = parseBitwardenCsv(csv);

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('Item1');
    expect(items[1].title).toBe('Item2');
  });
});
