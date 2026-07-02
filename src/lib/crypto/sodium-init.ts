/**
 * libsodium 初始化与预加载 (T2.2)
 *
 * libsodium-wrappers-sumo 在使用前必须 await `ready`（内部完成模块初始化）。
 * 本模块提供单例化的 ready Promise，确保初始化只发生一次，并在失败时可重试。
 *
 * 注意：libsodium-wrappers-sumo v0.8.4 为 **pure JS（asm.js）** 实现，非 WASM。
 * 因此无需 CSP `script-src 'wasm-unsafe-eval'`（与技术设计 10.x 的"WASM"描述存在偏差，
 * 见 TASK_TRACKING 2026-07-02 T2.2 变更说明）。功能等价：提供 Argon2id (ALG_ARGON2ID13)。
 *
 * 客户端使用；应用初始化时应调用 `ensureSodiumReady()` 预加载，使首次派生无额外延迟。
 */
import sodium from 'libsodium-wrappers-sumo';

let readyPromise: Promise<void> | null = null;

/**
 * 确保 libsodium 已完成初始化。
 * 单例化：多次调用复用同一个 Promise，不重复初始化。
 * 失败时清除 Promise 允许重试。
 */
export function ensureSodiumReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = sodium.ready.then(
      () => undefined,
      (err: unknown) => {
        readyPromise = null; // 允许下次重试
        throw err;
      },
    );
  }
  return readyPromise;
}

export { sodium };
