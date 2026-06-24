'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { COLOR_MAP, COLOR_OPTIONS, type SkillItem } from '../../lib/db';

// ============================================================
// 表单数据类型（不含 id / isBuiltin / createdAt）
// ============================================================
interface SkillFormData {
  name: string;
  icon: string;
  desc: string;
  prompt: string;
  color: string;   // COLOR_MAP key
}

const EMPTY_FORM: SkillFormData = {
  name: '',
  icon: '📦',
  desc: '',
  prompt: '',
  color: 'blue',
};

// ============================================================
// Props
// ============================================================
interface SkillModalProps {
  editingSkill: SkillItem | null;
  isOpen: boolean;

  onSave: (data: Omit<SkillItem, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}

// ============================================================
// 常用 Emoji 快速选择
// ============================================================
const EMOJI_OPTIONS = [
  '📦', '🔬', '📝', '🌐', '🎯', '⚡', '🚀',
  '💡', '📊', '🗂️', '🧠', '🎨', '🔍', '📌',
  '✅', '❌', '⭐', '🔥', '💬', '🤖', '📚',
];

export default function SkillModal({ editingSkill, isOpen, onSave, onClose }: SkillModalProps) {
  const [form, setForm] = useState<SkillFormData>(() => {
    if (editingSkill) {
      return {
        name: editingSkill.name,
        icon: editingSkill.icon,
        desc: editingSkill.desc,
        prompt: editingSkill.prompt,
        color: editingSkill.color,
      };
    }
    return { ...EMPTY_FORM };
  });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  if (!isOpen) return null;

  const isEdit = !!editingSkill;
  const title = isEdit ? '编辑 Skill' : '新建 Skill';

  // 校验
  const canSave = form.name.trim().length > 0 && form.prompt.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      name: form.name.trim(),
      icon: form.icon.trim() || '📦',
      desc: form.desc.trim(),
      prompt: form.prompt.trim(),
      color: form.color,
      isBuiltin: false,
    });
  };

  // 获取当前颜色的 Tailwind 类名（用于预览）
  const previewColorClass = COLOR_MAP[form.color] || COLOR_MAP.blue;
  // 从 Tailwind 类中提取文字颜色用于标题
  const textMatch = previewColorClass.match(/text-(\S+)/);
  const previewTextColor = textMatch ? `text-${textMatch[1]}` : 'text-blue-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 弹窗主体 */}
      <div className="relative w-[520px] max-h-[85vh] warm-panel shadow-2xl flex flex-col overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200/50">
          <h3 className={`text-sm font-bold tracking-wide ${previewTextColor}`}>
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 滚动表单区域 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* 名称 */}
          <fieldset className="space-y-1.5">
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="例如：文献翻译润色助手"
              className="w-full px-3 py-2 rounded-xl border border-stone-200/60 bg-white/60 backdrop-blur-sm text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:border-amber-400/50 transition-colors"
              maxLength={40}
            />
          </fieldset>

          {/* 图标 + Emoji 选择器 */}
          <fieldset className="space-y-1.5">
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              图标 Emoji
            </label>
            <div className="relative">
              <input
                type="text"
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                onClick={() => setShowEmojiPicker(true)}
                placeholder="选择或输入 emoji..."
                className="w-full px-3 py-2 rounded-xl border border-stone-200/60 bg-white/60 backdrop-blur-sm text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:border-amber-400/50 transition-colors"
                maxLength={4}
              />
              {/* Emoji 快选面板 */}
              {showEmojiPicker && (
                <div className="absolute z-10 mt-1 p-2 bg-white/90 backdrop-blur-sm border border-stone-200/60 rounded-xl shadow-xl grid grid-cols-11 gap-1">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setForm((f) => ({ ...f, icon: emoji }));
                        setShowEmojiPicker(false);
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-stone-100 text-base cursor-pointer transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </fieldset>

          {/* 描述 */}
          <fieldset className="space-y-1.5">
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              描述
            </label>
            <textarea
              value={form.desc}
              onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))}
              placeholder="简短描述这个 Skill 的功能用途..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-stone-200/60 bg-white/60 backdrop-blur-sm text-sm resize-none focus:outline-none focus:border-amber-400/50 text-stone-700 placeholder:text-stone-400"
              maxLength={120}
            />
          </fieldset>

          {/* Prompt 模板（核心字段） */}
          <fieldset className="space-y-1.5">
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              Prompt 模板 <span className="text-red-400">*</span>
            </label>
            <textarea
              value={form.prompt}
              onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
              placeholder={"请作为资深专家，帮我...\n\n这是发送给大模型的核心指令模板，用户激活此 Skill 时会自动注入到对话中。"}
              rows={6}
              className="w-full px-3 py-2 rounded-xl border border-stone-200/60 bg-white/60 backdrop-blur-sm text-sm font-mono leading-relaxed resize-none focus:outline-none focus:border-amber-400/50 text-stone-700 placeholder:text-stone-400"
            />
            <p className="text-[10px] text-stone-400">
              用户点击此 Skill 时，这段内容会作为指令前缀注入聊天。支持使用 [在此填入你的具体文本]
              作为用户输入占位符提示。
            </p>
          </fieldset>

          {/* 颜色主题选择器 */}
          <fieldset className="space-y-1.5">
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              卡片颜色
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((colorKey) => {
                const cls = COLOR_MAP[colorKey];
                const isActive = form.color === colorKey;
                return (
                  <button
                    key={colorKey}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: colorKey }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      isActive ? cls + ' ring-2 ring-amber-400/50 scale-105' : cls + ' opacity-50 hover:opacity-80'
                    }`}
                  >
                    {colorKey}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* 实时卡片预览 */}
          <fieldset className="space-y-1.5">
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              卡片预览
            </label>
            <div
              className={`border rounded-xl p-3 transition-all ${previewColorClass}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{form.icon || '📦'}</span>
                <span className="text-xs font-semibold text-stone-800">
                  {form.name.trim() || '未命名 Skill'}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-stone-500">
                {form.desc.trim() || '暂无描述'}
              </p>
            </div>
          </fieldset>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-stone-200/50 bg-stone-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-stone-500 hover:text-stone-700 border border-stone-200/60 rounded-xl hover:bg-white/50 transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`px-4 py-2 text-xs rounded-xl transition-all cursor-pointer font-medium ${
              canSave
                ? 'bg-amber-400 hover:bg-amber-300 text-neutral-900 shadow-sm'
                : 'bg-stone-100 text-stone-400 cursor-not-allowed'
            }`}
          >
            {isEdit ? '保存修改' : '创建 Skill'}
          </button>
        </div>
      </div>
    </div>
  );
}
