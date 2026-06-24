import Dexie, { type Table } from 'dexie';

// ============================================================
// 颜色映射表：简短 key → Tailwind CSS 类名
// ============================================================
export const COLOR_MAP: Record<string, string> = {
  green:   'border-emerald-200/60 hover:border-emerald-400 bg-emerald-50 text-emerald-700',
  blue:    'border-blue-200/60 hover:border-blue-400 bg-blue-50 text-blue-700',
  amber:   'border-amber-200/60 hover:border-amber-400 bg-amber-50 text-amber-700',
  purple:  'border-purple-200/60 hover:border-purple-400 bg-purple-50 text-purple-700',
  red:     'border-red-200/60 hover:border-red-400 bg-red-50 text-red-700',
  cyan:    'border-cyan-200/60 hover:border-cyan-400 bg-cyan-50 text-cyan-700',
};

export const COLOR_OPTIONS = Object.keys(COLOR_MAP);

// ============================================================
// 类型定义
// ============================================================

export interface Project {
  id?: number;
  key: string;          // 'graduate' | 'conference'
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id?: number;
  projectKey: string;
  title: string;
  paperMode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id?: number;
  sessionId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface SkillItem {
  id?: number;
  name: string;
  icon: string;
  desc: string;
  prompt: string;
  color: string;
  isBuiltin: boolean;
  createdAt: Date;
}

/** 编辑器快照：每个项目独立存储 */
export interface EditorSnapshot {
  id?: number;
  projectKey: string;
  content: string;
  updatedAt: Date;
}

/** 双轨制文件舱：thesis = 本文工程进度, reference = 外部文献引用 */
export interface ThesisFile {
  id?: number;
  projectKey: string;
  name: string;
  size: number;
  type: string;
  content: string;        // 提取的纯文本
  wordCount: number;      // 字数
  category: 'thesis' | 'reference';
  uploadedAt: Date;
}

// ============================================================
// 论文大纲章节配置
// ============================================================
export interface ChapterConfig {
  id: string;
  title: string;
  targetWords: number;
}

export const DEFAULT_CHAPTERS: ChapterConfig[] = [
  { id: '1', title: '绪论', targetWords: 4000 },
  { id: '2', title: '文献综述与理论基础', targetWords: 6000 },
  { id: '3', title: '模型构建与研究假设', targetWords: 5000 },
  { id: '4', title: '实证分析与数据检验', targetWords: 6000 },
  { id: '5', title: '结论与建议', targetWords: 3000 },
];

// ============================================================
// 内置种子数据
// ============================================================
export const BUILTIN_SKILLS: Omit<SkillItem, 'id' | 'createdAt'>[] = [
  {
    name: 'AMOS/SPSS 数据体检',
    icon: '🩺',
    desc: '一键帮你分析问卷信效度、回归分析和中介效应的学术规范。',
    prompt:
      "请作为资深统计学专家，帮我审视以下定量研究的数据分析部分。重点检查 Cronbach's Alpha 信度系数、KMO 效度检验以及路径系数的显著性（p值）是否符合核心期刊的学术规范，并给出优化修正的模板：",
    color: 'green',
    isBuiltin: true,
  },
  {
    name: '核心期刊黑话降重',
    icon: '🧬',
    desc: '拒绝大白话，将口语一键转化为《体育科学》级别的学术黑话。',
    prompt:
      '请将以下段落转换为极具学术穿透力和高级感的学术话术。要求：采用严谨的实证主义叙事风格，多用"表征"、"解构"、"耦联机制"、"赋能路径"等核心学术词汇，并在逻辑上做到严丝合缝，同时保证查重率降到最低：',
    color: 'blue',
    isBuiltin: true,
  },
  {
    name: '国外前沿文献批判',
    icon: '⚖️',
    desc: '用批判性思维一键指出某篇国外文献的局限性，拉高文献综述档次。',
    prompt:
      '请采用学术批判性思维（Critical Thinking），帮我分析以下文献研究的局限性。请从样本代表性、变量内生性、以及跨文化背景下的适用性（特别是从西方环境迁移到中国本土体育产业时的制度隔阂）三个维度，列出 3 点尖锐但合理的学术批判意见：',
    color: 'amber',
    isBuiltin: true,
  },
  {
    name: 'APA/APA7 格式格式化',
    icon: '📏',
    desc: '一键规范参考文献，自动抓取中英文混排时的全半角标点和错漏。',
    prompt:
      '请严格按照《APA 7th》或国内核心期刊的引文规范，对以下混乱的参考文献进行格式化。请特别注意纠正英文作者姓名的缩写格式、刊名的斜体规范、以及中英文混排时逗号和句号的全半角错漏：',
    color: 'purple',
    isBuiltin: true,
  },
];

// ============================================================
// 数据库定义
// ============================================================
class ThesisFlowDatabase extends Dexie {
  sessions!: Table<Session>;
  messages!: Table<Message>;
  skills!: Table<SkillItem>;
  editorSnapshots!: Table<EditorSnapshot>;
  thesisFiles!: Table<ThesisFile>;

  constructor() {
    super('ThesisFlowDB');

    this.version(1).stores({
      sessions: '++id, title, paperMode, createdAt, updatedAt',
      messages: '++id, sessionId, role, timestamp',
    });

    this.version(2).stores({
      sessions: '++id, title, paperMode, createdAt, updatedAt',
      messages: '++id, sessionId, role, timestamp',
      skills: '++id, name, isBuiltin, createdAt',
    }).upgrade(async (tx) => {
      const table = tx.table<SkillItem>('skills');
      if ((await table.count()) === 0) {
        await table.bulkAdd(BUILTIN_SKILLS.map((s) => ({ ...s, createdAt: new Date() })));
        console.log('[ThesisFlowDB] ✅ 已写入 4 个内置 Skill 种子');
      }
    });

    // v3: 双轨制项目沙盒架构
    this.version(3).stores({
      sessions: '++id, projectKey, title, paperMode, createdAt, updatedAt',
      messages: '++id, sessionId, role, timestamp',
      skills: '++id, name, isBuiltin, createdAt',
      editorSnapshots: '++id, projectKey',
      thesisFiles: '++id, projectKey, category',
    }).upgrade(async (tx) => {
      // 为已有 sessions 补充 projectKey
      const sessionTable = tx.table<Session>('sessions');
      const allSessions = await sessionTable.toArray();
      for (const s of allSessions) {
        if (!s.projectKey) {
          await sessionTable.update(s.id!, { projectKey: s.paperMode || 'graduate' });
        }
      }
      console.log(`[ThesisFlowDB] ✅ v3 迁移完成，${allSessions.length} 条 session 已升级`);
    });
  }
}

export const db = new ThesisFlowDatabase();
