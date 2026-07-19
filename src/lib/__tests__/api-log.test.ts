// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logApiError } from '../api-log';

describe('API 错误日志辅助 (api-log.ts) - L5 测试补全', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('错误信息提取', () => {
    it('Error 对象应提取 message', () => {
      logApiError('test/route', new Error('数据库连接失败'));
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('数据库连接失败');
    });

    it('非 Error 对象应使用"未知错误"', () => {
      logApiError('test/route', 'not an error');
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('未知错误');
    });

    it('null 应使用"未知错误"', () => {
      logApiError('test/route', null);
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('未知错误');
    });

    it('undefined 应使用"未知错误"', () => {
      logApiError('test/route', undefined);
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('未知错误');
    });
  });

  describe('日志格式', () => {
    it('应包含 [api:route] 前缀', () => {
      logApiError('items/create', new Error('test'));
      expect(consoleErrorSpy.mock.calls[0][0]).toMatch(
        /^\[api:items\/create\] /,
      );
    });

    it('应包含"未预期错误"标记', () => {
      logApiError('x', new Error('boom'));
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('未预期错误');
    });
  });

  describe('上下文处理', () => {
    it('无 context 时不应输出 ctx=', () => {
      logApiError('x', new Error('test'));
      expect(consoleErrorSpy.mock.calls[0][0]).not.toContain('ctx=');
    });

    it('空 context 对象不应输出 ctx=', () => {
      logApiError('x', new Error('test'), {});
      expect(consoleErrorSpy.mock.calls[0][0]).not.toContain('ctx=');
    });

    it('应输出 userId', () => {
      logApiError('x', new Error('test'), { userId: 'user-123' });
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('userId');
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('user-123');
    });

    it('应输出 pathParam', () => {
      logApiError('x', new Error('test'), { pathParam: 'item-abc' });
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('pathParam');
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('item-abc');
    });

    it('应输出 email', () => {
      logApiError('x', new Error('test'), { email: 'a@b.com' });
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('a@b.com');
    });

    it('应同时输出多个上下文字段', () => {
      logApiError('x', new Error('test'), {
        userId: 'u1',
        pathParam: 'p1',
        email: 'e@x.com',
      });
      const line = consoleErrorSpy.mock.calls[0][0] as string;
      expect(line).toContain('u1');
      expect(line).toContain('p1');
      expect(line).toContain('e@x.com');
    });

    it('undefined 字段应被过滤', () => {
      logApiError('x', new Error('test'), {
        userId: 'u1',
        pathParam: undefined,
        email: 'e@x.com',
      });
      const line = consoleErrorSpy.mock.calls[0][0] as string;
      expect(line).toContain('u1');
      expect(line).not.toContain('pathParam');
      expect(line).toContain('e@x.com');
    });
  });

  describe('ctx JSON 格式', () => {
    it('ctx 值应为合法 JSON', () => {
      logApiError('x', new Error('test'), { userId: 'u1' });
      const line = consoleErrorSpy.mock.calls[0][0] as string;
      const match = line.match(/ctx=(\{.*\})/);
      expect(match).not.toBeNull();
      expect(() => JSON.parse(match![1])).not.toThrow();
      expect(JSON.parse(match![1])).toEqual({ userId: 'u1' });
    });
  });
});
