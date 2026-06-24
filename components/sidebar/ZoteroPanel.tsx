'use client';

import { useEffect, useState } from 'react';
import { Link2, Settings, Folder, CheckCircle2 } from 'lucide-react';
import { useZoteroStore } from '@/store/useZoteroStore';

export default function ZoteroPanel() {
  const configured = useZoteroStore((s) => s.configured);
  const collections = useZoteroStore((s) => s.collections);
  const collectionsLoading = useZoteroStore((s) => s.collectionsLoading);
  const activeCollectionKey = useZoteroStore((s) => s.activeCollectionKey);
  const activeCollectionName = useZoteroStore((s) => s.activeCollectionName);
  const papers = useZoteroStore((s) => s.papers);
  const papersLoading = useZoteroStore((s) => s.papersLoading);
  const ragContext = useZoteroStore((s) => s.ragContext);

  const checkConfig = useZoteroStore((s) => s.checkConfig);
  const saveConfig = useZoteroStore((s) => s.saveConfig);
  const loadCollections = useZoteroStore((s) => s.loadCollections);
  const selectCollection = useZoteroStore((s) => s.selectCollection);

  const [showConfig, setShowConfig] = useState(false);
  const [userIdInput, setUserIdInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');

  useEffect(() => {
    checkConfig();
  }, [checkConfig]);

  useEffect(() => {
    if (configured) loadCollections();
  }, [configured, loadCollections]);

  const handleSaveConfig = () => {
    if (!userIdInput.trim() || !apiKeyInput.trim()) return;
    saveConfig(userIdInput.trim(), apiKeyInput.trim());
    setShowConfig(false);
    loadCollections();
  };

  return (
    <div className="p-4 border-t border-stone-200/40">
      {/* 标题行 + 配置按钮 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-100">
            <Link2 className="h-3 w-3 text-amber-600" />
          </div>
          <h3 className="text-sm font-semibold text-stone-700">Zotero 拓展</h3>
        </div>
        <button
          onClick={() => {
            setShowConfig(!showConfig);
            if (!showConfig) {
              setUserIdInput(localStorage.getItem('zotero_userId') || '');
              setApiKeyInput(localStorage.getItem('zotero_apiKey') || '');
            }
          }}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
            configured
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100'
              : 'bg-white/60 border border-stone-200/40 text-stone-500 hover:bg-white/80'
          }`}
        >
          {configured ? (
            <><CheckCircle2 className="h-3 w-3" /> 已连接</>
          ) : (
            <><Settings className="h-3 w-3" /> 配置</>
          )}
        </button>
      </div>

      {/* 配置面板 */}
      {showConfig && (
        <div className="mb-3 p-3 rounded-xl bg-white/60 border border-stone-200/40 space-y-2 animate-scale-in">
          <input
            type="text"
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
            placeholder="Zotero User ID (数字)"
            className="glass-input-sm w-full"
          />
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="Zotero API Key"
            className="glass-input-sm w-full"
          />
          <div className="flex gap-1.5">
            <button
              onClick={handleSaveConfig}
              disabled={!userIdInput.trim() || !apiKeyInput.trim()}
              className="flex-1 py-1.5 text-xs font-medium bg-amber-400 text-neutral-900 rounded-lg hover:bg-amber-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              保存并连接
            </button>
            <button
              onClick={() => setShowConfig(false)}
              className="px-3 py-1.5 text-xs text-stone-500 border border-stone-200/60 bg-white/60 rounded-lg hover:bg-white/80 transition-colors cursor-pointer"
            >
              取消
            </button>
          </div>
          <p className="text-[10px] text-stone-400 leading-relaxed">
            API Key 可在 zotero.org/settings/keys 生成。数据全程仅在浏览器与 Zotero 服务器间直连。
          </p>
        </div>
      )}

      {/* 未配置提示 */}
      {!configured && !showConfig && (
        <p className="text-xs text-stone-400 leading-relaxed">
          点击「配置」填入 User ID 与 API Key 以连接 Zotero 外挂大脑
        </p>
      )}

      {/* Collection 文件夹列表 */}
      {configured && (
        <>
          {collectionsLoading ? (
            <div className="flex items-center gap-2 py-2">
              <div className="h-3 w-3 rounded-full bg-stone-300 animate-pulse" />
              <span className="text-xs text-stone-400 animate-pulse">拉取 Collection 中...</span>
            </div>
          ) : (
            <div className="space-y-0.5 max-h-36 overflow-y-auto mb-2 custom-scrollbar">
              {collections.map((col) => (
                <button
                  key={col.key}
                  onClick={() => selectCollection(col.key, col.name)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer truncate flex items-center gap-1.5 ${
                    activeCollectionKey === col.key
                      ? 'bg-amber-100/80 text-amber-800 border border-amber-200/60 font-medium'
                      : 'text-stone-500 hover:bg-white/60 hover:text-stone-700'
                  }`}
                >
                  <Folder className="h-3 w-3 shrink-0" />
                  {col.name}
                </button>
              ))}
            </div>
          )}

          {/* 当前选中 Collection 的状态 */}
          {activeCollectionName && (
            <div className="flex items-center gap-2 text-[10px] text-stone-500 mb-1.5">
              <span className="font-medium">
                {papersLoading ? '...' : papers.length} 篇论文
              </span>
              {ragContext && (
                <span className="text-emerald-600 font-mono font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                  RAG ON
                </span>
              )}
            </div>
          )}

          {/* 快速预览前3篇论文标题 */}
          {papers.length > 0 && (
            <div className="space-y-0.5 max-h-28 overflow-y-auto custom-scrollbar">
              {papers.slice(0, 3).map((p) => (
                <div
                  key={p.key}
                  className="text-[10px] text-stone-500 truncate px-2 py-0.5 rounded hover:bg-white/40"
                  title={p.title}
                >
                  {p.title}
                </div>
              ))}
              {papers.length > 3 && (
                <p className="text-[9px] text-stone-400 px-2 py-0.5">
                  ...及其他 {papers.length - 3} 篇
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
