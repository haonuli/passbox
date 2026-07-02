// @vitest-environment node
/**
 * getSafeRedirect 单元测试（M-2 开放重定向防护）
 */
import { describe, it, expect } from 'vitest';
import { getSafeRedirect } from '@/lib/redirect';

describe('getSafeRedirect - 开放重定向防护（M-2）', () => {
  it('合法相对路径 → 原样返回', () => {
    expect(getSafeRedirect('/vault')).toBe('/vault');
    expect(getSafeRedirect('/settings')).toBe('/settings');
    expect(getSafeRedirect('/items/abc-123')).toBe('/items/abc-123');
  });

  it('带查询参数的相对路径 → 原样返回', () => {
    expect(getSafeRedirect('/vault?foo=bar')).toBe('/vault?foo=bar');
    expect(getSafeRedirect('/items?search=test&page=2')).toBe('/items?search=test&page=2');
  });

  it('null / undefined / 空字符串 → 回退 /vault', () => {
    expect(getSafeRedirect(null)).toBe('/vault');
    expect(getSafeRedirect(undefined)).toBe('/vault');
    expect(getSafeRedirect('')).toBe('/vault');
  });

  it('https:// 绝对 URL → 回退（防开放重定向）', () => {
    expect(getSafeRedirect('https://evil.com')).toBe('/vault');
    expect(getSafeRedirect('https://evil.com/phish')).toBe('/vault');
  });

  it('http:// 绝对 URL → 回退', () => {
    expect(getSafeRedirect('http://evil.com')).toBe('/vault');
  });

  it('协议相对 URL //evil.com → 回退', () => {
    expect(getSafeRedirect('//evil.com')).toBe('/vault');
    expect(getSafeRedirect('//evil.com/path')).toBe('/vault');
  });

  it('反斜杠协议相对 URL /\\evil.com → 回退', () => {
    expect(getSafeRedirect('/\\evil.com')).toBe('/vault');
    expect(getSafeRedirect('/\\evil.com/path')).toBe('/vault');
  });

  it('data: / javascript: / mailto: → 回退', () => {
    expect(getSafeRedirect('data:text/html,<script>alert(1)</script>')).toBe('/vault');
    expect(getSafeRedirect('javascript:alert(1)')).toBe('/vault');
    expect(getSafeRedirect('mailto:foo@bar.com')).toBe('/vault');
  });

  it('包含换行符（CRLF 注入兜底）→ 回退', () => {
    expect(getSafeRedirect('/vault\r\nSet-Cookie:evil=1')).toBe('/vault');
    expect(getSafeRedirect('/vault\n')).toBe('/vault');
  });

  it('相对路径无前导斜杠 → 回退', () => {
    expect(getSafeRedirect('vault')).toBe('/vault');
    expect(getSafeRedirect('relative/path')).toBe('/vault');
  });

  it('自定义 fallback 生效', () => {
    expect(getSafeRedirect(null, '/settings')).toBe('/settings');
    expect(getSafeRedirect('https://evil.com', '/settings')).toBe('/settings');
    expect(getSafeRedirect('/vault', '/settings')).toBe('/vault');
  });

  it('根路径 / → 原样返回', () => {
    expect(getSafeRedirect('/')).toBe('/');
  });
});
