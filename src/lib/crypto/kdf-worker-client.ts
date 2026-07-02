/**
 * KDF Web Worker 客户端封装 (T3.5)
 *
 * 将 kdf.worker.ts 的消息通信协议封装为 Promise API，
 * 供注册 / 登录 / 解锁流程调用。Argon2id 派生在 Worker 线程执行，
 * 避免阻塞主线程 UI（~300ms-1s 耗时）。
 *
 * 设计要点：
 *   - 懒加载：首次调用时创建 Worker 实例，后续复用
 *   - 并发安全：每次调用注册独立 message 监听器，完成后移除
 *   - 浏览器专用：Worker 仅在客户端实例化（SSR 时不创建）
 *
 * @see kdf.worker.ts, TECHNICAL_DESIGN.md 9.1
 */
import type { KdfConfig } from './types';

/** Worker 请求消息 */
interface KdfWorkerRequest {
  password: string;
  config: KdfConfig;
}

/** Worker 响应消息 */
interface KdfWorkerResponse {
  ok: boolean;
  masterKey?: Uint8Array;
  error?: string;
}

let workerInstance: Worker | null = null;

/**
 * 获取或创建 KDF Worker 单例。
 * 仅在浏览器环境调用（此模块由 'use client' 代码引入）。
 */
function getWorker(): Worker {
  if (workerInstance !== null) {
    return workerInstance;
  }
  workerInstance = new Worker(new URL('./kdf.worker.ts', import.meta.url));
  return workerInstance;
}

/**
 * 通过 Web Worker 执行 Argon2id 密钥派生（不阻塞主线程）。
 *
 * @param password 用户主密码
 * @param config KDF 配置（含 salt / memoryCost / timeCost / parallelism）
 * @returns 32 字节 Master Key
 * @throws Error 当 Worker 执行失败或浏览器不支持 Worker 时
 */
export function deriveMasterKeyViaWorker(
  password: string,
  config: KdfConfig,
): Promise<Uint8Array> {
  return new Promise<Uint8Array>((resolve, reject) => {
    if (typeof Worker === 'undefined') {
      reject(new Error('当前环境不支持 Web Worker，无法执行密钥派生'));
      return;
    }

    const worker = getWorker();

    const handleMessage = (e: MessageEvent<KdfWorkerResponse>): void => {
      worker.removeEventListener('message', handleMessage);
      if (e.data.ok && e.data.masterKey) {
        resolve(e.data.masterKey);
      } else {
        reject(new Error(e.data.error ?? 'KDF 派生失败'));
      }
    };

    const handleError = (e: ErrorEvent): void => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      reject(new Error(e.message ?? 'Worker 执行错误'));
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);

    const request: KdfWorkerRequest = { password, config };
    worker.postMessage(request);
  });
}

/**
 * 终止 Worker 实例（测试 / 登出清理用）。
 * 终止后再次调用 deriveMasterKeyViaWorker 会创建新 Worker。
 */
export function terminateKdfWorker(): void {
  if (workerInstance !== null) {
    workerInstance.terminate();
    workerInstance = null;
  }
}
