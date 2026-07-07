// @vitest-environment node
/**
 * KDF Worker 客户端单元测试（M-1 竞态条件回归测试）
 *
 * 验证单例 Worker 并发调用时，响应不会串台——每个 Promise 必须收到
 * 与自身 requestId 匹配的响应，而非其他请求的响应。
 *
 * 通过 mock globalThis.Worker，在测试侧控制响应派发顺序。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================
// Mock Worker：捕获 postMessage 请求，允许测试侧派发响应
// ============================================================

interface CapturedRequest {
  requestId: number;
  password: string;
  config: unknown;
}

interface FakeWorkerInstance {
  postMessage: (msg: CapturedRequest) => void;
  addEventListener: (type: string, listener: (e: { data: unknown }) => void) => void;
  removeEventListener: (type: string, listener: (e: { data: unknown }) => void) => void;
  terminate: () => void;
  // 测试侧可读写的内部状态
  __capturedRequests: CapturedRequest[];
  __messageListeners: Array<(e: { data: unknown }) => void>;
  __errorListeners: Array<(e: { message: string }) => void>;
  __dispatchMessage: (data: unknown) => void;
  __dispatchError: (message: string) => void;
}

let fakeWorker: FakeWorkerInstance;
let originalWorker: typeof Worker | undefined;

function installFakeWorker(): void {
  fakeWorker = {
    __capturedRequests: [],
    __messageListeners: [],
    __errorListeners: [],
    postMessage(msg: CapturedRequest) {
      this.__capturedRequests.push(msg);
    },
    addEventListener(type: string, listener: (e: { data: unknown }) => void) {
      if (type === 'message') {
        this.__messageListeners.push(listener);
      } else if (type === 'error') {
        this.__errorListeners.push(listener as unknown as (e: { message: string }) => void);
      }
    },
    removeEventListener(type: string, listener: (e: { data: unknown }) => void) {
      if (type === 'message') {
        this.__messageListeners = this.__messageListeners.filter((l) => l !== listener);
      } else if (type === 'error') {
        this.__errorListeners = this.__errorListeners.filter(
          (l) => l !== (listener as unknown as (e: { message: string }) => void),
        );
      }
    },
    terminate() {
      /* no-op */
    },
    __dispatchMessage(data: unknown) {
      // 复制一份，因为监听器可能在派发过程中被移除
      const listeners = [...this.__messageListeners];
      for (const l of listeners) {
        l({ data });
      }
    },
    __dispatchError(message: string) {
      const listeners = [...this.__errorListeners];
      for (const l of listeners) {
        l({ message });
      }
    },
  };
  originalWorker = globalThis.Worker;
  globalThis.Worker = function () {
    return fakeWorker;
  } as unknown as typeof Worker;
}

function restoreWorker(): void {
  if (originalWorker !== undefined) {
    globalThis.Worker = originalWorker;
  } else {
    delete (globalThis as Record<string, unknown>).Worker;
  }
}

