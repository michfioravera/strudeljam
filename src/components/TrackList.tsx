// src/components/TrackList.tsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Track, INSTRUMENTS, InstrumentType, Step, SEQUENCER_CONFIG } from '../lib/constants';
import { Volume2, VolumeX, Trash2, Music, Sliders, Grid3X3, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { useSingleClickOutside } from '../hooks/useClickOutside';

interface TrackListProps {
  tracks: Track[];
  currentTrackSteps: Record<string, number>;
  onUpdateTrack: (id: string, updates: Partial<Track>) => void;
  onRemoveTrack: (id: string) => void;
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = [1, 2, 3, 4, 5, 6];

// Parse note safely
const parseNote = (note: string | undefined): { noteName: string; octave: string } => {
  const safeNote = note || 'C3';
  const noteName = safeNote.replace(/\d+/, '') || 'C';
  const octave = safeNote.match(/\d+/)?.[0] || '3';
  return { noteName, octave };
};

// Internal component for stable step input
const StepInput: React.FC<{ value: number; onChange: (val: number) => void }> = React.memo(
  ({ value, onChange }) => {
    const [localValue, setLocalValue] = useState<string>(value.toString());

    useEffect(() => {
      setLocalValue(value.toString());
    }, [value]);

    const commit = useCallback(() => {
      let val = parseInt(localValue);
      if (isNaN(val)) val = SEQUENCER_CONFIG.STEPS_PER_MEASURE;
      val = Math.max(SEQUENCER_CONFIG.MIN_STEPS, Math.min(SEQUENCER_CONFIG.MAX_STEPS, val));
      setLocalValue(val.toString());
      if (val !== value) {
        onChange(val);
      }
    }, [localValue, value, onChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        (e.target as HTMLInputElement).blur();
      }
    }, []);

    return (
      <input
        type="number"
        min={SEQUENCER_CONFIG.MIN_STEPS}
        max={SEQUENCER_CONFIG.MAX_STEPS}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded p-1.5 w-full text-center focus:border-cyan-500 outline-none font-mono"
      />
    );
  }
);

StepInput.displayName = 'StepInput';

// Step Editor Popover Component
interface StepEditorProps {
  step: Step;
  onUpdateNote: (note: string) => void;
  onUpdateVelocity: (velocity: number) => void;
  onClear: () => void;
  onClose: () => void;
}

const StepEditor: React.FC<StepEditorProps> = React.memo(
  ({ step, onUpdateNote, onUpdateVelocity, onClear, onClose }) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const { noteName, octave } = parseNote(step.note);

    useSingleClickOutside(popoverRef, onClose, true);

    const handleNoteNameChange = useCallback(
      (e: React.ChangeEvent<HTMLSelectElement>) => {
        onUpdateNote(`${e.target.value}${octave}`);
      },
      [octave, onUpdateNote]
    );

    const handleOctaveChange = useCallback(
      (e: React.ChangeEvent<HTMLSelectElement>) => {
        onUpdateNote(`${noteName}${e.target.value}`);
      },
      [noteName, onUpdateNote]
    );

    const handleVelocityChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdateVelocity(parseInt(e.target.value));
      },
      [onUpdateVelocity]
    );

    return (
      <div
        ref={popoverRef}
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-slate-800 border border-slate-600 shadow-2xl rounded-lg p-3 w-48 animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-700">
          <span className="text-xs font-bold text-slate-400">EDIT STEP</span>
          <button
            onClick={onClear}
            className="text-red-400 hover:text-red-300"
            title="Remove Step"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Note Selection */}
        <div className="flex gap-2 mb-3">
          <select
            className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded p-1 flex-1 focus:border-cyan-500 outline-none"
            value={noteName}
            onChange={handleNoteNameChange}
          >
            {NOTES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <select
            className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded p-1 w-14 focus:border-cyan-500 outline-none"
            value={octave}
            onChange={handleOctaveChange}
          >
            {OCTAVES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        {/* Velocity Control */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
            <span>Velocity</span>
            <span>{step.velocity ?? SEQUENCER_CONFIG.DEFAULT_VELOCITY}</span>
          </div>
          <input
            type="range"
            min={SEQUENCER_CONFIG.MIN_VELOCITY}
            max={SEQUENCER_CONFIG.MAX_VELOCITY}
            value={step.velocity ?? SEQUENCER_CONFIG.DEFAULT_VELOCITY}
            onChange={handleVelocityChange}
            className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-green-500"
          />
        </div>

                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-8 border-transparent border-t-slate-800" />
      </div>
    );
  }
);

