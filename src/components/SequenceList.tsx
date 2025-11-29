import React, { useState, useEffect, useRef } from 'react';
import { Plus, Copy, Trash2, MoreVertical, Edit2, Check } from 'lucide-react';
import { Sequence } from '../lib/constants';
import { clsx } from 'clsx';

interface SequenceListProps {
  sequences: Sequence[];
  activeSequenceId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  playMode: 'single' | 'all';
  onTogglePlayMode: () => void;
}

export const SequenceList: React.FC<SequenceListProps> = ({
  sequences,
  activeSequenceId,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
  onRename,
  playMode,
  onTogglePlayMode
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingId]);

  const startEditing = (seq: Sequence, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(seq.id);
    setEditName(seq.name);
  };

  const saveName = () => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveName();
    if (e.key === 'Escape') setEditingId(null);
  };

  return (
    <div className="w-full max-w-5xl mx-auto mb-6">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          Sequenze
          <span className="bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded text-[10px] border border-slate-700">
            {sequences.length}
          </span>
        </h3>
        
        <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
          <button
            onClick={onTogglePlayMode}
            className={clsx(
              "px-3 py-1 text-xs font-medium rounded transition-all",
              playMode === 'single' 
                ? "bg-slate-700 text-white shadow-sm" 
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            Loop Current
          </button>
          <button
            onClick={onTogglePlayMode}
            className={clsx(
              "px-3 py-1 text-xs font-medium rounded transition-all",
              playMode === 'all' 
                ? "bg-cyan-600 text-white shadow-sm" 
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            Play All
          </button>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2">
        {sequences.map((seq) => (
          <div
            key={seq.id}
            onClick={() => onSelect(seq.id)}
            className={clsx(
              "group relative flex-shrink-0 w-40 h-24 rounded-xl border-2 transition-all cursor-pointer overflow-hidden flex flex-col",
              activeSequenceId === seq.id
                ? "bg-slate-800 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                : "bg-slate-900 border-slate-700 hover:border-slate-600 opacity-70 hover:opacity-100"
            )}
          >
            {/* Header */}
            <div className={clsx(
              "px-3 py-2 flex items-center justify-between border-b",
              activeSequenceId === seq.id ? "border-slate-700 bg-slate-800" : "border-slate-800 bg-slate-900"
            )}>
              {editingId === seq.id ? (
                <div className="flex items-center gap-1 w-full">
                    <input
                        ref={inputRef}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={saveName}
                        onKeyDown={handleKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-slate-950 text-white text-xs px-1 py-0.5 rounded border border-cyan-500 outline-none"
                    />
                </div>
              ) : (
                <>
                    <span className="text-xs font-bold truncate text-slate-200" title={seq.name}>
                        {seq.name}
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={(e) => startEditing(seq, e)}
                            className="p-1 hover:text-cyan-400 text-slate-500"
                        >
                            <Edit2 size={10} />
                        </button>
                    </div>
                </>
              )}
            </div>

            {/* Mini Preview (Visual representation of tracks) */}
            <div className="flex-1 p-2 flex flex-col gap-1 justify-center">
                {seq.tracks.length > 0 ? (
                    <div className="flex gap-0.5 h-full items-end opacity-50">
                        {Array.from({ length: 16 }).map((_, i) => {
                            const activeCount = seq.tracks.filter(t => t.steps[i].active).length;
                            return (
                                <div 
                                    key={i} 
                                    className="flex-1 bg-cyan-400 rounded-sm"
                                    style={{ height: `${Math.min(100, activeCount * 20)}%` }}
                                />
                            )
                        })}
                    </div>
                ) : (
                    <span className="text-[10px] text-slate-600 text-center">Empty</span>
                )}
            </div>

            {/* Actions Overlay */}
            <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 rounded p-0.5 backdrop-blur-sm">
                <button 
                    onClick={(e) => { e.stopPropagation(); onDuplicate(seq.id); }}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                    title="Duplica"
                >
                    <Copy size={12} />
                </button>
                {sequences.length > 1 && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(seq.id); }}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded"
                        title="Elimina"
                    >
                        <Trash2 size={12} />
                    </button>
                )}
            </div>
          </div>
        ))}

        {/* Add Button */}
        <button
          onClick={onCreate}
          className="flex-shrink-0 w-12 h-24 rounded-xl border-2 border-dashed border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800/50 flex items-center justify-center text-slate-600 hover:text-cyan-500 transition-all"
          title="Nuova Sequenza"
        >
          <Plus size={24} />
        </button>
      </div>
    </div>
  );
};
