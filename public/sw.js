/**
 * PassBox Service Worker
 *
 * 缓存策略：
 * - App Shell (HTML/JS/CSS): Cache First, 回退 Network
 * - /api/vault: Network First, 回退 Cache (stale-while-revalidate)
 * - 其他 API: Network Only
 * - 静态资源: Cache First
 */

const CACHE_NAME = 'passbox-v1';
const APP_SHELL_CACHE = 'passbox-shell-v1';
const API_CACHE = 'passbox-api-v1';

/** App Shell 资源 */
const SHELL_ASSETS = [
  '/',
  '/vault',
  '/manifest.json',
  '/icon.svg',
];

// ============================================================
// Install: 预缓存 App Shell
// ============================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  self.skipWaiting();
});

// ============================================================
// Activate: 清理旧缓存
// ============================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![APP_SHELL_CACHE, API_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

// ============================================================
// Fetch: 路由缓存策略
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 仅处理同源请求
  if (url.origin !== self.location.origin) return;

  // 非 GET 请求直接放行
  if (request.method !== 'GET') return;

  // /api/vault: Network First, 回退 Cache
  if (url.pathname === '/api/vault') {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // 其他 API: Network Only
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // HTML 导航请求: Network First, 回退缓存的 App Shell
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, APP_SHELL_CACHE, '/'));
    return;
  }

  // 静态资源: Cache First, 回退 Network
  event.respondWith(cacheFirst(request, APP_SHELL_CACHE));
});

// ============================================================
// 缓存策略函数
// ============================================================

/** Cache First: 优先缓存，回退网络 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

/** Network First: 优先网络，回退缓存 */
async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }

    return new Response('离线且无缓存可用', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
