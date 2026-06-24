'use client';

import { useEffect, useState } from 'react';
import TopBar from '@/components/navigation/TopBar';
import Sidebar from '@/components/sidebar/Sidebar';
import Workspace from '@/components/workspace/Workspace';
import RightPanel from '@/components/sidebar/RightPanel';
import { useProjectStore } from '@/store/useProjectStore';
import { useChatStore } from '@/store/useChatStore';
import { useEditorStore } from '@/store/useEditorStore';
import { useZoteroStore } from '@/store/useZoteroStore';

// ================================================================
// 全局微型 Toast 事件总线（替代巨大的居中遮罩弹窗）
// 任何组件可通过 window.dispatchEvent(new CustomEvent('thesis-toast', { detail: '文本' })) 触发
// ================================================================
function Toast() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => setMsg((e as CustomEvent).detail);
    window.addEventListener('thesis-toast', handler);
    return () => window.removeEventListener('thesis-toast', handler);
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2000);
    return () => clearTimeout(t);
  }, [msg]);

  if (!msg) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
      <div className="animate-in fade-in slide-in-from-top-2 px-4 py-2 rounded-xl bg-white/70 backdrop-blur-xl border border-white/60 shadow-lg shadow-stone-200/30 text-xs text-stone-700 whitespace-nowrap">
        {msg}
      </div>
    </div>
  );
}

export default function Home() {
  const initProjects = useProjectStore((s) => s.initProjects);
  const isReady = useProjectStore((s) => s.isReady);
  const activeProjectKey = useProjectStore((s) => s.activeProjectKey);

  const initLoad = useChatStore((s) => s.initLoad);
  const loadSnapshot = useEditorStore((s) => s.loadSnapshot);

  const zoteroConfigured = useZoteroStore((s) => s.configured);
  const zoteroLoadCollections = useZoteroStore((s) => s.loadCollections);

  // 第一步：初始化双项目沙盒
  useEffect(() => {
    initProjects();
  }, [initProjects]);

  // 第二步：项目沙盒就绪后 → 加载该项目聊天 + 编辑器快照
  useEffect(() => {
    if (isReady) {
      initLoad(activeProjectKey);
      loadSnapshot(activeProjectKey);
    }
  }, [isReady, activeProjectKey, initLoad, loadSnapshot]);

  // Zotero 外挂大脑
  useEffect(() => {
    if (zoteroConfigured) zoteroLoadCollections();
  }, [zoteroConfigured, zoteroLoadCollections]);

  return (
    <main className="w-screen h-screen flex flex-col overflow-hidden text-stone-800 font-sans antialiased">
      <Toast />
      <TopBar />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <div className="flex-1 h-full overflow-hidden">
          <Workspace />
        </div>

        <RightPanel />
      </div>
    </main>
  );
}
