/**
 * Argon2id Web Worker 入口 (T2.2)
 *
 * 在后台线程执行 Argon2id 派生，避免阻塞主线程 UI。
 * 主线程通过 `new Worker(new URL('./kdf.worker.ts', import.meta.url))` 实例化，
 * `postMessage({ requestId, password, config })` 触发派生，
 * 接收 `{ requestId, ok, masterKey | error }`。
 *
 * requestId 透传：解决单例 Worker 并发调用时响应串台问题（M-1），
 * 客户端监听器据此区分响应归属。
 *
 * 注意：Worker 的实际接线（实例化 + 消息协议封装）在 T3.5 注册流程中完成，
 * 本文件仅提供 Worker 入口实现。单元测试覆盖核心函数 deriveMasterKey（见 kdf.test.ts）。
 */
/// <reference lib="webworker" />

import { deriveMasterKey } from './kdf';
import type { KdfConfig } from './types';

interface KdfWorkerRequest {
  requestId: number;
  password: string;
  config: KdfConfig;
}

interface KdfWorkerResponse {
  requestId: number;
  ok: boolean;
  masterKey?: Uint8Array;
  error?: string;
}

self.onmessage = async (e: MessageEvent<KdfWorkerRequest>): Promise<void> => {
  const { requestId, password, config } = e.data;
  try {
    const masterKey = await deriveMasterKey(password, config);
    const response: KdfWorkerResponse = { requestId, ok: true, masterKey };
    (self as DedicatedWorkerGlobalScope).postMessage(response);
  } catch (err) {
    const response: KdfWorkerResponse = {
      requestId,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    (self as DedicatedWorkerGlobalScope).postMessage(response);
  }
};
