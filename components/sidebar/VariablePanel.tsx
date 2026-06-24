'use client';

import React, { useState, useEffect } from 'react';
import { Pin, Plus, X } from 'lucide-react';

interface Variable {
  key: string;
  value: string;
}

export default function VariablePanel() {
  const [variables, setVariables] = useState<Variable[]>(() => {
    return [{ key: '核心理论', value: '技术接受模型 (TAM)' }];
  });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = localStorage.getItem('thesis_variables');
    if (saved) {
      setVariables(JSON.parse(saved));
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const addVariable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;

    const updated = [...variables, { key: newKey.trim(), value: newValue.trim() }];
    setVariables(updated);
    localStorage.setItem('thesis_variables', JSON.stringify(updated));
    setNewKey('');
    setNewValue('');
  };

  const deleteVariable = (index: number) => {
    const updated = variables.filter((_, i) => i !== index);
    setVariables(updated);
    localStorage.setItem('thesis_variables', JSON.stringify(updated));
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-100">
            <Pin className="h-3 w-3 text-amber-600" />
          </div>
          <h3 className="text-sm font-semibold text-stone-700">全局变量</h3>
        </div>
        <span className="text-[10px] text-stone-400 font-mono">{variables.length} 个</span>
      </div>

      {/* 变量列表 */}
      <div className="space-y-1.5 max-h-40 overflow-y-auto mb-3 pr-1 custom-scrollbar">
        {variables.length === 0 ? (
          <p className="text-xs text-stone-400 text-center py-2">暂无变量，在下方添加</p>
        ) : (
          variables.map((v, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-white/60 border border-stone-200/40 rounded-lg px-3 py-2 text-xs group hover:border-amber-200/60 transition-colors"
            >
              <div className="truncate mr-2 min-w-0">
                <span className="text-amber-600 font-semibold">{v.key}</span>
                <span className="text-stone-400 mx-1.5">·</span>
                <span className="text-stone-600">{v.value}</span>
              </div>
              <button
                onClick={() => deleteVariable(i)}
                className="text-stone-400 hover:text-red-500 transition-colors shrink-0 opacity-0 group-hover:opacity-100 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* 新增变量表单 */}
      <form onSubmit={addVariable} className="grid grid-cols-2 gap-1.5">
        <input
          type="text"
          placeholder="变量名"
          className="glass-input-sm"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
        />
        <input
          type="text"
          placeholder="对应内容"
          className="glass-input-sm"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
        />
        <button
          type="submit"
          disabled={!newKey.trim() || !newValue.trim()}
          className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-300/80 py-2 text-xs text-stone-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-3.5 w-3.5" />
          固化此核心变量
        </button>
      </form>
    </div>
  );
}
