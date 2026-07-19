/**
 * KDF Web Worker 客户端封装 (T3.5)
 *
 * 将 kdf.worker.ts 的消息通信协议封装为 Promise API，
 * 供注册 / 登录 / 解锁流程调用。Argon2id 派生在 Worker 线程执行，
 * 避免阻塞主线程 UI（~300ms-1s 耗时）。
 *
 * 设计要点：
 *   - 懒加载：首次调用时创建 Worker 实例，后续复用
 *   - 并发安全（M-1 修复）：每次请求携带唯一 requestId，监听器
 *     仅消费与自身 requestId 匹配的响应，避免并发调用互相串台
 *     导致返回错误 Master Key（可造成永久数据丢失）
 *   - 超时保护：30s 未响应自动 reject 并清理监听器，防止泄漏
 *   - 浏览器专用：Worker 仅在客户端实例化（SSR 时不创建）
 *
 * @see kdf.worker.ts, TECHNICAL_DESIGN.md 9.1
 */
import { toast } from 'sonner';
import type { KdfConfig } from './types';

/** Worker 请求消息 */
interface KdfWorkerRequest {
  requestId: number;
  password: string;
  config: KdfConfig;
}

/** Worker 响应消息 */
interface KdfWorkerResponse {
  requestId: number;
  ok: boolean;
  masterKey?: Uint8Array;
  error?: string;
}

/** 派生超时（毫秒），正常 Argon2id 耗时 <2s，30s 兜底防止永久挂起 */
const KDF_TIMEOUT_MS = 30_000;

let workerInstance: Worker | null = null;

/** 自增请求 ID，用于匹配请求与响应（解决单例 Worker 并发串台问题） */
let nextRequestId = 1;

/** UX-048：Worker 降级提示是否已显示（会话内只提示一次） */
let workerFallbackWarned = false;

/**
 * 获取或创建 KDF Worker 单例。
 * 仅在浏览器环境调用（此模块由 'use client' 代码引入）。
 */
function getWorker(): Worker | null {
  if (workerInstance !== null) {
    return workerInstance;
  }
  try {
    workerInstance = new Worker(new URL('./kdf.worker.ts', import.meta.url));
    return workerInstance;
  } catch {
    // UX-048：Worker 创建失败时提示用户主线程加密可能卡顿
    if (!workerFallbackWarned) {
      workerFallbackWarned = true;
      toast.warning('加密 Worker 不可用，将使用主线程派生密钥，期间界面可能短暂卡顿', {
        duration: 6000,
      });
    }
    return null;
  }
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
    if (worker === null) {
      reject(new Error('Web Worker 创建失败，无法执行密钥派生'));
      return;
    }
    const requestId = nextRequestId++;
    let settled = false;

    const cleanup = (): void => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      clearTimeout(timer);
    };

    const handleMessage = (e: MessageEvent<KdfWorkerResponse>): void => {
      // M-1 关键修复：仅消费与自身 requestId 匹配的响应，忽略其他请求的响应
      if (e.data.requestId !== requestId) {
        return;
      }
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      if (e.data.ok && e.data.masterKey) {
        resolve(e.data.masterKey);
      } else {
        reject(new Error(e.data.error ?? 'KDF 派生失败'));
      }
    };

    const handleError = (e: ErrorEvent): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new Error(e.message ?? 'Worker 执行错误'));
    };

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new Error('KDF 派生超时'));
    }, KDF_TIMEOUT_MS);

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);

    const request: KdfWorkerRequest = { requestId, password, config };
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
