import { create } from 'zustand';
import {
  fetchCollections,
  fetchCollectionItems,
  searchItems,
  buildRAGContext,
  type ZoteroCollection,
  type ZoteroItem,
} from '../lib/zotero';

interface ZoteroState {
  // 是否已配置 API Key
  configured: boolean;

  // Collection 文件夹列表
  collections: ZoteroCollection[];
  collectionsLoading: boolean;

  // 当前选中 Collection 的论文
  activeCollectionKey: string | null;
  activeCollectionName: string | null;
  papers: ZoteroItem[];
  papersLoading: boolean;

  // RAG 背景文本（每次选文件夹时更新，默默带进每次对话）
  ragContext: string;

  // 搜索（@zotero 实时联想）
  searchResults: ZoteroItem[];
  searching: boolean;

  // 配置
  checkConfig: () => void;
  saveConfig: (userId: string, apiKey: string) => void;

  // 动作
  loadCollections: () => Promise<void>;
  selectCollection: (key: string, name: string) => Promise<void>;
  search: (q: string) => Promise<void>;
  clearSearch: () => void;
}

export const useZoteroStore = create<ZoteroState>((set, get) => ({
  configured: (() => {
    try {
      return !!(localStorage.getItem('zotero_userId') && localStorage.getItem('zotero_apiKey'));
    } catch {
      return false;
    }
  })(),

  collections: [],
  collectionsLoading: false,

  activeCollectionKey: null,
  activeCollectionName: null,
  papers: [],
  papersLoading: false,

  ragContext: '',

  searchResults: [],
  searching: false,

  checkConfig: () => {
    try {
      const configured = !!(localStorage.getItem('zotero_userId') && localStorage.getItem('zotero_apiKey'));
      set({ configured });
    } catch {
      set({ configured: false });
    }
  },

  saveConfig: (userId: string, apiKey: string) => {
    try {
      localStorage.setItem('zotero_userId', userId);
      localStorage.setItem('zotero_apiKey', apiKey);
      set({ configured: true });
    } catch {}
  },

  loadCollections: async () => {
    set({ collectionsLoading: true });
    try {
      const collections = await fetchCollections();
      set({ collections, collectionsLoading: false });
    } catch (err) {
      console.warn('[Zotero] 拉取 Collection 失败，使用占位数据:', err);
      // 兜底：塞几个模拟文件夹让 UI 不空
      set({
        collections: [
          { key: 'mock_1', name: '体育产业核心', parentCollection: false },
          { key: 'mock_2', name: '消费者行为与营销', parentCollection: false },
          { key: 'mock_3', name: '实证方法论参考', parentCollection: false },
          { key: 'mock_4', name: '体育人文社会学', parentCollection: false },
        ],
        collectionsLoading: false,
      });
    }
  },

  selectCollection: async (key: string, name: string) => {
    set({
      activeCollectionKey: key,
      activeCollectionName: name,
      papersLoading: true,
    });
    try {
      const papers = await fetchCollectionItems(key);
      const ragContext = buildRAGContext(papers);
      set({ papers, papersLoading: false, ragContext });
      console.log(`[Zotero] ✅ 已加载「${name}」(${papers.length} 篇)，RAG 上下文已就绪`);
    } catch (err) {
      console.warn('[Zotero] 拉取论文条目失败:', err);
      // 兜底模拟数据
      const mockPapers: ZoteroItem[] = [
        {
          key: `p_1`, title: '体育赛事品牌资产与消费者忠诚度研究',
          creators: [{ firstName: 'Ming', lastName: 'Zhang' }],
          abstractNote: '本研究探讨了体育赛事品牌资产的多维度构成及其对消费者忠诚度的影响路径...',
          date: '2024', tags: [{ tag: '品牌资产' }], publicationTitle: '体育科学',
        },
        {
          key: `p_2`, title: 'A Meta-Analysis of Sport Event Sponsorship Effects',
          creators: [{ firstName: 'John', lastName: 'Smith' }],
          abstractNote: 'This meta-analysis synthesizes 30 years of sponsorship research...',
          date: '2023', tags: [{ tag: 'sponsorship' }], publicationTitle: 'Journal of Sport Management',
        },
        {
          key: `p_3`, title: '数字化时代体育产业转型路径研究',
          creators: [{ firstName: 'Wei', lastName: 'Chen' }],
          abstractNote: '本文分析了数字技术对体育产业价值链的重构作用...',
          date: '2025', tags: [{ tag: '数字化转型' }], publicationTitle: '北京体育大学学报',
        },
      ];
      const ragContext = buildRAGContext(mockPapers);
      set({ papers: mockPapers, papersLoading: false, ragContext });
      console.log(`[Zotero] ⚠️ 使用模拟数据 (${mockPapers.length} 篇)`);
    }
  },

  search: async (q: string) => {
    if (!q.trim()) {
      set({ searchResults: [], searching: false });
      return;
    }
    set({ searching: true });
    try {
      const results = await searchItems(q);
      set({ searchResults: results.slice(0, 8), searching: false });
    } catch {
      // 兜底：本地模糊过滤
      const { papers } = get();
      const lower = q.toLowerCase();
      const filtered = papers
        .filter(
          (p) =>
            p.title.toLowerCase().includes(lower) ||
            p.creators?.some((c) =>
              `${c.lastName} ${c.firstName}`.toLowerCase().includes(lower),
            ),
        )
        .slice(0, 8);
      set({ searchResults: filtered, searching: false });
    }
  },

  clearSearch: () => set({ searchResults: [], searching: false }),
}));
