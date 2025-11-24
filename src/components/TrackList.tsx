import React from 'react';
import { Track, INSTRUMENTS, TOTAL_STEPS } from '../lib/constants';
import { Volume2, VolumeX, Trash2, Music } from 'lucide-react';
import { clsx } from 'clsx';

interface TrackListProps {
  tracks: Track[];
  currentStep: number;
  onUpdateTrack: (id: string, updates: Partial<Track>) => void;
  onRemoveTrack: (id: string) => void;
}

export const TrackList: React.FC<TrackListProps> = ({ tracks, currentStep, onUpdateTrack, onRemoveTrack }) => {
  
  const toggleStep = (track: Track, index: number) => {
    const newSteps = [...track.steps];
    newSteps[index] = !newSteps[index];
    onUpdateTrack(track.id, { steps: newSteps });
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto p-4 pb-32">
      {tracks.map((track) => {
        const instDef = INSTRUMENTS.find(i => i.id === track.instrument);
        
        return (
          <div key={track.id} className="bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700 flex flex-col md:flex-row gap-4 items-center">
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
            <div className="flex-1 grid grid-cols-8 md:grid-cols-16 gap-1 w-full">
              {track.steps.map((active, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleStep(track, idx)}
                  className={clsx(
                    "h-8 md:h-12 rounded-md transition-all duration-150 border border-slate-700/50 relative overflow-hidden",
                    active 
                      ? clsx(instDef?.color, "shadow-[0_0_10px_rgba(0,0,0,0.3)] brightness-110") 
                      : "bg-slate-900/50 hover:bg-slate-700",
                    idx % 4 === 0 && !active && "bg-slate-800", // Beat markers
                    currentStep === idx && "ring-2 ring-white ring-opacity-50 z-10"
                  )}
                >
                  {/* Visual indicator for active step playback */}
                  {currentStep === idx && active && (
                    <div className="absolute inset-0 bg-white opacity-30 animate-pulse" />
                  )}
                </button>
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
