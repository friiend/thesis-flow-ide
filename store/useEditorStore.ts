import { create } from 'zustand';
import { db } from '../lib/db';

interface EditorState {
  content: string;
  cursorPosition: number | null;
  selectedText: string;

  /** 自上次保存后是否有未持久化的修改 */
  isDirty: boolean;

  setContent: (content: string) => void;
  setCursorPosition: (pos: number | null) => void;
  setSelectedText: (text: string) => void;
  insertAtCursor: (text: string) => void;

  /** 将当前编辑器内容保存到 IndexedDB（按 activeProjectKey） */
  saveSnapshot: () => Promise<void>;
  /** 从 IndexedDB 加载目标项目的编辑器快照 */
  loadSnapshot: (projectKey: string) => Promise<void>;
  /** 标记为已保存 */
  markClean: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  content: '',
  cursorPosition: null,
  selectedText: '',
  isDirty: false,

  setContent: (content) => {
    set({ content, isDirty: true });
  },

  setCursorPosition: (pos) => set({ cursorPosition: pos }),

  setSelectedText: (text) => set({ selectedText: text }),

  insertAtCursor: (text) => {
    const { content, cursorPosition } = get();
    const pos = cursorPosition ?? content.length;
    const before = content.slice(0, pos);
    const after = content.slice(pos);
    const insertion = before.length > 0 && !before.endsWith('\n') ? `\n\n${text}` : text;
    const newContent = before + insertion + after;
    set({ content: newContent, isDirty: true });
  },

  saveSnapshot: async () => {
    const { content } = get();
    const { useProjectStore } = await import('./useProjectStore');
    const projectKey = useProjectStore.getState().activeProjectKey;

    await db.editorSnapshots.put({
      projectKey,
      content,
      updatedAt: new Date(),
    });
    set({ isDirty: false });
    console.log(`[EditorStore] 💾 快照已保存 (${projectKey}), ${content.length} chars`);
  },

  loadSnapshot: async (projectKey: string) => {
    const snap = await db.editorSnapshots.where('projectKey').equals(projectKey).first();
    const content = snap?.content ?? '';
    set({ content, isDirty: false, cursorPosition: null, selectedText: '' });
    console.log(`[EditorStore] 📂 快照已加载 (${projectKey}), ${content.length} chars`);
  },

  markClean: () => set({ isDirty: false }),
}));
