/**
 * API 客户端
 *
 * 与 PassBox Web App 后端 API 通信。
 * 开发环境指向 localhost:3000，生产环境需修改为实际域名。
 */
const API_BASE = 'http://localhost:3000';

/** Prelogin 响应 */
interface PreloginResponse {
  kdfSalt: string;
  kdfParams: { memoryKib: number; iterations: number; parallelism: number };
}

/** Login 响应 */
interface LoginResponse {
  user: { id: string; email: string };
  encryptedKey: { v: 1; iv: string; ct: string };
  kdfSalt: string;
  kdfParams: { memoryKib: number; iterations: number; parallelism: number };
  requiresTwoFactor?: boolean;
  ticket?: string;
}

/** Vault 响应 */
interface VaultResponse {
  vaults: { id: string; name_encrypted: { v: 1; iv: string; ct: string } }[];
  items: {
    id: string;
    vault_id: string;
    item_type_id: number;
    title_encrypted: { v: 1; iv: string; ct: string };
    data_encrypted: { v: 1; iv: string; ct: string };
    is_favorite: boolean;
  }[];
  tags: { id: string; name_encrypted: { v: 1; iv: string; ct: string } }[];
  itemTypes: { id: number; code: string; name: string }[];
}

/** Session 响应 */
interface SessionResponse {
  user: { id: string; email: string };
  encryptedKey: { v: 1; iv: string; ct: string };
  kdfSalt: string;
  kdfParams: { memoryKib: number; iterations: number; parallelism: number };
}

/** Prelogin 请求 */
export async function prelogin(email: string): Promise<PreloginResponse> {
  const res = await fetch(`${API_BASE}/api/auth/prelogin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Prelogin 失败');
  return res.json();
}

/** Login 请求 */
export async function login(email: string, authHash: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, authHash }),
    credentials: 'include',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? '登录失败');
  }
  return res.json();
}

/** 获取会话信息 */
export async function getSession(): Promise<SessionResponse | null> {
  const res = await fetch(`${API_BASE}/api/auth/session`, {
    method: 'GET',
    credentials: 'include',
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error('获取会话失败');
  return res.json();
}

/** 获取加密 vault 数据 */
export async function getVault(): Promise<VaultResponse> {
  const res = await fetch(`${API_BASE}/api/vault`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('获取密码库失败');
  return res.json();
}

/** 创建条目 */
export async function createItem(data: {
  itemId: string;
  vaultId: string;
  itemTypeId: number;
  titleEncrypted: { v: 1; iv: string; ct: string };
  dataEncrypted: { v: 1; iv: string; ct: string };
  tagIds: string[];
}): Promise<void> {
  const res = await fetch(`${API_BASE}/api/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('创建条目失败');
}

/** 更新条目 */
export async function updateItem(
  itemId: string,
  data: {
    titleEncrypted: { v: 1; iv: string; ct: string };
    dataEncrypted: { v: 1; iv: string; ct: string };
  },
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/items/${itemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('更新条目失败');
}

/** 检查 session cookie 是否存在 */
export async function hasSessionCookie(): Promise<boolean> {
  const cookies = await chrome.cookies.getAll({ url: API_BASE });
  return cookies.some((c) => c.name.includes('session') || c.name.includes('token'));
}
