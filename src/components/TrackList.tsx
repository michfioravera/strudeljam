import React, { useState, useRef, useEffect } from 'react';
import { Track, INSTRUMENTS } from '../lib/constants';
import { Volume2, VolumeX, Trash2, Music, Settings, X } from 'lucide-react';
import { clsx } from 'clsx';

interface TrackListProps {
  tracks: Track[];
  currentStep: number;
  onUpdateTrack: (id: string, updates: Partial<Track>) => void;
  onRemoveTrack: (id: string) => void;
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = [2, 3, 4, 5, 6];

export const TrackList: React.FC<TrackListProps> = ({ tracks, currentStep, onUpdateTrack, onRemoveTrack }) => {
  const [editingStep, setEditingStep] = useState<{ trackId: string, stepIndex: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setEditingStep(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStepClick = (track: Track, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const step = track.steps[index];
    
    if (!step.active) {
      // Activate with default note (or existing note if it was just toggled off but kept in mem, though we reset usually)
      // Here we just flip active to true
      const newSteps = [...track.steps];
      newSteps[index] = { ...step, active: true };
      onUpdateTrack(track.id, { steps: newSteps });
    } else {
      // Already active -> Open Edit Menu
      setEditingStep({ trackId: track.id, stepIndex: index });
    }
  };

  const updateNote = (note: string) => {
    if (!editingStep) return;
    const track = tracks.find(t => t.id === editingStep.trackId);
    if (!track) return;

    const newSteps = [...track.steps];
    newSteps[editingStep.stepIndex] = { 
      ...newSteps[editingStep.stepIndex], 
      note: note 
    };
    onUpdateTrack(track.id, { steps: newSteps });
  };

  const clearStep = () => {
    if (!editingStep) return;
    const track = tracks.find(t => t.id === editingStep.trackId);
    if (!track) return;

    const newSteps = [...track.steps];
    newSteps[editingStep.stepIndex] = { 
      ...newSteps[editingStep.stepIndex], 
      active: false 
    };
    onUpdateTrack(track.id, { steps: newSteps });
    setEditingStep(null);
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto p-4 pb-32">
      {tracks.map((track) => {
        const instDef = INSTRUMENTS.find(i => i.id === track.instrument);
        
        return (
          <div key={track.id} className="bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700 flex flex-col md:flex-row gap-4 items-center relative">
            {/* Controls */}
            <div className="flex items-center gap-3 w-full md:w-48">
              <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md", instDef?.color)}>
                <Music size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-slate-100 font-medium truncate">{instDef?.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <button 
                    onClick={() => onUpdateTrack(track.id, { muted: !track.muted })}
                    className={clsx("p-1 rounded hover:bg-slate-700 transition", track.muted ? "text-red-400" : "text-slate-400")}
                  >
                    {track.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05"
                    value={track.volume}
                    onChange={(e) => onUpdateTrack(track.id, { volume: parseFloat(e.target.value) })}
                    className="w-20 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>
              </div>
            </div>

            {/* Sequencer Grid */}
            <div className="flex-1 grid grid-cols-8 md:grid-cols-16 gap-1 w-full relative">
              {track.steps.map((step, idx) => (
                <div key={idx} className="relative">
                    <button
                    onClick={(e) => handleStepClick(track, idx, e)}
                    className={clsx(
                        "w-full h-8 md:h-12 rounded-md transition-all duration-150 border border-slate-700/50 relative overflow-hidden flex items-center justify-center group",
                        step.active 
                        ? clsx(instDef?.color, "shadow-[0_0_10px_rgba(0,0,0,0.3)] brightness-110") 
                        : "bg-slate-900/50 hover:bg-slate-700",
                        idx % 4 === 0 && !step.active && "bg-slate-800", // Beat markers
                        currentStep === idx && "ring-2 ring-white ring-opacity-50 z-10"
                    )}
                    >
                    {/* Note Label (only show if active and space permits) */}
                    {step.active && (
                        <span className="text-[10px] font-bold text-black/60 hidden md:block">
                        {step.note}
                        </span>
                    )}
                    
                    {/* Visual indicator for active step playback */}
                    {currentStep === idx && step.active && (
                        <div className="absolute inset-0 bg-white opacity-30 animate-pulse" />
                    )}
                    </button>

                    {/* Note Editor Popover */}
                    {editingStep?.trackId === track.id && editingStep?.stepIndex === idx && (
                        <div 
                            ref={popoverRef}
                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-slate-800 border border-slate-600 shadow-2xl rounded-lg p-3 w-48 animate-in fade-in zoom-in-95 duration-100"
                        >
                            <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-700">
                                <span className="text-xs font-bold text-slate-400">EDIT NOTE</span>
                                <button onClick={clearStep} className="text-red-400 hover:text-red-300" title="Rimuovi Step">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            
                            <div className="flex gap-2">
                                <select 
                                    className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded p-1 flex-1 focus:border-cyan-500 outline-none"
                                    value={step.note.replace(/\d+/, '')}
                                    onChange={(e) => {
                                        const octave = step.note.match(/\d+/)?.[0] || '3';
                                        updateNote(`${e.target.value}${octave}`);
                                    }}
                                >
                                    {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                <select 
                                    className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded p-1 w-14 focus:border-cyan-500 outline-none"
                                    value={step.note.match(/\d+/)?.[0] || '3'}
                                    onChange={(e) => {
                                        const noteName = step.note.replace(/\d+/, '');
                                        updateNote(`${noteName}${e.target.value}`);
                                    }}
                                >
                                    {OCTAVES.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                            
                            {/* Arrow */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-8 border-transparent border-t-slate-800" />
                        </div>
                    )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <button 
              onClick={() => onRemoveTrack(track.id)}
              className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-700/50 rounded-full transition"
              title="Rimuovi traccia"
            >
              <Trash2 size={20} />
            </button>
          </div>
        );
      })}

      {tracks.length === 0 && (
        <div className="text-center py-20 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl">
          <p className="text-lg">Nessuna traccia attiva.</p>
          <p className="text-sm mt-2">Clicca su "+" per iniziare a creare musica!</p>
        </div>
      )}
    </div>
  );
};
