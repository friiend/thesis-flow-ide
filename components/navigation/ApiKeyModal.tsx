'use client';

import { useEffect, useState } from 'react';
import { Key, X } from 'lucide-react';
import { loadApiKeys, saveApiKeys } from '@/lib/apiKeys';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ApiKeyModal({ open, onClose }: Props) {
  const [deepseek, setDeepseek] = useState('');
  const [glm, setGlm] = useState('');

  useEffect(() => {
    if (open) {
      const keys = loadApiKeys();
      setDeepseek(keys.deepseek ?? '');
      setGlm(keys.glm ?? '');
    }
  }, [open]);

  if (!open) return null;

  const handleSave = () => {
    saveApiKeys({
      deepseek: deepseek.trim() || undefined,
      glm: glm.trim() || undefined,
    });
    window.dispatchEvent(
      new CustomEvent('thesis-toast', { detail: 'API Key 已保存到本地浏览器' }),
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-in">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-[440px] bg-white/90 backdrop-blur-xl border border-white/60 shadow-2xl rounded-2xl overflow-hidden animate-scale-in">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-stone-200/50">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100">
            <Key className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-800">配置 API Key</h3>
            <p className="text-[10px] text-stone-400">填你自己的 Key，AI 对话费用由你的账号承担</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[11px] font-medium text-stone-600">
              DeepSeek API Key
              <span className="text-stone-400">（DeepSeek V3 / R1 模型）</span>
            </label>
            <input
              type="password"
              value={deepseek}
              onChange={(e) => setDeepseek(e.target.value)}
              placeholder="sk-..."
              className="mt-1 w-full rounded-xl border border-stone-200/70 bg-white/70 px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-stone-600">
              GLM API Key
              <span className="text-stone-400">（GLM-4 Plus / Flash 模型）</span>
            </label>
            <input
              type="password"
              value={glm}
              onChange={(e) => setGlm(e.target.value)}
              placeholder="xxxxxxxx.xxxxxxxx"
              className="mt-1 w-full rounded-xl border border-stone-200/70 bg-white/70 px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all"
            />
          </div>
          <p className="text-[10px] text-stone-400 leading-relaxed">
            Key 仅保存在你自己的浏览器 localStorage 中，随请求发送，不会上传到服务器持久化。
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-stone-200/50 bg-stone-50/60">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-stone-500 hover:text-stone-700 border border-stone-200/60 rounded-xl hover:bg-white/60 transition-all cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-medium bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-white rounded-xl transition-all cursor-pointer shadow-md shadow-amber-400/20"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
