// src/components/SequenceList.tsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Plus, Copy, Trash2, Edit2, Pin, PinOff } from 'lucide-react';
import { Sequence, SEQUENCER_CONFIG } from '../lib/constants';
import { clsx } from 'clsx';

interface SequenceListProps {
  sequences: Sequence[];
  activeSequenceId: string;
  pinnedSequenceId: string | null;
  onSelect: (id: string) => void;
  onPin: (id: string) => void;
  onCreate: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  playMode: 'single' | 'all';
  onTogglePlayMode: () => void;
}

// Sequence Card Component
interface SequenceCardProps {
  sequence: Sequence;
  isActive: boolean;
  isPinned: boolean;
  isEditing: boolean;
  editName: string;
  onSelect: () => void;
  onPin: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onStartEditing: (e: React.MouseEvent) => void;
  onEditNameChange: (name: string) => void;
  onSaveName: () => void;
  onCancelEdit: () => void;
  canDelete: boolean;
}

const SequenceCard: React.FC<SequenceCardProps> = React.memo(
  ({
    sequence,
    isActive,
    isPinned,
    isEditing,
    editName,
    onSelect,
    onPin,
    onDuplicate,
    onDelete,
    onStartEditing,
    onEditNameChange,
    onSaveName,
    onCancelEdit,
    canDelete,
  }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, [isEditing]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
          onSaveName();
        } else if (e.key === 'Escape') {
          onCancelEdit();
        }
      },
      [onSaveName, onCancelEdit]
    );

    const handlePinClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onPin();
      },
      [onPin]
    );

    const handleDuplicateClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onDuplicate();
      },
      [onDuplicate]
    );

    const handleDeleteClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete();
      },
      [onDelete]
    );

    // Calculate step activity visualization
    const stepVisualization = useMemo(() => {
      return Array.from({ length: SEQUENCER_CONFIG.STEPS_PER_MEASURE }).map((_, i) => {
        const activeCount = sequence.tracks.filter(
          (t) => t.steps?.[i]?.active
        ).length;
        return activeCount;
      });
    }, [sequence.tracks]);

    return (
      <div
        onClick={onSelect}
        className={clsx(
          'group relative flex-shrink-0 w-40 h-24 rounded-xl border-2 transition-all cursor-pointer overflow-hidden flex flex-col',
          isPinned
            ? 'border-cyan-400 bg-slate-800'
            : isActive
            ? 'border-cyan-500/50 bg-slate-800 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
            : 'bg-slate-900 border-slate-700 hover:border-slate-600 opacity-70 hover:opacity-100'
        )}
      >
        {/* Header */}
        <div
          className={clsx(
            'px-3 py-2 flex items-center justify-between border-b',
            isPinned
              ? 'border-cyan-500/30 bg-cyan-950/30'
              : isActive
              ? 'border-cyan-500/20 bg-cyan-950/20'
              : 'border-slate-800 bg-slate-900'
          )}
        >
          {isEditing ? (
            <div className="flex items-center gap-1 w-full">
              <input
                ref={inputRef}
                value={editName}
                onChange={(e) => onEditNameChange(e.target.value)}
                onBlur={onSaveName}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-slate-950 text-white text-xs px-1 py-0.5 rounded border border-cyan-500 outline-none"
                maxLength={20}
              />
            </div>
          ) : (
            <>
              <span
                className={clsx(
                  'text-xs font-bold truncate',
                  isPinned ? 'text-cyan-300' : isActive ? 'text-cyan-300' : 'text-slate-200'
                )}
                title={sequence.name}
              >
                {sequence.name}
              </span>
              <button
                onClick={handlePinClick}
                className={clsx(
                  'p-1 rounded transition-colors',
                  isPinned
                    ? 'text-cyan-400 hover:text-cyan-300 bg-cyan-900/50'
                    : 'text-slate-600 hover:text-cyan-400 opacity-0 group-hover:opacity-100'
                )}
                title={isPinned ? 'Sfissa' : 'Fissa'}
              >
                {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
              </button>
            </>
          )}
        </div>

        {/* Content - Step Visualization */}
        <div className="flex-1 p-2 flex flex-col gap-1 justify-center relative">
          {isActive && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-full h-full bg-cyan-500/5 animate-pulse" />
            </div>
          )}

          {sequence.tracks.length > 0 ? (
            <div className="flex gap-0.5 h-full items-end opacity-50">
              {stepVisualization.map((activeCount, i) => (
                <div
                  key={i}
                  className={clsx(
                    'flex-1 rounded-sm transition-all',
                    isPinned ? 'bg-cyan-400' : isActive ? 'bg-cyan-400' : 'bg-slate-500'
                  )}
                  style={{ height: `${Math.min(100, activeCount * 20)}%`, minHeight: activeCount > 0 ? '2px' : '0' }}
                />
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-slate-600 text-center">Vuota</span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="absolute bottom-1 right-1 flex flex-nowrap min-w-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 rounded p-0.5 backdrop-blur-sm border border-slate-800">
          {canDelete && (
            <button
              onClick={handleDeleteClick}
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded"
              title="Elimina"
            >
              <Trash2 size={12} />
            </button>
          )}
          <button
            onClick={onStartEditing}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
            title="Rinomina"
          >
            <Edit2 size={12} />
          </button>
          <button
            onClick={handleDuplicateClick}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
            title="Duplica"
          >
            <Copy size={12} />
          </button>
        </div>
      </div>
    );
  }
);

SequenceCard.displayName = 'SequenceCard';

// Play Mode Toggle Component
interface PlayModeToggleProps {
  playMode: 'single' | 'all';
  onToggle: () => void;
}

const PlayModeToggle: React.FC<PlayModeToggleProps> = React.memo(({ playMode, onToggle }) => {
  return (
    <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
      <button
        onClick={onToggle}
        className={clsx(
          'px-3 py-1 text-xs font-medium rounded transition-all',
          playMode === 'single'
            ? 'bg-slate-700 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200'
        )}
      >
        Ripeti una
      </button>
      <button
        onClick={onToggle}
        className={clsx(
          'px-3 py-1 text-xs font-medium rounded transition-all',
          playMode === 'all'
            ? 'bg-cyan-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200'
        )}
      >
        Riproduci tutte
      </button>
    </div>
  );
});

PlayModeToggle.displayName = 'PlayModeToggle';

// Main SequenceList Component
export const SequenceList: React.FC<SequenceListProps> = ({
  sequences,
  activeSequenceId,
  pinnedSequenceId,
  onSelect,
  onPin,
  onCreate,
  onDuplicate,
  onDelete,
  onRename,
  playMode,
  onTogglePlayMode,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const startEditing = useCallback((seq: Sequence, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(seq.id);
    setEditName(seq.name);
  }, []);

  const saveName = useCallback(() => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName('');
  }, [editingId, editName, onRename]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditName('');
  }, []);

  const canDelete = sequences.length > 1;

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          Sequenze
          <span className="bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded text-[10px] border border-slate-700">
            {sequences.length}
          </span>
        </h3>

        <PlayModeToggle playMode={playMode} onToggle={onTogglePlayMode} />
      </div>

      {/* Sequence Cards */}
      <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2">
        {sequences.map((seq) => {
          const isActive = activeSequenceId === seq.id;
          const isPinned = pinnedSequenceId === seq.id;
          const isEditing = editingId === seq.id;

          return (
            <SequenceCard
              key={seq.id}
              sequence={seq}
              isActive={isActive}
              isPinned={isPinned}
              isEditing={isEditing}
              editName={editName}
              onSelect={() => onSelect(seq.id)}
              onPin={() => onPin(seq.id)}
              onDuplicate={() => onDuplicate(seq.id)}
              onDelete={() => onDelete(seq.id)}
              onStartEditing={(e) => startEditing(seq, e)}
              onEditNameChange={setEditName}
              onSaveName={saveName}
              onCancelEdit={cancelEdit}
              canDelete={canDelete}
            />
          );
        })}

        {/* Add New Sequence Button */}
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