// ============================================================
// 观众自带 API Key —— 存浏览器 localStorage，随请求发给后端
// 服务器无 Key 时，观众填了自己的 Key 也能用 AI 对话
// ============================================================

export interface ApiKeys {
  deepseek?: string;
  glm?: string;
}

const STORAGE_KEY = 'thesis_api_keys';

export function loadApiKeys(): ApiKeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function saveApiKeys(keys: ApiKeys): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}
