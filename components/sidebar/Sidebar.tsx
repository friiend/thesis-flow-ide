'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { FolderOpen, FileText, GitBranch, Plus, Upload, Trash2 } from 'lucide-react';
import VariablePanel from './VariablePanel';
import ZoteroPanel from './ZoteroPanel';
import { db, type ThesisFile } from '@/lib/db';
import { useProjectStore } from '@/store/useProjectStore';
import { useEditorStore } from '@/store/useEditorStore';
import { useOutlineStore, countWords } from '@/store/useOutlineStore';

async function extractFileText(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = (reader.result as string) || '';
      if (file.name.endsWith('.docx')) {
        const readable = raw.replace(/[^一-鿿㐀-䶿a-zA-Z0-9\s.,;:!?()（）、。，；：！？""''《》【】\-\n]/g, ' ');
        const cleaned = readable.replace(/\s{2,}/g, '\n').trim();
        resolve(cleaned || `[${file.name} — 此文件为 .docx 格式，文本提取精度有限]`);
      } else if (file.name.endsWith('.pdf')) {
        resolve(`[${file.name} — PDF 文本提取需服务端支持]`);
      } else {
        resolve(raw);
      }
    };
    reader.onerror = () => resolve('');
    reader.readAsText(file);
  });
}

export default function Sidebar() {
  const activeProjectKey = useProjectStore((s) => s.activeProjectKey);
  const editorContent = useEditorStore((s) => s.content);

  const [thesisFiles, setThesisFiles] = useState<ThesisFile[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<ThesisFile[]>([]);
  const [activeZone, setActiveZone] = useState<'thesis' | 'reference'>('thesis');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const progress = useOutlineStore((s) => s.progress);
  const recalculate = useOutlineStore((s) => s.recalculate);

  const loadFiles = useCallback(async () => {
    const all = await db.thesisFiles
      .where('projectKey')
      .equals(activeProjectKey)
      .reverse()
      .sortBy('uploadedAt');

    setThesisFiles(all.filter((f) => f.category === 'thesis'));
    setReferenceFiles(all.filter((f) => f.category === 'reference'));
  }, [activeProjectKey]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const all = await db.thesisFiles
        .where('projectKey')
        .equals(activeProjectKey)
        .reverse()
        .sortBy('uploadedAt');
      if (!cancelled) {
        setThesisFiles(all.filter((f) => f.category === 'thesis'));
        setReferenceFiles(all.filter((f) => f.category === 'reference'));
      }
    };
    init();
    return () => { cancelled = true; };
  }, [activeProjectKey]);

  const refreshOutline = useCallback(async () => {
    await recalculate(activeProjectKey, editorContent);
  }, [activeProjectKey, editorContent, recalculate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshOutline();
    }, 800);
    return () => clearTimeout(timer);
  }, [editorContent, refreshOutline]);

  const handleUploadClick = (zone: 'thesis' | 'reference') => {
    setActiveZone(zone);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    for (let i = 0; i < selected.length; i++) {
      const file = selected[i];
      const existing = await db.thesisFiles
        .where('projectKey')
        .equals(activeProjectKey)
        .and((f) => f.name === file.name && f.size === file.size)
        .first();
      if (existing) continue;

      const text = await extractFileText(file);
      const wordCount = countWords(text);

      await db.thesisFiles.put({
        projectKey: activeProjectKey,
        name: file.name,
        size: file.size,
        type: file.type || 'unknown',
        content: text,
        wordCount,
        category: activeZone,
        uploadedAt: new Date(),
      });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
    await loadFiles();
    await refreshOutline();
  };

  const handleRemoveFile = async (fileId: number) => {
    await db.thesisFiles.delete(fileId);
    await loadFiles();
    await refreshOutline();
  };

  const handleClearZone = async (category: 'thesis' | 'reference') => {
    const toDelete = category === 'thesis' ? thesisFiles : referenceFiles;
    for (const f of toDelete) {
      await db.thesisFiles.delete(f.id!);
    }
    await loadFiles();
    await refreshOutline();
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const progressColor = (pct: number) => {
    if (pct >= 90) return 'bg-emerald-500';
    if (pct >= 60) return 'bg-amber-500';
    if (pct >= 30) return 'bg-orange-400';
    return 'bg-stone-300';
  };

  const progressBg = (pct: number) => {
    if (pct >= 90) return 'bg-emerald-50 text-emerald-700';
    if (pct >= 60) return 'bg-amber-50 text-amber-700';
    if (pct >= 30) return 'bg-orange-50 text-orange-700';
    return 'bg-stone-50 text-stone-500';
  };

  return (
    <aside className="w-72 warm-panel h-[calc(100vh-3.5rem)] flex flex-col select-none overflow-y-auto custom-scrollbar">
      {/* 1. 全局变量 */}
      <VariablePanel />

      {/* 1.5 Zotero 外挂大脑 */}
      <ZoteroPanel />

      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.csv,.txt,.pdf"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* --- 区块 A：论文工程 --- */}
      <div className="border-t border-stone-200/40">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-stone-700">论文工程</h3>
          </div>
          {thesisFiles.length > 0 && (
            <button
              onClick={() => handleClearZone('thesis')}
              className="text-xs text-stone-400 hover:text-red-500 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" />
              清空
            </button>
          )}
        </div>

        <div className="px-4 pb-1">
          <p className="text-xs text-stone-400 leading-relaxed">
            上传论文大纲、开题报告、已写章节
          </p>
        </div>

        <div className="px-4 pb-2">
          <button
            onClick={() => handleUploadClick('thesis')}
            className="w-full rounded-xl border border-dashed border-stone-300/80 bg-white/40 p-3 text-center hover:border-amber-400/60 hover:bg-amber-50/40 transition-all cursor-pointer group"
          >
            <div className="flex w-full flex-col items-center gap-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 group-hover:bg-amber-100 transition-colors">
                <Plus className="h-4 w-4 text-stone-400 group-hover:text-amber-500 transition-colors" />
              </div>
              <span className="text-xs font-medium text-stone-600">上传论文文件</span>
              <span className="text-[10px] text-stone-400">强制注入 System Prompt 核心区</span>
            </div>
          </button>
        </div>

        {thesisFiles.length > 0 && (
          <div className="px-4 pb-2 space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
            {thesisFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between bg-gradient-to-r from-amber-50/80 to-orange-50/50 border border-amber-200/50 rounded-xl px-3 py-2 text-xs group/file"
              >
                <div className="truncate mr-2 min-w-0">
                  <span className="text-stone-700 truncate block font-medium">{file.name}</span>
                  <span className="text-stone-400 text-[10px]">
                    {formatSize(file.size)} · {file.wordCount} 字
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveFile(file.id!)}
                  className="text-stone-400 hover:text-red-500 transition-colors shrink-0 opacity-0 group-hover/file:opacity-100 ml-1 cursor-pointer"
                  title="移除文件"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- 区块 B：参考文献 --- */}
      <div className="border-t border-stone-200/40">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-stone-700">参考文献</h3>
          </div>
          {referenceFiles.length > 0 && (
            <button
              onClick={() => handleClearZone('reference')}
              className="text-xs text-stone-400 hover:text-red-500 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" />
              清空
            </button>
          )}
        </div>

        <div className="px-4 pb-1">
          <p className="text-xs text-stone-400 leading-relaxed">
            上传参考文献全文，根据输入动态 RAG 检索
          </p>
        </div>

        <div className="px-4 pb-2">
          <button
            onClick={() => handleUploadClick('reference')}
            className="w-full rounded-xl border border-dashed border-stone-300/80 bg-white/40 p-3 text-center hover:border-amber-400/60 hover:bg-amber-50/40 transition-all cursor-pointer group"
          >
            <div className="flex w-full flex-col items-center gap-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 group-hover:bg-amber-100 transition-colors">
                <Upload className="h-4 w-4 text-stone-400 group-hover:text-amber-500 transition-colors" />
              </div>
              <span className="text-xs font-medium text-stone-600">上传参考文献</span>
              <span className="text-[10px] text-stone-400">动态向量检索注入，论据支撑</span>
            </div>
          </button>
        </div>

        {referenceFiles.length > 0 && (
          <div className="px-4 pb-2 space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
            {referenceFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between bg-white/60 border border-stone-200/40 rounded-xl px-3 py-2 text-xs group/file"
              >
                <div className="truncate mr-2 min-w-0">
                  <span className="text-stone-700 truncate block font-medium">{file.name}</span>
                  <span className="text-stone-400 text-[10px]">
                    {formatSize(file.size)} · {file.wordCount} 字
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveFile(file.id!)}
                  className="text-stone-400 hover:text-red-500 transition-colors shrink-0 opacity-0 group-hover/file:opacity-100 ml-1 cursor-pointer"
                  title="移除文件"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- 3. 论文大纲进度树 --- */}
      <div className="flex-1 p-4 flex flex-col border-t border-stone-200/40">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-stone-700">论文大纲进度树</h3>
        </div>

        <div className="space-y-2">
          {progress.map((ch) => (
            <div
              key={ch.id}
              className="rounded-xl border border-white/50 bg-white/60 backdrop-blur-sm p-3 transition-shadow hover:shadow-sm"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-stone-700 font-medium truncate mr-2">
                  第{ch.id}章 {ch.title}
                </span>
                <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-md shrink-0 font-medium ${progressBg(ch.progress)}`}>
                  {ch.progress}%
                </span>
              </div>

              <div className="h-1.5 bg-stone-200/80 rounded-full overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${progressColor(ch.progress)}`}
                  style={{ width: `${Math.max(ch.progress, 3)}%` }}
                />
              </div>

              <div className="text-[10px] text-stone-400 font-mono flex justify-between">
                <span>
                  {ch.fileWords} + {ch.editorWords} = {ch.totalWords} 字
                </span>
                <span>目标 {ch.targetWords} 字</span>
              </div>
            </div>
          ))}
        </div>

        {/* 总进度汇总 */}
        {(() => {
          const totalWords = progress.reduce((s, c) => s + c.totalWords, 0);
          const totalTarget = progress.reduce((s, c) => s + c.targetWords, 0);
          const totalPct = progress.length > 0 ? Math.round((totalWords / Math.max(1, totalTarget)) * 100) : 0;

          return (
            <div className="mt-auto pt-3 border-t border-stone-200/40">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-400 font-medium">总进度</span>
                <span className="text-stone-700 font-semibold">
                  {totalPct}%
                </span>
              </div>
              <div className="h-2 bg-stone-200/80 rounded-full overflow-hidden mt-1.5">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(100, Math.max(3, totalPct))}%` }}
                />
              </div>
            </div>
          );
        })()}
      </div>
    </aside>
  );
}
