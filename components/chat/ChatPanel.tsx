'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, User, Send, Plus } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useZoteroStore } from '../../store/useZoteroStore';
import { useProjectStore } from '../../store/useProjectStore';
import { db } from '../../lib/db';
import { formatCitation } from '../../lib/zotero';

function loadVariables(): { key: string; value: string }[] {
  try {
    const raw = localStorage.getItem('thesis_variables');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

async function loadThesisContext(projectKey: string): Promise<string> {
  const files = await db.thesisFiles
    .where('projectKey')
    .equals(projectKey)
    .and((f) => f.category === 'thesis')
    .toArray();

  if (files.length === 0) return '';

  return files
    .map((f) => `### ${f.name} (${f.wordCount} 字)\n${f.content}`)
    .join('\n\n---\n\n');
}

export default function ChatPanel() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [mentionActive, setMentionActive] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);

  const messages = useChatStore((s) => s.messages);
  const addMessage = useChatStore((s) => s.addMessage);
  const currentModel = useChatStore((s) => s.currentModel);
  const insertAtCursor = useEditorStore((s) => s.insertAtCursor);
  const activeProjectKey = useProjectStore((s) => s.activeProjectKey);

  const zoteroSearch = useZoteroStore((s) => s.search);
  const zoteroResults = useZoteroStore((s) => s.searchResults);
  const zoteroClearSearch = useZoteroStore((s) => s.clearSearch);
  const zoteroRAGContext = useZoteroStore((s) => s.ragContext);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const userMessage = input.trim();
      setInput('');
      setIsLoading(true);

      try {
        await addMessage('user', userMessage);

        const freshMessages = useChatStore.getState().messages;
        const variables = loadVariables();

        const thesisContext = await loadThesisContext(activeProjectKey);

        const refFiles = await db.thesisFiles
          .where('projectKey')
          .equals(activeProjectKey)
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
        console.error('发送失败:', error);
        await addMessage(
          'assistant',
          `[系统提示] 无法连接 DeepSeek API。请确保 .env.local 中的 DEEPSEEK_API_KEY 已正确填写。\n\n错误详情: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, addMessage, currentModel, activeProjectKey, zoteroRAGContext],
  );

  const handleInsertToEditor = useCallback(
    (content: string) => {
      insertAtCursor(content);
    },
    [insertAtCursor],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInput(value);

      const match = value.match(/@zotero\s+(\S*)$/);
      if (match) {
        setMentionActive(true);
        setMentionIndex(0);
        zoteroSearch(match[1]);
      } else {
        setMentionActive(false);
        zoteroClearSearch();
      }
    },
    [zoteroSearch, zoteroClearSearch],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!mentionActive || zoteroResults.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, zoteroResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const item = zoteroResults[mentionIndex];
        if (item) {
          const citation = formatCitation(item);
          const newValue = input.replace(/@zotero\s+\S*$/, citation + ' ');
          setInput(newValue);
        }
        setMentionActive(false);
        zoteroClearSearch();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setMentionActive(false);
        zoteroClearSearch();
      }
    },
    [mentionActive, mentionIndex, zoteroResults, input, zoteroClearSearch],
  );

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-stone-50/30 to-white/20">
      {/* 消息渲染区 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-3 select-none">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/60 border border-white/50 shadow-sm">
              <Bot className="h-7 w-7 text-stone-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-stone-500">开始你的学术对话</p>
              <p className="text-xs text-stone-400 mt-1 max-w-[280px]">
                在下方输入论文问题，AI 导师将基于知识库与全局变量提供指导
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={msg.id ?? index}
              className={`flex group animate-slide-right ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/70 border border-white/50 mr-2.5 mt-0.5 shadow-sm">
                  <Bot className="h-3.5 w-3.5 text-stone-400" />
                </div>
              )}

              <div
                className={`relative max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/40 text-stone-700 shadow-sm'
                    : 'bg-white/70 backdrop-blur-sm border border-white/50 text-stone-700 shadow-sm'
                }`}
              >
                <div className="text-[10px] text-stone-400 mb-1 flex items-center gap-1 font-medium">
                  {msg.role === 'user' ? (
                    <><User className="h-3 w-3" /> 你</>
                  ) : (
                    <><Bot className="h-3 w-3" /> AI 导师</>
                  )}
                </div>
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {msg.role === 'assistant' && (
                  <button
                    onClick={() => handleInsertToEditor(msg.content)}
                    className="absolute -top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200
                      px-2.5 py-1 rounded-lg bg-white/90 border border-amber-200/40
                      text-[10px] text-amber-700 hover:bg-amber-50 hover:border-amber-300/60
                      flex items-center gap-1 shadow-md backdrop-blur-sm cursor-pointer"
                    title="将此段落插入编辑器光标处"
                  >
                    <Plus className="h-3 w-3" />
                    插入光标处
                  </button>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/70 border border-white/50 ml-2.5 mt-0.5 shadow-sm">
                  <User className="h-3.5 w-3.5 text-stone-400" />
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start gap-2.5 animate-slide-right">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/70 border border-white/50 shadow-sm">
              <Bot className="h-3.5 w-3.5 text-stone-400" />
            </div>
            <div className="rounded-2xl bg-white/60 backdrop-blur-sm border border-white/50 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-stone-300 animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-stone-300 animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-stone-300 animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* @zotero 实时联想浮动列表 */}
      {mentionActive && zoteroResults.length > 0 && (
        <div className="px-3 pb-1 animate-scale-in">
          <div className="rounded-xl bg-white/80 backdrop-blur-sm border border-stone-200/60 shadow-xl overflow-hidden">
            <div className="px-3 py-1.5 border-b border-stone-200/40 text-[10px] text-stone-500 font-medium">
              Zotero 引用匹配 · ↑↓ 选择 · ↵ 确认 · Esc 取消
            </div>
            <div className="max-h-40 overflow-y-auto">
              {zoteroResults.map((item, i) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    const citation = formatCitation(item);
                    const newValue = input.replace(/@zotero\s+\S*$/, citation + ' ');
                    setInput(newValue);
                    setMentionActive(false);
                    zoteroClearSearch();
                  }}
                  className={`w-full text-left px-3 py-2 transition-colors cursor-pointer ${
                    i === mentionIndex
                      ? 'bg-amber-100/80 text-amber-900'
                      : 'hover:bg-white/60 text-stone-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] shrink-0 font-medium">
                      {formatCitation(item)}
                    </span>
                    <span className="text-[11px] truncate text-stone-400">
                      {item.title}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 发送表单 */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-white/30 p-3 bg-white/20 flex items-end gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="输入问题或指令... (可用 @zotero 引用文献)"
          className="flex-1 resize-none rounded-xl border border-white/50 bg-white/60 backdrop-blur-sm px-4 py-2.5 text-sm text-stone-700 placeholder:text-stone-400 focus:border-amber-400/50 focus:outline-none focus:bg-white/80 focus:ring-2 focus:ring-amber-400/20 transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 text-white hover:from-amber-300 hover:to-orange-300 transition-all shadow-md hover:shadow-lg hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
