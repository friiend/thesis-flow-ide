import { create } from 'zustand';
import { db, type Project } from '../lib/db';

interface ProjectState {
  projects: Project[];
  activeProjectKey: string;
  isReady: boolean;

  /** 切换项目前需要检查 dirty 的标志 */
  pendingSwitchTarget: string | null;

  initProjects: () => Promise<void>;
  switchProject: (targetKey: string) => Promise<void>;
  confirmSwitch: () => Promise<void>;
  cancelSwitch: () => void;
  confirmSwitchInternal: (targetKey: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectKey: 'graduate',
  isReady: false,
  pendingSwitchTarget: null,

  initProjects: async () => {
    const existing = await db.editorSnapshots.toArray();
    const now = new Date();

    const defaults: Project[] = [
      { key: 'graduate', name: '硕士毕业大论文', createdAt: now, updatedAt: now },
      { key: 'conference', name: '体育产业会议论文', createdAt: now, updatedAt: now },
    ];

    // Ensure both projects have editor snapshots
    for (const def of defaults) {
      const snap = existing.find((s) => s.projectKey === def.key);
      if (!snap) {
        await db.editorSnapshots.put({
          projectKey: def.key,
          content: '',
          updatedAt: now,
        });
      }
    }

    set({ projects: defaults, activeProjectKey: 'graduate', isReady: true });
    console.log('[ProjectStore] ✅ 双项目沙盒初始化完成');
  },

  /**
   * 触发项目切换：先检查脏数据 → 弹窗 → 保存 → 切换
   */
  switchProject: async (targetKey: string) => {
    const { activeProjectKey } = get();
    if (targetKey === activeProjectKey) return;

    // 检查编辑器是否有未保存内容（由 EditorStore 提供 dirty 判断）
    const { useEditorStore } = await import('./useEditorStore');
    const isDirty = useEditorStore.getState().isDirty;

    if (isDirty) {
      // 暂存目标，等待用户确认
      set({ pendingSwitchTarget: targetKey });
      return;
    }

    // 无脏数据，直接切换
    await get().confirmSwitchInternal(targetKey);
  },

  /** 用户确认保存并切换 */
  confirmSwitch: async () => {
    const target = get().pendingSwitchTarget;
    if (!target) return;
    set({ pendingSwitchTarget: null });
    await get().confirmSwitchInternal(target);
  },

  /** 用户取消切换 */
  cancelSwitch: () => {
    set({ pendingSwitchTarget: null });
  },

  /** 内部：执行真正的沙盒切换 */
  confirmSwitchInternal: async (targetKey: string) => {
    const { activeProjectKey } = get();

    // 1. 保存当前项目编辑器快照
    const { useEditorStore } = await import('./useEditorStore');
    await useEditorStore.getState().saveSnapshot();

    // 2. 加载目标项目编辑器快照
    await useEditorStore.getState().loadSnapshot(targetKey);

    // 3. 切换聊天会话
    const { useChatStore } = await import('./useChatStore');
    await useChatStore.getState().switchProject(targetKey);

    set({ activeProjectKey: targetKey });
    console.log(`[ProjectStore] 🔄 沙盒切换: ${activeProjectKey} → ${targetKey}`);
  },
}));
