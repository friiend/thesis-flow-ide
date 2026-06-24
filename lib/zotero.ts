// ============================================================
// Zotero Web API 客户端 —— 极简直连，无多余抽象
// ============================================================
// 配置占位符。实际使用时在 localStorage 中填入：
//   localStorage.setItem('zotero_userId', 'yourUserId');
//   localStorage.setItem('zotero_apiKey', 'yourApiKey');
// ============================================================

const ZOTERO_BASE = 'https://api.zotero.org';

interface ZoteroConfig {
  userId: string;
  apiKey: string;
}

function getConfig(): ZoteroConfig | null {
  try {
    const userId = localStorage.getItem('zotero_userId');
    const apiKey = localStorage.getItem('zotero_apiKey');
    if (userId && apiKey) return { userId, apiKey };
  } catch {}
  return null;
}

export interface ZoteroCollection {
  key: string;
  name: string;
  parentCollection: string | false;
}

export interface ZoteroItem {
  key: string;
  title: string;
  creators: { firstName: string; lastName: string }[];
  abstractNote: string;
  date: string;
  tags: { tag: string }[];
  publicationTitle: string;
}

function headers(cfg: ZoteroConfig): Record<string, string> {
  return {
    'Zotero-API-Key': cfg.apiKey,
    'Content-Type': 'application/json',
  };
}

// ----------------------------------------------------------
// 拉取用户的 Collection 文件夹列表
// ----------------------------------------------------------
export async function fetchCollections(): Promise<ZoteroCollection[]> {
  const cfg = getConfig();
  if (!cfg) throw new Error('Zotero 未配置：请在 localStorage 设置 zotero_userId 与 zotero_apiKey');

  const res = await fetch(
    `${ZOTERO_BASE}/users/${cfg.userId}/collections?limit=100`,
    { headers: headers(cfg) },
  );
  if (!res.ok) throw new Error(`Zotero API 错误 (${res.status})`);
  return res.json();
}

// ----------------------------------------------------------
// 拉取某个 Collection 下的所有条目（论文元数据）
// ----------------------------------------------------------
export async function fetchCollectionItems(
  collectionKey: string,
): Promise<ZoteroItem[]> {
  const cfg = getConfig();
  if (!cfg) throw new Error('Zotero 未配置');

  const res = await fetch(
    `${ZOTERO_BASE}/users/${cfg.userId}/collections/${collectionKey}/items/top?limit=100`,
    { headers: headers(cfg) },
  );
  if (!res.ok) throw new Error(`Zotero API 错误 (${res.status})`);
  return res.json();
}

// ----------------------------------------------------------
// 全量搜索：按标题/作者关键词模糊匹配
// ----------------------------------------------------------
export async function searchItems(q: string): Promise<ZoteroItem[]> {
  const cfg = getConfig();
  if (!cfg) throw new Error('Zotero 未配置');

  const res = await fetch(
    `${ZOTERO_BASE}/users/${cfg.userId}/items?q=${encodeURIComponent(q)}&limit=15`,
    { headers: headers(cfg) },
  );
  if (!res.ok) throw new Error(`Zotero API 错误 (${res.status})`);
  return res.json();
}

// ----------------------------------------------------------
// 格式化作者为 "LastName, Year" 引用格式
// ----------------------------------------------------------
export function formatCitation(item: ZoteroItem): string {
  const lastName =
    item.creators?.[0]?.lastName ||
    item.creators?.[0]?.firstName ||
    'Unknown';
  const year = item.date?.slice(0, 4) || 'n.d.';
  return `🏷️ ${lastName}, ${year}`;
}

// ----------------------------------------------------------
// 构建注入 AI 的 RAG 背景文本
// ----------------------------------------------------------
export function buildRAGContext(items: ZoteroItem[]): string {
  if (items.length === 0) return '';
  const lines = items.map(
    (it) =>
      `- **${it.title || 'Untitled'}** (${it.date?.slice(0, 4) || 'n.d.'}) — ${(it.abstractNote || '').slice(0, 200)}`,
  );
  return `# Zotero 知识库背景 (${items.length} 篇论文)\n${lines.join('\n')}\n`;
}
