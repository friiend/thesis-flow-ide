import { create } from 'zustand';
import { db, DEFAULT_CHAPTERS, type ChapterConfig } from '../lib/db';

// ============================================================
// 中文数字映射
// ============================================================
const CN_NUM: Record<string, number> = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
};

export interface ChapterProgress {
  id: string;
  title: string;
  targetWords: number;
  fileWords: number;
  editorWords: number;
  totalWords: number;
  progress: number; // 0-100
}

interface OutlineState {
  chapters: ChapterConfig[];
  progress: ChapterProgress[];
  isReady: boolean;

  /** 根据当前项目的论文文件 + 编辑器内容重新计算所有章节进度 */
  recalculate: (projectKey: string, editorContent: string) => Promise<void>;
}

// ============================================================
// 中英文混合字数统计
// ============================================================
export function countWords(text: string): number {
  if (!text) return 0;
  let chineseChars = 0;
  let englishWords = 0;

  // Extract English word sequences
  const englishParts = text.match(/[a-zA-Z]+/g);
  if (englishParts) {
    englishWords = englishParts.reduce((sum, w) => sum + (w.length > 2 ? 1 : 0.5), 0);
  }

  // Count Chinese characters
  for (const ch of text) {
    if (/[一-鿿㐀-䶿]/.test(ch)) {
      chineseChars++;
    }
  }

  return Math.round(chineseChars + englishWords);
}

// ============================================================
// 从文件名 / 内容中推断章节编号
// ============================================================
function detectChapterNumber(text: string): number | null {
  // "第一章"、"第1章"、"第 1 章"、"Chapter 1"
  const patterns = [
    /第\s*([一二三四五六七八九十\d]+)\s*章/,
    /Chapter\s*(\d+)/i,
    /Ch\.?\s*(\d+)/i,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const raw = m[1];
      if (CN_NUM[raw]) return CN_NUM[raw];
      const n = parseInt(raw, 10);
      if (!isNaN(n) && n >= 1 && n <= 10) return n;
    }
  }

  // Fallback: match chapter title keywords
  const lower = text.toLowerCase();
  const keywords: [number, RegExp][] = [
    [1, /绪论|引言|前言|introduction/],
    [2, /文献综述|理论基础|literature\s*review/],
    [3, /模型|假设|研究设计|model|hypothesis|methodology/],
    [4, /实证|数据|检验|分析|result|analysis|finding/],
    [5, /结论|建议|展望|conclusion|discussion/],
  ];

  for (const [num, re] of keywords) {
    if (re.test(lower)) return num;
  }

  return null;
}

// ============================================================
// Store
// ============================================================
export const useOutlineStore = create<OutlineState>((set, get) => ({
  chapters: DEFAULT_CHAPTERS,
  progress: DEFAULT_CHAPTERS.map((ch) => ({
    ...ch,
    fileWords: 0,
    editorWords: 0,
    totalWords: 0,
    progress: 0,
  })),
  isReady: true,

  recalculate: async (projectKey: string, editorContent: string) => {
    const chapters = get().chapters;

    // 1. Load uploaded thesis files for this project
    const thesisFiles = await db.thesisFiles
      .where('projectKey')
      .equals(projectKey)
      .and((f) => f.category === 'thesis')
      .toArray();

    // 2. Initialize counters
    const fileWordMap: Record<string, number> = {};
    for (const ch of chapters) fileWordMap[ch.id] = 0;

    // 3. Assign file words to chapters
    for (const file of thesisFiles) {
      const chNum = detectChapterNumber(file.name) || detectChapterNumber(file.content.slice(0, 500));
      if (chNum && chNum <= chapters.length) {
        fileWordMap[String(chNum)] += file.wordCount;
      } else {
        // Unmatched files: try to distribute by content keyword matching
        for (let i = 0; i < chapters.length; i++) {
          const ch = chapters[i];
          const kw = ch.title.slice(0, 3);
          if (file.name.includes(kw) || file.content.slice(0, 1000).includes(kw)) {
            fileWordMap[String(i + 1)] += file.wordCount;
            break;
          }
        }
      }
    }

    // 4. Assign editor words to chapters
    const editorWordMap: Record<string, number> = {};
    for (const ch of chapters) editorWordMap[ch.id] = 0;

    if (editorContent) {
      const chapterPattern = /(?:第\s*([一二三四五六七八九十\d]+)\s*章|Chapter\s*(\d+))/gi;
      const matches = [...editorContent.matchAll(chapterPattern)];

      if (matches.length > 0) {
        // Content has explicit chapter markers → split by them
        const textOnly = editorContent.replace(/<[^>]*>/g, '');
        const rawSections = textOnly.split(/(?:第\s*[一二三四五六七八九十\d]+\s*章|Chapter\s*\d+)/gi);

        for (let i = 0; i < matches.length; i++) {
          const raw = matches[i][1] || matches[i][2];
          const chNum = CN_NUM[raw] || parseInt(raw, 10);
          if (chNum && chNum <= chapters.length && rawSections[i + 1]) {
            editorWordMap[String(chNum)] += countWords(rawSections[i + 1]);
          }
        }
      } else {
        // No chapter markers → all editor content counts toward chapter 1 (or all equally)
        // Heuristic: if editor has significant content, spread across chapters based on content matching
        const textOnly = editorContent.replace(/<[^>]*>/g, '');
        for (let i = 0; i < chapters.length; i++) {
          const ch = chapters[i];
          const kw = ch.title.slice(0, 2);
          if (textOnly.includes(kw)) {
            // Count paragraphs near this keyword
            const idx = textOnly.indexOf(kw);
            const context = textOnly.slice(Math.max(0, idx - 500), Math.min(textOnly.length, idx + 3000));
            editorWordMap[String(i + 1)] += countWords(context);
          }
        }

        // If no keyword matches, put all content into chapter 1 as a fallback
        const totalMatched = Object.values(editorWordMap).reduce((a, b) => a + b, 0);
        if (totalMatched === 0) {
          editorWordMap['1'] = countWords(textOnly);
        }
      }
    }

    // 5. Calculate progress
    const progress: ChapterProgress[] = chapters.map((ch) => {
      const fileWords = fileWordMap[ch.id] || 0;
      const editorWords = editorWordMap[ch.id] || 0;
      const totalWords = fileWords + editorWords;
      const pct = ch.targetWords > 0 ? Math.min(100, Math.round((totalWords / ch.targetWords) * 100)) : 0;
      return {
        id: ch.id,
        title: ch.title,
        targetWords: ch.targetWords,
        fileWords,
        editorWords,
        totalWords,
        progress: pct,
      };
    });

    set({ progress });
  },
}));