describe('KDF Worker 客户端 - requestId 竞态条件修复（M-1）', () => {
  beforeEach(async () => {
    installFakeWorker();
    // 动态导入，确保拿到已安装 mock 后的模块
    vi.resetModules();
  });

  afterEach(() => {
    restoreWorker();
    vi.restoreAllMocks();
  });

  it('并发两次调用：每个 Promise 收到与自身 requestId 匹配的响应（不串台）', async () => {
    const { deriveMasterKeyViaWorker, terminateKdfWorker } = await import(
      '@/lib/crypto/kdf-worker-client'
    );

    const configA = { salt: new Uint8Array([1]), memoryKib: 65536, iterations: 3, parallelism: 4 };
    const configB = { salt: new Uint8Array([2]), memoryKib: 65536, iterations: 3, parallelism: 4 };

    // 同时发起两个并发请求（不 await）
    const promiseA = deriveMasterKeyViaWorker('password-A', configA as never);
    const promiseB = deriveMasterKeyViaWorker('password-B', configB as never);

    // 捕获到两个请求，各有唯一 requestId
    expect(fakeWorker.__capturedRequests).toHaveLength(2);
    const reqA = fakeWorker.__capturedRequests[0];
    const reqB = fakeWorker.__capturedRequests[1];
    expect(reqA.requestId).not.toBe(reqB.requestId);

    // 构造"错误"的响应顺序：先派发 B 的响应（此时 A 的监听器也在监听）
    const keyB = new Uint8Array([200]);
    const keyA = new Uint8Array([100]);
    fakeWorker.__dispatchMessage({ requestId: reqB.requestId, ok: true, masterKey: keyB });
    fakeWorker.__dispatchMessage({ requestId: reqA.requestId, ok: true, masterKey: keyA });

    const [resB, resA] = await Promise.all([promiseB, promiseA]);

    // 关键断言：A 收到 keyA，B 收到 keyB，不会因为先派发 B 而让 A 错收 keyB
    expect(Array.from(resA)).toEqual([100]);
    expect(Array.from(resB)).toEqual([200]);

    terminateKdfWorker();
  });

  it('乱序派发三个并发请求的响应，各自正确匹配', async () => {
    const { deriveMasterKeyViaWorker, terminateKdfWorker } = await import(
      '@/lib/crypto/kdf-worker-client'
    );

    const cfg = { salt: new Uint8Array([1]), memoryKib: 65536, iterations: 3, parallelism: 4 };

    const p1 = deriveMasterKeyViaWorker('pw1', cfg as never);
    const p2 = deriveMasterKeyViaWorker('pw2', cfg as never);
    const p3 = deriveMasterKeyViaWorker('pw3', cfg as never);

    expect(fakeWorker.__capturedRequests).toHaveLength(3);
    const ids = fakeWorker.__capturedRequests.map((r) => r.requestId);
    // requestId 唯一
    expect(new Set(ids).size).toBe(3);

    // 乱序派发：3 → 1 → 2
    const k1 = new Uint8Array([10]);
    const k2 = new Uint8Array([20]);
    const k3 = new Uint8Array([30]);
    fakeWorker.__dispatchMessage({ requestId: ids[2], ok: true, masterKey: k3 });
    fakeWorker.__dispatchMessage({ requestId: ids[0], ok: true, masterKey: k1 });
    fakeWorker.__dispatchMessage({ requestId: ids[1], ok: true, masterKey: k2 });

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
    expect(Array.from(r1)).toEqual([10]);
    expect(Array.from(r2)).toEqual([20]);
    expect(Array.from(r3)).toEqual([30]);

    terminateKdfWorker();
  });

  it('错误响应也按 requestId 匹配，不影响其他并发请求', async () => {
    const { deriveMasterKeyViaWorker, terminateKdfWorker } = await import(
      '@/lib/crypto/kdf-worker-client'
    );

    const cfg = { salt: new Uint8Array([1]), memoryKib: 65536, iterations: 3, parallelism: 4 };

    const pSuccess = deriveMasterKeyViaWorker('pw-ok', cfg as never);
    const pFail = deriveMasterKeyViaWorker('pw-fail', cfg as never);

    expect(fakeWorker.__capturedRequests).toHaveLength(2);
    const idSuccess = fakeWorker.__capturedRequests[0].requestId;
    const idFail = fakeWorker.__capturedRequests[1].requestId;

    // 先派发失败响应（针对 pw-fail），不应影响 pw-ok
    fakeWorker.__dispatchMessage({ requestId: idFail, ok: false, error: '派生失败' });
    // 再派发成功响应（针对 pw-ok）
    const key = new Uint8Array([42]);
    fakeWorker.__dispatchMessage({ requestId: idSuccess, ok: true, masterKey: key });

    await expect(pFail).rejects.toThrow('派生失败');
    const res = await pSuccess;
    expect(Array.from(res)).toEqual([42]);

    terminateKdfWorker();
  });

  it('完成后清理监听器，不残留', async () => {
    const { deriveMasterKeyViaWorker, terminateKdfWorker } = await import(
      '@/lib/crypto/kdf-worker-client'
    );

    const cfg = { salt: new Uint8Array([1]), memoryKib: 65536, iterations: 3, parallelism: 4 };

    const p = deriveMasterKeyViaWorker('pw', cfg as never);
    const id = fakeWorker.__capturedRequests[0].requestId;
    fakeWorker.__dispatchMessage({ requestId: id, ok: true, masterKey: new Uint8Array([1]) });
    await p;

    // 完成后 message 监听器应已移除
    expect(fakeWorker.__messageListeners).toHaveLength(0);
    expect(fakeWorker.__errorListeners).toHaveLength(0);

    terminateKdfWorker();
  });
});
