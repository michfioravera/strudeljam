import React, { useState, useRef, useEffect } from 'react';
import { Track, INSTRUMENTS } from '../lib/constants';
import { Volume2, VolumeX, Trash2, Music, Settings, Sliders } from 'lucide-react';
import { clsx } from 'clsx';

interface TrackListProps {
  tracks: Track[];
  currentStep: number;
  onUpdateTrack: (id: string, updates: Partial<Track>) => void;
  onRemoveTrack: (id: string) => void;
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = [1, 2, 3, 4, 5, 6];

export const TrackList: React.FC<TrackListProps> = ({ tracks, currentStep, onUpdateTrack, onRemoveTrack }) => {
  const [editingStep, setEditingStep] = useState<{ trackId: string, stepIndex: number } | null>(null);
  const [showMixFor, setShowMixFor] = useState<string | null>(null); // Track ID for expanded mix controls
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
      const newSteps = [...track.steps];
      newSteps[index] = { ...step, active: true, velocity: 100 }; // Default velocity 100
      onUpdateTrack(track.id, { steps: newSteps });
    } else {
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

  const updateVelocity = (velocity: number) => {
    if (!editingStep) return;
    const track = tracks.find(t => t.id === editingStep.trackId);
    if (!track) return;

    const newSteps = [...track.steps];
    newSteps[editingStep.stepIndex] = { 
      ...newSteps[editingStep.stepIndex], 
      velocity: velocity 
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
        const isMixOpen = showMixFor === track.id;
        
        return (
          <div key={track.id} className="bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700 flex flex-col gap-4 relative transition-all duration-300">
            
            {/* Top Row: Controls + Sequencer */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
                
                {/* Instrument Info & Basic Vol */}
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
                        value={track.volume ?? 1}
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
                        style={{ opacity: step.active ? 0.4 + ((step.velocity ?? 100) / 100 * 0.6) : 1 }}
                        className={clsx(
                            "w-full h-8 md:h-12 rounded-md transition-all duration-150 border border-slate-700/50 relative overflow-hidden flex items-center justify-center group",
                            step.active 
                            ? clsx(instDef?.color, "shadow-[0_0_10px_rgba(0,0,0,0.3)] brightness-110") 
                            : "bg-slate-900/50 hover:bg-slate-700",
                            idx % 4 === 0 && !step.active && "bg-slate-800", // Beat markers
                            currentStep === idx && "ring-2 ring-white ring-opacity-50 z-10"
                        )}
                        >
                        {step.active && (
                            <span className="text-[9px] font-bold text-black/70 hidden md:block leading-tight">
                            {step.note}<br/>
                            <span className="opacity-70">{step.velocity ?? 100}</span>
                            </span>
                        )}
                        {currentStep === idx && step.active && (
                            <div className="absolute inset-0 bg-white opacity-30 animate-pulse" />
                        )}
                        </button>

                        {/* Step Editor Popover */}
                        {editingStep?.trackId === track.id && editingStep?.stepIndex === idx && (
                            <div 
                                ref={popoverRef}
                                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-slate-800 border border-slate-600 shadow-2xl rounded-lg p-3 w-48 animate-in fade-in zoom-in-95 duration-100"
                            >
                                <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-700">
                                    <span className="text-xs font-bold text-slate-400">EDIT STEP</span>
                                    <button onClick={clearStep} className="text-red-400 hover:text-red-300" title="Rimuovi Step">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                                
                                {/* Note Selection */}
                                <div className="flex gap-2 mb-3">
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

                                {/* Velocity Control */}
                                <div className="flex flex-col gap-1">
                                    <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                                        <span>Velocity</span>
                                        <span>{step.velocity ?? 100}</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="1" 
                                        max="100" 
                                        value={step.velocity ?? 100}
                                        onChange={(e) => updateVelocity(parseInt(e.target.value))}
                                        className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-green-500"
                                    />
                                </div>

                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-8 border-transparent border-t-slate-800" />
                            </div>
                        )}
                    </div>
                ))}
                </div>

                {/* Track Actions */}
                <div className="flex flex-col gap-2">
                    <button 
                        onClick={() => onRemoveTrack(track.id)}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-700/50 rounded-full transition"
                        title="Rimuovi traccia"
                    >
                        <Trash2 size={20} />
                    </button>
                    <button 
                        onClick={() => setShowMixFor(isMixOpen ? null : track.id)}
                        className={clsx(
                            "p-2 rounded-full transition",
                            isMixOpen ? "text-cyan-400 bg-slate-700" : "text-slate-500 hover:text-cyan-400 hover:bg-slate-700/50"
                        )}
                        title="Mix & Effetti"
                    >
                        <Sliders size={20} />
                    </button>
                </div>
            </div>

            {/* Mix Controls (Collapsible) */}
            {isMixOpen && (
                <div className="mt-2 pt-4 border-t border-slate-700/50 grid grid-cols-2 md:grid-cols-4 gap-6 animate-in slide-in-from-top-2 fade-in duration-200">
                    
                    {/* Pan */}
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                            <span>Pan</span>
                            <span>{(track.pan ?? 0).toFixed(1)}</span>
                        </div>
                        <input 
                            type="range" 
                            min="-1" 
                            max="1" 
                            step="0.1"
                            value={track.pan ?? 0}
                            onChange={(e) => onUpdateTrack(track.id, { pan: parseFloat(e.target.value) })}
                            className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between text-[9px] text-slate-600">
                            <span>L</span>
                            <span>R</span>
                        </div>
                    </div>

                    {/* Delay */}
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                            <span>Delay</span>
                            <span>{track.delay ?? 0}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={track.delay ?? 0}
                            onChange={(e) => onUpdateTrack(track.id, { delay: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                    </div>

                    {/* Reverb */}
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                            <span>Reverb</span>
                            <span>{track.reverb ?? 0}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={track.reverb ?? 0}
                            onChange={(e) => onUpdateTrack(track.id, { reverb: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                    </div>

                    {/* Distortion */}
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                            <span>Distortion</span>
                            <span>{track.distortion ?? 0}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={track.distortion ?? 0}
                            onChange={(e) => onUpdateTrack(track.id, { distortion: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                    </div>

                </div>
            )}

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
