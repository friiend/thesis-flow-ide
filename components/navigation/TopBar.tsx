'use client';

import React, { useState, useRef, useEffect } from 'react';
import { GraduationCap, Building, AlertTriangle, Brain, Zap, ChevronDown, BookOpen, Sparkles, Flame } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { useChatStore, MODEL_OPTIONS } from '@/store/useChatStore';

const ICON_MAP: Record<string, React.ReactNode> = {
  brain: <Brain className="h-3.5 w-3.5" />,
  zap: <Zap className="h-3.5 w-3.5" />,
  sparkles: <Sparkles className="h-3.5 w-3.5" />,
  flame: <Flame className="h-3.5 w-3.5" />,
};

export default function TopBar() {
  const activeProjectKey = useProjectStore((s) => s.activeProjectKey);
  const switchProject = useProjectStore((s) => s.switchProject);
  const pendingSwitchTarget = useProjectStore((s) => s.pendingSwitchTarget);
  const confirmSwitch = useProjectStore((s) => s.confirmSwitch);
  const cancelSwitch = useProjectStore((s) => s.cancelSwitch);

  const currentModel = useChatStore((s) => s.currentModel);
  const setModel = useChatStore((s) => s.setModel);

  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentOption = MODEL_OPTIONS.find((o) => o.value === currentModel) ?? MODEL_OPTIONS[0];

  const handleProjectClick = (key: string) => {
    if (key !== activeProjectKey) {
      switchProject(key);
    }
  };

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/40 bg-white/60 backdrop-blur-xl px-5 shadow-sm shadow-stone-200/20">
        {/* 左侧：Logo + 项目名 */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-bold text-white shadow-md shadow-amber-400/30">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="hidden sm:block">
            <span className="text-sm font-semibold text-stone-800 tracking-tight">ThesisFlow-IDE</span>
            <span className="ml-2 text-[10px] text-stone-400 font-mono">v2.0</span>
          </div>
        </div>

        {/* 中间：双项目沙盒切换 Tab */}
        <div className="flex items-center gap-1 bg-white/40 backdrop-blur-sm rounded-xl p-1 border border-white/50">
          <button
            onClick={() => handleProjectClick('graduate')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
              activeProjectKey === 'graduate'
                ? 'bg-white text-stone-800 shadow-sm shadow-stone-200/50 border border-white/60'
                : 'text-stone-500 hover:text-stone-700 hover:bg-white/40'
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            <span className="hidden sm:inline">硕士毕业大论文</span>
            <span className="sm:hidden">硕士</span>
          </button>
          <button
            onClick={() => handleProjectClick('conference')}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200 ${
              activeProjectKey === 'conference'
                ? 'bg-white text-stone-800 shadow-sm shadow-stone-200/50 border border-white/60'
                : 'text-stone-500 hover:text-stone-700 hover:bg-white/40'
            }`}
          >
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">会议论文</span>
            <span className="sm:hidden">会议</span>
          </button>
        </div>

        {/* 右侧：模型路由选择器 */}
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden sm:inline text-xs text-stone-400 font-medium">模型路由</span>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              className="flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-white/60 rounded-xl px-3 py-1.5 text-xs text-stone-700 hover:bg-white/80 hover:border-amber-300/50 transition-all cursor-pointer shadow-sm"
            >
              <span className="text-stone-400">
                {ICON_MAP[currentOption.icon]}
              </span>
              <span className="max-w-[160px] truncate font-medium">{currentOption.label}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-stone-400 transition-transform duration-200 ${modelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {modelDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 w-[360px] bg-white/95 backdrop-blur-xl border border-white/60 rounded-2xl shadow-xl shadow-stone-200/40 animate-scale-in origin-top-right">
                <div className="px-4 py-2.5 border-b border-stone-200/40">
                  <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">选择大模型引擎</p>
                </div>
                <div className="py-1 max-h-96 overflow-y-auto">
                  {MODEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setModel(opt.value as typeof MODEL_OPTIONS[number]['value']);
                        setModelDropdownOpen(false);
                      }}
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-xs text-left transition-colors cursor-pointer ${
                        currentModel === opt.value
                          ? 'bg-amber-50/80 text-amber-800'
                          : 'text-stone-600 hover:bg-stone-50/80'
                      }`}
                    >
                      <span className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${
                        currentModel === opt.value
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-stone-100 text-stone-400'
                      }`}>
                        {ICON_MAP[opt.icon]}
                      </span>
                      <div className="text-left">
                        <div className="font-medium">{opt.label}</div>
                        <div className="text-[10px] text-stone-400">{opt.desc}</div>
                      </div>
                      {currentModel === opt.value && (
                        <div className="ml-auto h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 脏数据安全拦截锁 */}
      {pendingSwitchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-in">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={cancelSwitch}
          />
          <div className="relative w-[420px] bg-white/80 backdrop-blur-xl border border-white/60 shadow-2xl rounded-2xl overflow-hidden animate-scale-in">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-stone-200/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <h3 className="text-sm font-bold text-stone-800">
                检测到未保存的论文进度
              </h3>
            </div>

            <div className="px-5 py-4">
              <p className="text-xs text-stone-600 leading-relaxed">
                当前编辑器中存在尚未持久化的修改内容。是否
                <span className="text-amber-600 font-bold">一键保存并切换</span>
                至目标项目？
              </p>
              <p className="text-[10px] text-stone-400 mt-2 font-mono">
                保存后所有状态将归档至本地 IndexedDB，下次切回时秒级复原
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-stone-200/50 bg-stone-50/60">
              <button
                onClick={cancelSwitch}
                className="px-4 py-2 text-xs font-medium text-stone-500 hover:text-stone-700 border border-stone-200/60 rounded-xl hover:bg-white/60 transition-all cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={confirmSwitch}
                className="px-4 py-2 text-xs font-medium bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-white rounded-xl transition-all cursor-pointer shadow-md shadow-amber-400/20"
              >
                一键保存并切换
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
