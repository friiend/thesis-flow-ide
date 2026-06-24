import { create } from 'zustand';
import { db, type SkillItem, COLOR_OPTIONS } from '../lib/db';

// ============================================================
// 导入/导出 JSON 的数据格式（不含 id/isBuiltin/createdAt）
// ============================================================
export interface SkillJSON {
  name: string;
  icon: string;
  desc: string;
  prompt: string;
  color: string;   // COLOR_MAP key
}

// ============================================================
// Store 状态类型
// ============================================================
interface SkillState {
  skills: SkillItem[];              // 全量列表（内置 + 自定义）
  isReady: boolean;                 // 是否已完成初始化加载

  // 操作方法
  initSkills: () => Promise<void>;
  addSkill: (data: Omit<SkillItem, 'id' | 'createdAt'>) => Promise<number>;
  updateSkill: (id: number, data: Partial<Pick<SkillItem, 'name' | 'icon' | 'desc' | 'prompt' | 'color'>>) => Promise<void>;
  deleteSkill: (id: number) => Promise<void>;
  importFromJSON: (jsonStr: string) => Promise<{ added: number; errors: string[] }>;
  exportToJSON: () => string;       // 返回 JSON 字符串（仅自定义 Skill）
  syncFromURL: (url: string) => Promise<{ added: number; errors: string[] }>;
}

export const useSkillStore = create<SkillState>((set, get) => ({
  skills: [],
  isReady: false,

  // ----------------------------------------------------------
  // 初始化：从 DB 加载全部 Skills
  // ----------------------------------------------------------
  initSkills: async () => {
    const all = await db.skills.orderBy('createdAt').toArray();
    set({ skills: all, isReady: true });
    console.log(`[SkillStore] ✅ 已加载 ${all.length} 个 Skill`);
  },

  // ----------------------------------------------------------
  // 新建 Skill
  // ----------------------------------------------------------
  addSkill: async (data) => {
    const newItem: Omit<SkillItem, 'id'> = {
      ...data,
      isBuiltin: false,
      createdAt: new Date(),
    };
    const id = await db.skills.add(newItem);
    const created = await db.skills.get(id)!;

    set((state) => ({ skills: [...state.skills, created!] }));
    console.log(`[SkillStore] ➕ 新增 Skill #${id}: ${data.name}`);
    return id;
  },

  // ----------------------------------------------------------
  // 编辑 Skill
  // ----------------------------------------------------------
  updateSkill: async (id, data) => {
    await db.skills.update(id, data);

    set((state) => ({
      skills: state.skills.map((s) =>
        s.id === id ? { ...s, ...data } : s
      ),
    }));
    console.log(`[SkillStore] ✏️ 编辑 Skill #${id}`);
  },

  // ----------------------------------------------------------
  // 删除 Skill（保护内置）
  // ----------------------------------------------------------
  deleteSkill: async (id) => {
    const target = await db.skills.get(id);
    if (!target) throw new Error('Skill 不存在');
    if (target.isBuiltin) throw new Error('内置 Skill 不允许删除');

    await db.skills.delete(id);

    set((state) => ({
      skills: state.skills.filter((s) => s.id !== id),
    }));
    console.log(`[SkillStore] 🗑️ 删除 Skill #${id}: ${target.name}`);
  },

  // ----------------------------------------------------------
  // 批量导入 JSON
  // ----------------------------------------------------------
  importFromJSON: async (jsonStr) => {
    const errors: string[] = [];
    let added = 0;

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return { added: 0, errors: ['JSON 格式解析失败，请检查是否为合法的 JSON 数组'] };
    }

    if (!Array.isArray(parsed)) {
      return { added: 0, errors: ['导入数据必须是 JSON 数组格式，例如 [{ "name": "...", ... }]'] };
    }

    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i] as Partial<SkillJSON>;

      // 校验必填字段
      if (!item.name?.trim()) {
        errors.push(`第 ${i + 1} 项：缺少 name（名称）`);
        continue;
      }
      if (!item.prompt?.trim()) {
        errors.push(`第 ${i + 1} 项：缺少 prompt（Prompt 模板）`);
        continue;
      }

      // 校验 color 是否合法
      const safeColor =
        item.color && COLOR_OPTIONS.includes(item.color)
          ? item.color
          : 'blue';

      try {
        const id = await get().addSkill({
          name: item.name.trim(),
          icon: item.icon?.trim() || '📦',
          desc: item.desc?.trim() || '',
          prompt: item.prompt.trim(),
          color: safeColor,
          isBuiltin: false,
        });
        added++;
        console.log(`[SkillStore] 📥 导入 Skill #${id}: ${item.name}`);
      } catch (e) {
        errors.push(`第 ${i + 1} 项：写入数据库失败 - ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { added, errors };
  },

  // ----------------------------------------------------------
  // 导出为 JSON（仅导出自定义 Skill）
  // ----------------------------------------------------------
  exportToJSON: () => {
    const customSkills = get().skills.filter((s) => !s.isBuiltin);

    const exported: SkillJSON[] = customSkills.map((s) => ({
      name: s.name,
      icon: s.icon,
      desc: s.desc,
      prompt: s.prompt,
      color: s.color,
    }));

    return JSON.stringify(exported, null, 2);
  },

  // ----------------------------------------------------------
  // 云端同步：从 URL 拉取 JSON → 全量覆盖自定义 Skill
  // ----------------------------------------------------------
  syncFromURL: async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const jsonStr = await res.text();
    const result = await get().importFromJSON(jsonStr);

    // 保存同步 URL 到 localStorage，下次一键复现
    try {
      localStorage.setItem('thesis_skills_sync_url', url);
    } catch {}

    console.log(`[SkillStore] 🔄 云端同步完成：新增 ${result.added} 个 Skill，${result.errors.length} 个错误`);
    return result;
  },
}));
