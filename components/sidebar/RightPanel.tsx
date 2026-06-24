'use client';

import { useState, useCallback, useEffect } from 'react';
import { Zap, Cloud, Plus, Upload, Download, Sparkles, MoreHorizontal } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { useSkillStore } from '../../store/useSkillStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useZoteroStore } from '../../store/useZoteroStore';
import { useProjectStore } from '../../store/useProjectStore';
import { COLOR_MAP, type SkillItem, db } from '../../lib/db';
import SkillModal from './SkillModal';

function loadVariables(): { key: string; value: string }[] {
  try {
    const raw = localStorage.getItem('thesis_variables');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export default function RightPanel() {
  const addMessage = useChatStore((s) => s.addMessage);
  const currentModel = useChatStore((s) => s.currentModel);
  const zoteroRAGContext = useZoteroStore((s) => s.ragContext);
  const skills = useSkillStore((s) => s.skills);
  const isReady = useSkillStore((s) => s.isReady);
  const initSkills = useSkillStore((s) => s.initSkills);
  const deleteSkill = useSkillStore((s) => s.deleteSkill);
  const updateSkill = useSkillStore((s) => s.updateSkill);
  const addNewSkill = useSkillStore((s) => s.addSkill);
  const importFromJSON = useSkillStore((s) => s.importFromJSON);
  const exportToJSON = useSkillStore((s) => s.exportToJSON);
  const syncFromURL = useSkillStore((s) => s.syncFromURL);

  const [activatingId, setActivatingId] = useState<number | string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillItem | null>(null);
  const [menuSkillId, setMenuSkillId] = useState<number | null>(null);

  const [importMode, setImportMode] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<{ added: number; errors: string[] } | null>(null);

  const [syncUrl, setSyncUrl] = useState(() => {
    try { return localStorage.getItem('thesis_skills_sync_url') || ''; } catch { return ''; }
  });
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) initSkills();
  }, [isReady, initSkills]);

  const handleSkillClick = useCallback(
    async (skill: SkillItem) => {
      if (activatingId) return;
      setActivatingId(skill.id!);

      const selectedText = useEditorStore.getState().selectedText?.trim() || '';

      const userContent = selectedText
        ? `【使用了武器库 Skill -> ${skill.name}】\n\n${skill.prompt}\n\n[用户框选的论文段落]\n${selectedText}`
        : `【使用了武器库 Skill -> ${skill.name}】\n\n${skill.prompt}[在此填入你的具体文本]`;

      try {
        await addMessage('user', userContent);

        const freshMessages = useChatStore.getState().messages;
        const variables = loadVariables();
        const projectKey = useProjectStore.getState().activeProjectKey;

        const thesisFiles = await db.thesisFiles
          .where('projectKey')
          .equals(projectKey)
          .and((f) => f.category === 'thesis')
          .toArray();
        const thesisContext = thesisFiles
          .map((f) => `### ${f.name} (${f.wordCount} 字)\n${f.content}`)
          .join('\n\n---\n\n');

        const refFiles = await db.thesisFiles
          .where('projectKey')
          .equals(projectKey)
          .and((f) => f.category === 'reference')
          .toArray();
        const referenceContext = refFiles
          .map((f) => `### ${f.name}\n${f.content}`)
          .join('\n\n---\n\n');

        const combinedRAG = [zoteroRAGContext, referenceContext].filter(Boolean).join('\n\n');

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: freshMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            variables,
            modelPreference: currentModel,
            ragContext: combinedRAG,
            thesisContext,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          throw new Error(errData?.error || `网关响应失败 (${response.status})`);
        }

        const data = await response.json();
        await addMessage('assistant', data.content);
      } catch (error) {
        console.error('Skill 激活失败:', error);
        await addMessage(
          'assistant',
          `[${skill.name} 激活失败] 无法连接云端大模型。请检查网络代理与 API Key 配置。\n\n错误: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        setActivatingId(null);
      }
    },
    [activatingId, addMessage, currentModel, zoteroRAGContext],
  );

  const handleSync = async () => {
    const url = syncUrl.trim();
    if (!url) {
      setSyncMsg('请先填入云端 JSON 地址');
      return;
    }
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await syncFromURL(url);
      setSyncMsg(`同步完成：新增 ${result.added} 个 Skill`);
      setTimeout(() => setSyncMsg(null), 3000);
    } catch (err) {
      setSyncMsg(`同步失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateNew = () => {
    setEditingSkill(null);
    setModalOpen(true);
  };

  const handleEdit = (skill: SkillItem) => {
    setEditingSkill(skill);
    setModalOpen(true);
    setMenuSkillId(null);
  };

  const handleSave = async (data: Omit<SkillItem, 'id' | 'createdAt'>) => {
    if (editingSkill && editingSkill.id) {
      await updateSkill(editingSkill.id!, {
        name: data.name,
        icon: data.icon,
        desc: data.desc,
        prompt: data.prompt,
        color: data.color,
      });
    } else {
      await addNewSkill(data);
    }
    setModalOpen(false);
    setEditingSkill(null);
  };

  const handleDelete = async (skill: SkillItem) => {
    if (!confirm(`确定删除「${skill.name}」吗？此操作不可撤销。`)) return;
    try {
      await deleteSkill(skill.id!);
    } catch (e) {
      alert(e instanceof Error ? e.message : '删除失败');
    }
    setMenuSkillId(null);
  };

  const handleExportOne = (skill: SkillItem) => {
    const json = JSON.stringify(
      [{ name: skill.name, icon: skill.icon, desc: skill.desc, prompt: skill.prompt, color: skill.color }],
      null,
      2,
    );
    downloadJSON(json, `${skill.name}.json`);
    setMenuSkillId(null);
  };

  const handleExportAll = () => {
    const json = exportToJSON();
    if (!json || json === '[]') {
      alert('没有自定义 Skill 可导出');
      return;
    }
    downloadJSON(json, 'thesisflow-skills.json');
  };

  const handleImportSubmit = async () => {
    if (!importText.trim()) return;
    const result = await importFromJSON(importText);
    setImportResult(result);
    if (result.errors.length === 0) {
      setTimeout(() => {
        setImportMode(false);
        setImportText('');
        setImportResult(null);
      }, 1200);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setImportText(text);
      setImportMode(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const downloadJSON = (jsonStr: string, filename: string) => {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getColorClass = (colorKey: string) => COLOR_MAP[colorKey] || COLOR_MAP.blue;

  return (
    <aside className="w-80 warm-panel h-full flex flex-col select-none overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between border-b border-white/40 px-4 py-3 bg-white/25 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100">
            <Zap className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <span className="text-sm font-semibold text-stone-700">SKILLS 武器库</span>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer shadow-sm ${
            syncing
              ? 'bg-stone-100 text-stone-400'
              : 'bg-stone-800 text-white hover:bg-stone-700'
          }`}
        >
          <Cloud className="h-3 w-3" />
          {syncing ? '同步中...' : '同步云端'}
        </button>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2 border-b border-white/40 px-4 py-2.5 bg-white/15 shrink-0">
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-400 text-white px-3 py-1.5 text-xs font-medium hover:from-amber-300 hover:to-orange-300 transition-all shadow-sm shadow-amber-400/20 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          新建
        </button>
        <label className="flex items-center gap-1.5 rounded-lg bg-white/60 border border-stone-200/60 text-stone-600 px-3 py-1.5 text-xs font-medium hover:bg-white/80 transition-colors cursor-pointer">
          <Upload className="h-3.5 w-3.5" />
          导入
          <input type="file" accept=".json,application/json" onChange={handleFileImport} className="hidden" />
        </label>
        <button
          onClick={handleExportAll}
          className="flex items-center gap-1.5 rounded-lg bg-white/60 border border-stone-200/60 text-stone-600 px-3 py-1.5 text-xs font-medium hover:bg-white/80 transition-colors cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          导出
        </button>
      </div>

      {/* 提示信息 */}
      {skills.length > 0 && (
        <div className="border-b border-white/40 px-4 py-2 bg-amber-50/60 shrink-0">
          <p className="text-xs text-amber-700 font-medium">
            点击卡片一键注入，框选编辑器文本直达 AI
          </p>
        </div>
      )}

      {/* 云端同步 URL 输入条 */}
      <div className="px-4 py-2.5 border-b border-white/40 bg-white/10 shrink-0">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={syncUrl}
            onChange={(e) => {
              setSyncUrl(e.target.value);
              try { localStorage.setItem('thesis_skills_sync_url', e.target.value); } catch {}
            }}
            placeholder="GitHub Raw / Gitee JSON 地址..."
            className="flex-1 px-2.5 py-1.5 rounded-lg border border-white/50 bg-white/60 backdrop-blur-sm text-[11px] text-stone-600 placeholder:text-stone-400 focus:outline-none focus:border-amber-400/50 transition-colors"
          />
        </div>
        {syncMsg && (
          <p className={`text-[10px] mt-1.5 font-medium ${syncMsg.startsWith('同步完成') ? 'text-emerald-600' : 'text-amber-600'}`}>
            {syncMsg}
          </p>
        )}
      </div>

      {/* 技能卡片列表 */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-white/10" onClick={() => setMenuSkillId(null)}>
        {!isReady ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="flex gap-1">
              <span className="h-2 w-2 rounded-full bg-stone-300 animate-bounce" />
              <span className="h-2 w-2 rounded-full bg-stone-300 animate-bounce" style={{ animationDelay: '0.15s' }} />
              <span className="h-2 w-2 rounded-full bg-stone-300 animate-bounce" style={{ animationDelay: '0.3s' }} />
            </div>
            <span className="text-xs text-stone-400">加载中...</span>
          </div>
        ) : skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 mb-3">
              <Zap className="h-6 w-6 text-stone-300" />
            </div>
            <span className="text-sm font-medium text-stone-500">暂无 Skill</span>
            <button
              onClick={handleCreateNew}
              className="mt-2 text-xs text-amber-600 hover:text-amber-500 cursor-pointer font-medium"
            >
              + 创建第一个 Skill
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {skills.map((skill) => {
              const isActivating = activatingId === skill.id;
              const showMenu = menuSkillId === skill.id;

              return (
                <div key={skill.id} className="relative">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSkillClick(skill);
                    }}
                    className={`group cursor-pointer rounded-xl border p-3 transition-all duration-200 hover:shadow-md relative ${
                      isActivating ? 'opacity-50 pointer-events-none' : ''
                    } ${getColorClass(skill.color)}`}
                  >
                    {/* 更多按钮 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuSkillId(showMenu ? null : skill.id!);
                      }}
                      className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-stone-400 hover:text-stone-600 hover:bg-white/60 cursor-pointer"
                      style={{ opacity: showMenu ? 1 : undefined }}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>

                    {/* 下拉菜单 */}
                    {showMenu && (
                      <div
                        className="absolute z-20 right-2 top-8 bg-white/95 backdrop-blur-sm border border-stone-200/60 rounded-xl shadow-xl py-1 min-w-[130px] animate-scale-in origin-top-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleEdit(skill)}
                          className="w-full px-3 py-2 text-left text-xs text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleExportOne(skill)}
                          className="w-full px-3 py-2 text-left text-xs text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer"
                        >
                          导出此项
                        </button>
                        {!skill.isBuiltin && (
                          <button
                            onClick={() => handleDelete(skill)}
                            className="w-full px-3 py-2 text-left text-xs text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            删除
                          </button>
                        )}
                      </div>
                    )}

                    {/* 卡片内容 */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base">{skill.icon}</span>
                      <span className="text-sm font-semibold text-stone-800 truncate">
                        {skill.name}
                      </span>
                      {isActivating && (
                        <span className="ml-auto text-[10px] animate-pulse text-stone-400 font-medium">
                          激活中...
                        </span>
                      )}
                      {skill.isBuiltin && (
                        <span className="ml-auto rounded-md bg-white/60 px-2 py-0.5 text-[10px] text-stone-500 border border-stone-200/40 font-medium">
                          内置
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-stone-500 line-clamp-2">
                      {skill.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 底部信息 */}
      <div className="border-t border-white/40 px-4 py-2.5 bg-white/20 shrink-0">
        <div className="flex items-center justify-center gap-1.5 text-xs text-stone-400">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          动态插拔 · 自建 / 导入 / 导出
        </div>
      </div>

      {/* 创建 / 编辑弹窗 */}
      <SkillModal
        editingSkill={editingSkill}
        isOpen={modalOpen}
        onSave={handleSave}
        onClose={() => {
          setModalOpen(false);
          setEditingSkill(null);
        }}
      />

      {/* JSON 导入弹窗 */}
      {importMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-in">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => { setImportMode(false); setImportText(''); setImportResult(null); }}
          />
          <div className="relative w-[480px] warm-panel shadow-2xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200/50">
              <h3 className="text-sm font-bold text-stone-800">导入 Skills (JSON)</h3>
              <button
                onClick={() => { setImportMode(false); setImportText(''); setImportResult(null); }}
                className="text-stone-400 hover:text-stone-600 cursor-pointer text-lg"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-3">
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='[&#10;  { "name": "我的 Skill", "icon": "🌐", "desc": "...", "prompt": "...", "color": "cyan" }&#10;]'
                rows={8}
                className="w-full px-3 py-2 rounded-xl border border-stone-200/60 bg-white/60 backdrop-blur-sm text-xs leading-relaxed resize-none focus:outline-none focus:border-amber-400/50 text-stone-700 placeholder:text-stone-400"
              />

              {importResult && (
                <div className={`rounded-xl p-2.5 text-xs ${
                  importResult.errors.length === 0
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                }`}>
                  成功导入 {importResult.added} 个 Skill
                  {importResult.errors.length > 0 && (
                    <div className="mt-1 text-red-500">
                      {importResult.errors.join('\n')}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setImportMode(false); setImportText(''); setImportResult(null); }}
                  className="flex-1 px-3 py-2 text-xs text-stone-500 border border-stone-200/60 rounded-xl hover:bg-stone-50 transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={handleImportSubmit}
                  disabled={!importText.trim()}
                  className={`flex-1 px-3 py-2 text-xs rounded-xl transition-all cursor-pointer font-medium ${
                    importText.trim()
                      ? 'bg-amber-400 hover:bg-amber-300 text-neutral-900 shadow-sm'
                      : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  开始导入
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 点击空白处关闭菜单 */}
      {menuSkillId !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuSkillId(null)} />
      )}
    </aside>
  );
}