StepEditor.displayName = 'StepEditor';

// Instrument Selector Component
interface InstrumentSelectorProps {
  currentInstrument: InstrumentType;
  onSelect: (type: InstrumentType) => void;
  onClose: () => void;
}

const InstrumentSelector: React.FC<InstrumentSelectorProps> = React.memo(
  ({ currentInstrument, onSelect, onClose }) => {
    const selectorRef = useRef<HTMLDivElement>(null);

    useSingleClickOutside(selectorRef, onClose, true);

    const categories = useMemo(() => ['Drums', 'Synths', 'Noise'] as const, []);

    return (
      <div
        ref={selectorRef}
        className="absolute top-12 left-0 z-50 bg-slate-800 border border-slate-600 shadow-2xl rounded-xl w-64 max-h-80 overflow-y-auto custom-scrollbar p-2 animate-in fade-in slide-in-from-top-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs font-bold text-slate-500 px-2 py-1 uppercase">
          Select Instrument
        </div>
        {categories.map((category) => (
          <div key={category}>
            <div className="text-[10px] font-bold text-slate-600 px-2 py-1 mt-1 uppercase tracking-wider">
              {category}
            </div>
            {INSTRUMENTS.filter((i) => i.category === category).map((inst) => (
              <button
                key={inst.id}
                onClick={() => onSelect(inst.id)}
                className={clsx(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-700 transition-colors text-left',
                  currentInstrument === inst.id && 'bg-slate-700/50'
                )}
              >
                <div className={clsx('w-2 h-2 rounded-full', inst.color)} />
                <span
                  className={clsx(
                    'text-xs',
                    currentInstrument === inst.id ? 'text-cyan-400 font-bold' : 'text-slate-300'
                  )}
                >
                  {inst.name}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  }
);

InstrumentSelector.displayName = 'InstrumentSelector';

// Step Button Component
interface StepButtonProps {
  step: Step;
  index: number;
  isCurrentStep: boolean;
  instDef: typeof INSTRUMENTS[0] | undefined;
  onClick: (e: React.MouseEvent) => void;
}

const StepButton: React.FC<StepButtonProps> = React.memo(
  ({ step, index, isCurrentStep, instDef, onClick }) => {
    const velocityOpacity = useMemo(() => {
      if (!step.active) return 1;
      return 0.4 + ((step.velocity ?? SEQUENCER_CONFIG.DEFAULT_VELOCITY) / 100) * 0.6;
    }, [step.active, step.velocity]);

    return (
      <button
        onClick={onClick}
        className={clsx(
          'w-full h-8 md:h-12 rounded-md transition-all duration-75 border border-slate-700/50 relative overflow-hidden flex items-center justify-center group',
          step.active
            ? 'bg-trackActive shadow-[0_0_10px_rgba(0,0,0,0.3)] brightness-110'
            : clsx(instDef?.color, 'hover:opacity-75'),
          index % 4 === 0 && !step.active && 'opacity-50',
          isCurrentStep && 'ring-2 ring-white ring-opacity-50 z-10'
        )}
        style={step.active ? { opacity: velocityOpacity } : undefined}
      >
        {step.active && (
          <span className="text-[9px] font-bold text-white/70 hidden md:block leading-tight text-center">
            {step.note || 'C3'}
            <br />
            <span className="opacity-70">{step.velocity ?? SEQUENCER_CONFIG.DEFAULT_VELOCITY}</span>
          </span>
        )}

        {isCurrentStep && step.active && (
          <div className="absolute inset-0 bg-white/40 animate-flash pointer-events-none" />
        )}
      </button>
    );
  }
);

StepButton.displayName = 'StepButton';

// Mix Controls Component
interface MixControlsProps {
  track: Track;
  stepCount: number;
  onUpdateTrack: (updates: Partial<Track>) => void;
  onStepCountChange: (count: number) => void;
}

const MixControls: React.FC<MixControlsProps> = React.memo(
  ({ track, stepCount, onUpdateTrack, onStepCountChange }) => {
    return (
      <div className="mt-2 pt-4 border-t border-slate-700/50 grid grid-cols-2 md:grid-cols-5 gap-6 animate-in slide-in-from-top-2 fade-in duration-200">
        {/* Step Count Input */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase items-center">
            <span>Steps</span>
            <Grid3X3 size={10} />
          </div>
          <StepInput value={stepCount} onChange={onStepCountChange} />
        </div>

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
            onChange={(e) => onUpdateTrack({ pan: parseFloat(e.target.value) })}
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
            onChange={(e) => onUpdateTrack({ delay: parseInt(e.target.value) })}
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
            onChange={(e) => onUpdateTrack({ reverb: parseInt(e.target.value) })}
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
            onChange={(e) => onUpdateTrack({ distortion: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
        </div>
      </div>
    );
  }
);

MixControls.displayName = 'MixControls';

// Single Track Row Component
interface TrackRowProps {
  track: Track;
  currentStep: number;
  editingStepIndex: number | null;
  showMix: boolean;
  showInstrumentSelector: boolean;
  onUpdateTrack: (id: string, updates: Partial<Track>) => void;
  onRemoveTrack: (id: string) => void;
  onStepClick: (index: number, e: React.MouseEvent) => void;
  onToggleMix: () => void;
  onToggleInstrumentSelector: () => void;
  onCloseStepEditor: () => void;
  onUpdateStepNote: (note: string) => void;
  onUpdateStepVelocity: (velocity: number) => void;
  onClearStep: () => void;
  onChangeInstrument: (type: InstrumentType) => void;
}

const TrackRow: React.FC<TrackRowProps> = React.memo(
  ({
    track,
    currentStep,
    editingStepIndex,
    showMix,
    showInstrumentSelector,
    onUpdateTrack,
    onRemoveTrack,
    onStepClick,
    onToggleMix,
    onToggleInstrumentSelector,
    onCloseStepEditor,
    onUpdateStepNote,
    onUpdateStepVelocity,
    onClearStep,
    onChangeInstrument,
  }) => {
    const instDef = useMemo(
      () => INSTRUMENTS.find((i) => i.id === track.instrument),
      [track.instrument]
    );

    const stepCount = track.stepCount || SEQUENCER_CONFIG.STEPS_PER_MEASURE;

    const handleStepCountChange = useCallback(
      (count: number) => {
        const newCount = Math.max(
          SEQUENCER_CONFIG.MIN_STEPS,
          Math.min(SEQUENCER_CONFIG.MAX_STEPS, count)
        );
        let newSteps = [...track.steps];

        // Ensure we have 32 steps
        if (newSteps.length < SEQUENCER_CONFIG.MAX_STEPS) {
          while (newSteps.length < SEQUENCER_CONFIG.MAX_STEPS) {
            newSteps.push({
              active: false,
              note: instDef?.defaultNote || 'C3',
              velocity: SEQUENCER_CONFIG.DEFAULT_VELOCITY,
            });
          }
        }

        onUpdateTrack(track.id, { stepCount: newCount, steps: newSteps });
      },
      [track.id, track.steps, instDef?.defaultNote, onUpdateTrack]
    );

    const handleVolumeChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdateTrack(track.id, { volume: parseFloat(e.target.value) });
      },
      [track.id, onUpdateTrack]
    );

    const handleMuteToggle = useCallback(() => {
      onUpdateTrack(track.id, { muted: !track.muted });
    }, [track.id, track.muted, onUpdateTrack]);

    const handleRemove = useCallback(() => {
      onRemoveTrack(track.id);
    }, [track.id, onRemoveTrack]);

    const handleUpdateTrackPartial = useCallback(
      (updates: Partial<Track>) => {
        onUpdateTrack(track.id, updates);
      },
      [track.id, onUpdateTrack]
    );

    return (
      <div className="bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700 flex flex-col gap-4 relative transition-all duration-300">
        {/* Top Row: Controls + Sequencer */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
          {/* Instrument Info & Basic Vol */}
          <div className="flex items-center gap-3 w-full md:w-48 relative">
            {/* Instrument Icon / Selector Trigger */}
            <button
              onClick={onToggleInstrumentSelector}
              className={clsx(
                'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md transition-transform hover:scale-105',
                instDef?.color
              )}
              title="Change Instrument"
            >
              <Music size={18} />
            </button>

            {/* Instrument Selector Popover */}
            {showInstrumentSelector && (
              <InstrumentSelector
                currentInstrument={track.instrument}
                onSelect={onChangeInstrument}
                onClose={onToggleInstrumentSelector}
              />
            )}

            <div className="flex-1 min-w-0">
              <button
                onClick={onToggleInstrumentSelector}
                className="text-slate-100 font-medium truncate hover:text-cyan-400 transition-colors flex items-center gap-1"
              >
                {instDef?.name}
                <ChevronDown size={12} className="opacity-50" />
              </button>
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={handleMuteToggle}
                  className={clsx(
                    'p-1 rounded hover:bg-slate-700 transition',
                    track.muted ? 'text-red-400' : 'text-slate-400'
                  )}
                >
                  {track.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={track.volume ?? 1}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Sequencer Grid */}
          <div className="flex-1 w-full relative">
            <div
              className="grid gap-1 w-full"
              style={{
                gridTemplateColumns: `repeat(${stepCount}, minmax(0, 1fr))`,
              }}
            >
              {track.steps.slice(0, stepCount).map((step, idx) => (
                <div key={idx} className="relative">
                  <StepButton
                    step={step}
                    index={idx}
                    isCurrentStep={currentStep === idx}
                    instDef={instDef}
                    onClick={(e) => onStepClick(idx, e)}
                  />

                  {/* Step Editor Popover */}
                  {editingStepIndex === idx && (
                    <StepEditor
                      step={step}
                      onUpdateNote={onUpdateStepNote}
                      onUpdateVelocity={onUpdateStepVelocity}
                      onClear={onClearStep}
                      onClose={onCloseStepEditor}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Track Actions */}
          <div className="flex flex-col gap-2 items-center">
            <button
              onClick={handleRemove}
              className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-700/50 rounded-full transition"
              title="Remove Track"
            >
              <Trash2 size={20} />
            </button>
            <button
              onClick={onToggleMix}
              className={clsx(
                'p-2 rounded-full transition flex flex-col items-center gap-1',
                showMix
                  ? 'text-cyan-400 bg-slate-700'
                  : 'text-slate-500 hover:text-cyan-400 hover:bg-slate-700/50'
              )}
              title="Mix & Effects"
            >
              <Sliders size={20} />
              <span className="text-[8px] font-mono">{stepCount}</span>
            </button>
          </div>
        </div>

        {/* Mix Controls (Collapsible) */}
        {showMix && (
          <MixControls
            track={track}
            stepCount={stepCount}
            onUpdateTrack={handleUpdateTrackPartial}
            onStepCountChange={handleStepCountChange}
          />
        )}
      </div>
    );
  }
);

TrackRow.displayName = 'TrackRow';

// Main TrackList Component
export const TrackList: React.FC<TrackListProps> = ({
  tracks,
  currentTrackSteps,
  onUpdateTrack,
  onRemoveTrack,
}) => {
  const [editingStep, setEditingStep] = useState<{ trackId: string; stepIndex: number } | null>(
    null
  );
  const [showMixFor, setShowMixFor] = useState<string | null>(null);
  const [showInstrumentSelector, setShowInstrumentSelector] = useState<string | null>(null);

  const handleStepClick = useCallback(
    (track: Track, index: number, e: React.MouseEvent) => {
      e.stopPropagation();
      const step = track.steps[index];

      if (!step.active) {
        // Create new steps array with the clicked step activated
        const newSteps = track.steps.map((s, i) =>
          i === index
            ? { ...s, active: true, velocity: SEQUENCER_CONFIG.DEFAULT_VELOCITY }
            : { ...s }
        );
        onUpdateTrack(track.id, { steps: newSteps });
      } else {
        // Open editor for active step
        setEditingStep({ trackId: track.id, stepIndex: index });
      }
    },
    [onUpdateTrack]
  );

  const updateStepNote = useCallback(
    (note: string) => {
      if (!editingStep) return;
      const track = tracks.find((t) => t.id === editingStep.trackId);
      if (!track) return;

      const newSteps = track.steps.map((s, i) =>
        i === editingStep.stepIndex ? { ...s, note } : { ...s }
      );
      onUpdateTrack(track.id, { steps: newSteps });
    },
    [editingStep, tracks, onUpdateTrack]
  );

  const updateStepVelocity = useCallback(
    (velocity: number) => {
      if (!editingStep) return;
      const track = tracks.find((t) => t.id === editingStep.trackId);
      if (!track) return;

      const newSteps = track.steps.map((s, i) =>
        i === editingStep.stepIndex ? { ...s, velocity } : { ...s }
      );
      onUpdateTrack(track.id, { steps: newSteps });
    },
    [editingStep, tracks, onUpdateTrack]
  );

  const clearStep = useCallback(() => {
    if (!editingStep) return;
    const track = tracks.find((t) => t.id === editingStep.trackId);
    if (!track) return;

    const newSteps = track.steps.map((s, i) =>
      i === editingStep.stepIndex ? { ...s, active: false } : { ...s }
    );
    onUpdateTrack(track.id, { steps: newSteps });
    setEditingStep(null);
  }, [editingStep, tracks, onUpdateTrack]);

  const closeStepEditor = useCallback(() => {
    setEditingStep(null);
  }, []);

  const changeInstrument = useCallback(
    (trackId: string, newType: InstrumentType) => {
      onUpdateTrack(trackId, { instrument: newType });
      setShowInstrumentSelector(null);
    },
    [onUpdateTrack]
  );

  const toggleMix = useCallback((trackId: string) => {
    setShowMixFor((prev) => (prev === trackId ? null : trackId));
  }, []);

  const toggleInstrumentSelector = useCallback((trackId: string) => {
    setShowInstrumentSelector((prev) => (prev === trackId ? null : trackId));
  }, []);

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto p-4 pb-32">
        <div className="text-center py-20 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl">
          <p className="text-lg">No active tracks.</p>
          <p className="text-sm mt-2">Click "+" to start creating music!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto p-4 pb-32">
      {tracks.map((track) => {
        const currentStep = currentTrackSteps[track.id] ?? -1;
        const isEditingThisTrack = editingStep?.trackId === track.id;

        return (
          <TrackRow
            key={track.id}
            track={track}
            currentStep={currentStep}
            editingStepIndex={isEditingThisTrack ? editingStep.stepIndex : null}
            showMix={showMixFor === track.id}
            showInstrumentSelector={showInstrumentSelector === track.id}
            onUpdateTrack={onUpdateTrack}
            onRemoveTrack={onRemoveTrack}
            onStepClick={(index, e) => handleStepClick(track, index, e)}
            onToggleMix={() => toggleMix(track.id)}
            onToggleInstrumentSelector={() => toggleInstrumentSelector(track.id)}
            onCloseStepEditor={closeStepEditor}
            onUpdateStepNote={updateStepNote}
            onUpdateStepVelocity={updateStepVelocity}
            onClearStep={clearStep}
            onChangeInstrument={(type) => changeInstrument(track.id, type)}
          />
        );
      })}
    </div>
  );
};