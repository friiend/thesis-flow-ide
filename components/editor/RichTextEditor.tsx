'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/useEditorStore';

function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

export default function RichTextEditor() {
  const content = useEditorStore((s) => s.content);
  const setContent = useEditorStore((s) => s.setContent);
  const setCursorPosition = useEditorStore((s) => s.setCursorPosition);
  const setSelectedText = useEditorStore((s) => s.setSelectedText);
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== content) {
      el.innerHTML = content;
    }
  }, [content]);

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    isInternalUpdate.current = true;
    setContent(el.innerHTML);
    setWordCount(el.textContent?.length ?? 0);
  }, [setContent]);

  const handleSelectionChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      setSelectedText('');
      return;
    }
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) {
      setSelectedText('');
      return;
    }
    const preRange = document.createRange();
    preRange.selectNodeContents(el);
    preRange.setEnd(range.startContainer, range.startOffset);
    setCursorPosition(preRange.toString().length);
    setSelectedText(sel.isCollapsed ? '' : sel.toString());
  }, [setCursorPosition, setSelectedText]);

  const handleToolbarAction = useCallback(
    (cmd: string, value?: string) => {
      editorRef.current?.focus();
      exec(cmd, value);
      handleInput();
    },
    [handleInput],
  );

  const toolbarBtn =
    'flex h-7 min-w-[28px] items-center justify-center rounded-lg px-1.5 text-sm text-stone-500 hover:bg-white/60 hover:text-stone-800 transition-all duration-150 select-none cursor-pointer font-medium';

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-white/30 px-3 py-1.5 bg-white/15">
        <button
          className={toolbarBtn}
          onClick={() => handleToolbarAction('bold')}
          title="Bold"
        >
          <span className="font-bold">B</span>
        </button>
        <button
          className={toolbarBtn}
          onClick={() => handleToolbarAction('italic')}
          title="Italic"
        >
          <span className="italic font-serif">I</span>
        </button>
        <button
          className={toolbarBtn}
          onClick={() => handleToolbarAction('underline')}
          title="Underline"
        >
          <span className="underline">U</span>
        </button>

        <span className="mx-1.5 h-3 w-px bg-stone-300/60" />

        <button className={toolbarBtn} onClick={() => handleToolbarAction('formatBlock', '<h1>')} title="Heading 1">H1</button>
        <button className={toolbarBtn} onClick={() => handleToolbarAction('formatBlock', '<h2>')} title="Heading 2">H2</button>
        <button className={toolbarBtn} onClick={() => handleToolbarAction('formatBlock', '<h3>')} title="Heading 3">H3</button>
        <button className={toolbarBtn} onClick={() => handleToolbarAction('formatBlock', '<p>')} title="Paragraph">
          <span className="text-[11px]">¶</span>
        </button>

        <span className="mx-1.5 h-3 w-px bg-stone-300/60" />

        <button className={toolbarBtn} onClick={() => handleToolbarAction('insertUnorderedList')} title="Bullet List">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
          </svg>
        </button>
        <button className={toolbarBtn} onClick={() => handleToolbarAction('insertOrderedList')} title="Numbered List">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="10" y1="6" x2="21" y2="6" />
            <line x1="10" y1="12" x2="21" y2="12" />
            <line x1="10" y1="18" x2="21" y2="18" />
            <text x="2" y="10" fontSize="9" fill="currentColor" stroke="none">1</text>
            <text x="2" y="16" fontSize="9" fill="currentColor" stroke="none">2</text>
            <text x="2" y="22" fontSize="9" fill="currentColor" stroke="none">3</text>
          </svg>
        </button>
        <button className={toolbarBtn} onClick={() => handleToolbarAction('formatBlock', '<blockquote>')} title="Blockquote">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" opacity="0.7">
            <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
          </svg>
        </button>

        <span className="flex-1" />

        <span className="text-[10px] text-stone-400 tabular-nums font-mono px-2">
          {wordCount} 字
        </span>
      </div>

      {/* Editor area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="在此输入或粘贴论文内容..."
        onInput={handleInput}
        onKeyUp={handleSelectionChange}
        onMouseUp={handleSelectionChange}
        className="flex-1 px-8 py-6 overflow-y-auto text-stone-800 leading-relaxed outline-none bg-white/30
          [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mt-8 [&>h1]:mb-4 [&>h1]:text-stone-900 [&>h1]:tracking-tight
          [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:mt-6 [&>h2]:mb-3 [&>h2]:text-stone-800
          [&>h3]:text-lg [&>h3]:font-medium [&>h3]:mt-5 [&>h3]:mb-2 [&>h3]:text-stone-800
          [&>p]:my-3 [&>p]:text-[15px] [&>p]:leading-7
          [&>blockquote]:border-l-2 [&>blockquote]:border-amber-400/60 [&>blockquote]:pl-5 [&>blockquote]:my-4 [&>blockquote]:text-stone-500 [&>blockquote]:italic [&>blockquote]:bg-amber-50/30 [&>blockquote]:py-2 [&>blockquote]:rounded-r-lg
          [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:my-3 [&>ul]:space-y-1
          [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:my-3 [&>ol]:space-y-1
          [&>li]:my-1 [&>li]:leading-7
          [&_b]:font-bold [&_strong]:font-bold
          [&_i]:italic [&_em]:italic
          [&_u]:underline
        "
        style={{ fontFamily: "'Georgia', 'Noto Serif SC', serif" }}
      />
    </div>
  );
}
