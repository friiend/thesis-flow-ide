'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { FileEdit, MessageCircle } from 'lucide-react';
import RichTextEditor from '../editor/RichTextEditor';
import ChatPanel from '../chat/ChatPanel';

export default function Workspace() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitRatio, setSplitRatio] = useState(0.55);
  const dragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const ratio = Math.min(Math.max(offsetY / rect.height, 0.2), 0.8);
      setSplitRatio(ratio);
    },
    [],
  );

  const handleMouseUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className="h-full flex flex-col warm-panel">
      {/* 上半部分：论文主文本编辑区 */}
      <div
        className="flex flex-col overflow-hidden rounded-t-2xl"
        style={{ flex: `0 0 ${splitRatio * 100}%` }}
      >
        <div className="flex items-center justify-between border-b border-white/30 px-4 py-2.5 bg-white/20 select-none shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100">
              <FileEdit className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <span className="text-sm font-semibold text-stone-700">论文主文本编辑区</span>
          </div>
          <span className="text-[10px] text-stone-400 font-mono bg-white/40 px-2 py-0.5 rounded-md">
            完成度 35%
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <RichTextEditor />
        </div>
      </div>

      {/* 拖拽分界线 */}
      <div
        onMouseDown={handleMouseDown}
        className="h-[8px] -my-[3px] relative z-10 cursor-row-resize flex-shrink-0 group flex items-center justify-center"
      >
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-[3px] bg-stone-200/70 group-hover:bg-amber-400/80 rounded-full transition-all duration-200" />
        <div className="absolute top-1/2 -translate-y-1/2 h-1 w-8 bg-stone-300/40 group-hover:bg-amber-400/60 rounded-full transition-all duration-200 group-hover:w-12" />
      </div>

      {/* 下半部分：对话区 */}
      <div
        className="flex flex-col overflow-hidden rounded-b-2xl"
        style={{ flex: `0 0 ${(1 - splitRatio) * 100}%` }}
      >
        <div className="flex items-center justify-between border-b border-white/30 px-4 py-2.5 bg-white/20 select-none shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100">
              <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <span className="text-sm font-semibold text-stone-700">对话区</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-stone-400 font-mono">响应率 65%</span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
