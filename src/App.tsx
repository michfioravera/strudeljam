// src/App.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Play, Square, Plus, Code, Mic, MicOff, X, Music } from 'lucide-react';
import {
  Track,
  INSTRUMENTS,
  DEFAULT_STEP_COUNT,
  InstrumentType,
  Sequence,
  Step,
  SEQUENCER_CONFIG,
} from './lib/constants';
import { generateStrudelCode, parseStrudelCode } from './lib/strudel-gen';
import { audioEngine } from './lib/audio-engine-hybrid';
import { TrackList } from './components/TrackList';
import { SequenceList } from './components/SequenceList';
import { ErrorBoundary, AudioErrorBoundary } from './components/ErrorBoundary';
import { generateId } from './utils/id';
import { createTracksSignature } from './hooks/useDeepCompareMemo';
import { clsx } from 'clsx';

// NumberInput Component
interface NumberInputProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  label?: string;
}

const NumberInput: React.FC<NumberInputProps> = React.memo(
  ({ value, onChange, min = 0, max = 100, label = '' }) => {
    const [localValue, setLocalValue] = useState<string>(value.toString());

    useEffect(() => {
      setLocalValue(value.toString());
    }, [value]);

    const commit = useCallback(
      (val: string) => {
        let numVal = parseInt(val);
        if (isNaN(numVal)) numVal = value;
        numVal = Math.max(min, Math.min(max, numVal));
        setLocalValue(numVal.toString());
        if (numVal !== value) {
          onChange(numVal);
        }
      },
      [min, max, value, onChange]
    );

    const handleBlur = useCallback(() => {
      commit(localValue);
    }, [commit, localValue]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          commit(localValue);
          (e.target as HTMLInputElement).blur();
        } else if (e.key === 'Escape') {
          setLocalValue(value.toString());
          (e.target as HTMLInputElement).blur();
        }
      },
      [commit, localValue, value]
    );

    return (
      <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 group hover:border-slate-600 transition-colors">
        <span className="text-xs text-slate-400 font-bold tracking-wider group-hover:text-slate-300 whitespace-nowrap">
          {label}
        </span>
        <input
          type="number"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-12 bg-transparent text-center font-mono focus:outline-none text-cyan-400 font-bold"
          min={min}
          max={max}
        />
      </div>
    );
  }
);

NumberInput.displayName = 'NumberInput';

const createDefaultSteps = (defaultNote: string = 'C3'): Step[] => {
  const steps: Step[] = [];
  for (let i = 0; i < SEQUENCER_CONFIG.MAX_STEPS; i++) {
    steps.push({
      active: false,
      note: defaultNote,
      velocity: SEQUENCER_CONFIG.DEFAULT_VELOCITY,
    });
  }
  return steps;
};

const createDefaultSequence = (): Sequence => ({
  id: generateId(),
  name: 'Pattern A',
  tracks: [],
});

function App() {
  const [sequences, setSequences] = useState<Sequence[]>(() => [createDefaultSequence()]);
  const [activeSequenceId, setActiveSequenceId] = useState<string>(() => sequences[0]?.id || '');
  const [pinnedSequenceId, setPinnedSequenceId] = useState<string | null>(null);
  const [playMode, setPlayMode] = useState<'single' | 'all'>('single');

  const playbackSequence = useMemo(
    () => sequences.find((s) => s.id === activeSequenceId) || sequences[0],
    [sequences, activeSequenceId]
  );
  const playbackTracks = playbackSequence?.tracks || [];

  const displayedSequenceId = pinnedSequenceId || activeSequenceId;
  const displayedSequence = useMemo(
    () => sequences.find((s) => s.id === displayedSequenceId) || sequences[0],
    [sequences, displayedSequenceId]
  );
  const displayedTracks = displayedSequence?.tracks || [];

  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [defaultStepCount, setDefaultStepCount] = useState(DEFAULT_STEP_COUNT);

  const [currentTrackSteps, setCurrentTrackSteps] = useState<Record<string, number>>({});
  const [globalStep, setGlobalStep] = useState(-1);
  const lastSequenceIdRef = useRef<string>(activeSequenceId);

  const [showCode, setShowCode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [codeContent, setCodeContent] = useState('');

  const sequencesRef = useRef(sequences);
  const activeSeqIdRef = useRef(activeSequenceId);
  const playModeRef = useRef(playMode);
  const prevTracksSignatureRef = useRef<string>('');

  useEffect(() => {
    sequencesRef.current = sequences;
  }, [sequences]);

  useEffect(() => {
    activeSeqIdRef.current = activeSequenceId;
  }, [activeSequenceId]);

  useEffect(() => {
    playModeRef.current = playMode;
  }, [playMode]);

  useEffect(() => {
    return () => {
      audioEngine.dispose();
    };
  }, []);

  useEffect(() => {
    audioEngine.setBpm(bpm);
  }, [bpm]);

  const handleTrackStep = useCallback((trackId: string, step: number) => {
    setCurrentTrackSteps((prev) => ({
      ...prev,
      [trackId]: step,
    }));
  }, []);

  const handleGlobalStep = useCallback((step: number) => {
    setGlobalStep(step);
  }, []);

  useEffect(() => {
    if (globalStep === SEQUENCER_CONFIG.LAST_STEP_INDEX && playMode === 'all') {
      // FIX: Solo cambia sequenza se quella corrente è diversa dall'ultima che abbiamo visto
      if (lastSequenceIdRef.current === activeSequenceId) {
        const currentIndex = sequences.findIndex((s) => s.id === activeSequenceId);
        if (currentIndex !== -1) {
          const nextIndex = (currentIndex + 1) % sequences.length;
          console.log(`[APP] Global step ${globalStep} - switching to next sequence: ${sequences[nextIndex].name}`);
          setActiveSequenceId(sequences[nextIndex].id);
          lastSequenceIdRef.current = sequences[nextIndex].id;
        }
      }
    }
  }, [globalStep, playMode, sequences, activeSequenceId]);

  useEffect(() => {
    const tracksSignature = createTracksSignature(playbackTracks);

    if (prevTracksSignatureRef.current !== tracksSignature) {
      console.log('[APP] Tracks signature changed - updating audio sequence');
      audioEngine.updateSequence(playbackTracks, handleTrackStep, handleGlobalStep);
      prevTracksSignatureRef.current = tracksSignature;
    }
  }, [playbackTracks, handleTrackStep, handleGlobalStep]);

  useEffect(() => {
    const code = generateStrudelCode(displayedTracks, bpm);
    setCodeContent(code);
  }, [displayedTracks, bpm]);

  const setTracks = useCallback(
    (newTracks: Track[]) => {
      setSequences((prev) =>
        prev.map((s) => (s.id === displayedSequenceId ? { ...s, tracks: newTracks } : s))
      );
    },
    [displayedSequenceId]
  );

  const addSequence = useCallback(() => {
    const newSeq: Sequence = {
      id: generateId(),
      name: `Pattern ${String.fromCharCode(65 + sequences.length)}`,
      tracks: [],
    };
    setSequences((prev) => [...prev, newSeq]);
    setActiveSequenceId(newSeq.id);
    setPinnedSequenceId(null);
  }, [sequences.length]);

  const duplicateSequence = useCallback(
    (id: string) => {
      const seqToCopy = sequences.find((s) => s.id === id);
      if (seqToCopy) {
        const newSeq: Sequence = {
          id: generateId(),
          name: `${seqToCopy.name} (Copy)`,
          tracks: seqToCopy.tracks.map((t) => ({
            ...t,
            id: generateId(),
            steps: t.steps.map((s) => ({ ...s })),
          })),
        };
        setSequences((prev) => [...prev, newSeq]);
        setActiveSequenceId(newSeq.id);
        setPinnedSequenceId(null);
      }
    },
    [sequences]
  );

  const deleteSequence = useCallback(
    (id: string) => {
      if (sequences.length <= 1) return;

      setSequences((prev) => {
        const newSeqs = prev.filter((s) => s.id !== id);
        return newSeqs;
      });

      if (activeSequenceId === id) {
        const remainingSeqs = sequences.filter((s) => s.id !== id);
        setActiveSequenceId(remainingSeqs[0]?.id || '');
      }

      if (pinnedSequenceId === id) {
        setPinnedSequenceId(null);
      }
    },
    [sequences, activeSequenceId, pinnedSequenceId]
  );

  const renameSequence = useCallback((id: string, newName: string) => {
    setSequences((prev) => prev.map((s) => (s.id === id ? { ...s, name: newName } : s)));
  }, []);

  const togglePlay = useCallback(async () => {
    if (!isPlaying) {
      try {
        await audioEngine.start();
        setIsPlaying(true);
      } catch (error) {
        console.error('[APP] Play error:', error);
      }
    } else {
      audioEngine.stop();
      setIsPlaying(false);
      setGlobalStep(-1);
      setCurrentTrackSteps({});
    }
  }, [isPlaying]);

  const addTrack = useCallback(
    (type: InstrumentType) => {
      const instDef = INSTRUMENTS.find((i) => i.id === type);
      const defaultNote = instDef?.defaultNote || 'C3';

      const newTrack: Track = {
        id: generateId(),
        instrument: type,
        stepCount: defaultStepCount,
        steps: createDefaultSteps(defaultNote),
        volume: 0.8,
        muted: false,
        pan: 0,
        delay: 0,
        reverb: 0,
        distortion: 0,
      };

      console.log('[APP] New track:', newTrack.id, 'steps:', newTrack.steps.length);
      setTracks([...displayedTracks, newTrack]);
      setShowAddMenu(false);
    },
    [defaultStepCount, displayedTracks, setTracks]
  );

  const updateTrack = useCallback(
    (id: string, updates: Partial<Track>) => {
      const updatedTracks = displayedTracks.map((t) => {
        if (t.id === id) {
          if (updates.steps) {
            return {
              ...t,
              ...updates,
              steps: updates.steps.map((s) => ({ ...s })),
            };
          }
          return { ...t, ...updates };
        }
        return t;
      });
      setTracks(updatedTracks);
    },
    [displayedTracks, setTracks]
  );

  const removeTrack = useCallback(
    (id: string) => {
      audioEngine.cleanupTrack(id);
      const updatedTracks = displayedTracks.filter((t) => t.id !== id);
      setTracks(updatedTracks);
    },
    [displayedTracks, setTracks]
  );

  const handleRecord = useCallback(async () => {
    if (isRecording) {
      try {
        const url = await audioEngine.stopRecording();
        setIsRecording(false);

        const a = document.createElement('a');
        a.href = url;
        a.download = `strudel-session-${new Date().toISOString().slice(0, 19)}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) {
        console.error('[APP] Recording stop error:', error);
        setIsRecording(false);
      }
    } else {
      try {
        await audioEngine.startRecording();
        setIsRecording(true);
      } catch (error) {
        console.error('[APP] Recording start error:', error);
      }
    }
  }, [isRecording]);

  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCodeContent(e.target.value);
  }, []);

  const applyCode = useCallback(() => {
    try {
      const parsed = parseStrudelCode(codeContent);
      if (parsed && parsed.length > 0) {
        const fullTracks: Track[] = parsed.map((p) => {
          const steps: Step[] = createDefaultSteps(p.steps?.[0]?.note || 'C3');

          if (p.steps && Array.isArray(p.steps)) {
            for (let i = 0; i < Math.min(p.steps.length, SEQUENCER_CONFIG.MAX_STEPS); i++) {
              if (p.steps[i]) {
                steps[i] = { ...steps[i], ...p.steps[i] };
              }
            }
          }

          return {
            id: p.id || generateId(),
            instrument: p.instrument as InstrumentType,
            stepCount: p.stepCount || SEQUENCER_CONFIG.STEPS_PER_MEASURE,
            steps: steps,
            volume: p.volume ?? 0.8,
            muted: p.muted ?? false,
            pan: p.pan ?? 0,
            delay: p.delay ?? 0,
            reverb: p.reverb ?? 0,
            distortion: p.distortion ?? 0,
          };
        });

        setTracks(fullTracks);
        console.log('[APP] Code applied, tracks:', fullTracks.length);
      } else {
        alert('Invalid code or unsupported format.');
      }
    } catch (error) {
      console.error('[APP] Code parse error:', error);
      alert('Error parsing code. Please check the syntax.');
    }
  }, [codeContent, setTracks]);

  const handleTogglePlayMode = useCallback(() => {
    setPlayMode((prev) => (prev === 'single' ? 'all' : 'single'));
  }, []);

  const handlePinSequence = useCallback((id: string) => {
    setPinnedSequenceId((prev) => (prev === id ? null : id));
  }, []);

  const handleToggleCode = useCallback(() => {
    setShowCode((prev) => !prev);
  }, []);

  const handleToggleAddMenu = useCallback(() => {
    setShowAddMenu((prev) => !prev);
  }, []);

  const instrumentCategories = useMemo(
    () => ['Drums', 'Synths', 'Noise'] as const,
    []
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-cyan-500/30">
        <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800 shadow-xl">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Music size={20} className="text-white" />
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 hidden sm:block">
                Strudel UI v3.0
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <NumberInput
                value={bpm}
                onChange={setBpm}
                min={SEQUENCER_CONFIG.MIN_BPM}
                max={SEQUENCER_CONFIG.MAX_BPM}
                label="BPM"
              />

              <NumberInput
                value={defaultStepCount}
                onChange={setDefaultStepCount}
                min={SEQUENCER_CONFIG.MIN_STEPS}
                max={SEQUENCER_CONFIG.MAX_STEPS}
                label="STEPS"
              />

              <button
                onClick={togglePlay}
                className={clsx(
                  'flex items-center gap-2 px-4 py-1.5 rounded-lg font-medium transition-all shadow-lg',
                  isPlaying
                    ? 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/50'
                    : 'bg-cyan-500 text-slate-900 hover:bg-cyan-400 shadow-cyan-500/20 animate-pulse'
                )}
              >
                {isPlaying ? (
                  <Square size={18} fill="currentColor" />
                ) : (
                  <Play size={18} fill="currentColor" />
                )}
                <span className="hidden sm:inline">{isPlaying ? 'Stop' : 'Play'}</span>
              </button>

              <button
                onClick={handleRecord}
                className={clsx(
                  'p-2 rounded-lg transition-all border',
                  isRecording
                    ? 'bg-red-500 text-white border-red-500 animate-pulse'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-red-400 hover:border-red-400/50'
                )}
                title="Record Audio"
              >
                {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              <button
                onClick={handleToggleCode}
                className={clsx(
                  'p-2 rounded-lg transition-all border',
                  showCode
                    ? 'bg-slate-700 text-cyan-400 border-cyan-500/50'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-cyan-400'
                )}
                title="Show/Hide Code"
              >
                <Code size={18} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex h-[calc(100vh-64px)] relative overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar relative">
            <div className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 pt-4 pb-2 px-4 shadow-lg">
              <SequenceList
                sequences={sequences}
                activeSequenceId={activeSequenceId}
                pinnedSequenceId={pinnedSequenceId}
                onSelect={setActiveSequenceId}
                onPin={handlePinSequence}
                onCreate={addSequence}
                onDuplicate={duplicateSequence}
                onDelete={deleteSequence}
                onRename={renameSequence}
                playMode={playMode}
                onTogglePlayMode={handleTogglePlayMode}
              />
            </div>

            <div className="py-6 px-4">
              <AudioErrorBoundary>
                <TrackList
                  tracks={displayedTracks}
                  currentTrackSteps={currentTrackSteps}
                  onUpdateTrack={updateTrack}
                  onRemoveTrack={removeTrack}
                />
              </AudioErrorBoundary>
            </div>

            <div className="fixed bottom-8 right-8 z-30">
              <div className="relative">
                {showAddMenu && (
                  <div className="absolute bottom-16 right-0 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-2 w-64 max-h-[70vh] overflow-y-auto custom-scrollbar flex flex-col gap-1 animate-in slide-in-from-bottom-4 fade-in duration-200">
                    {instrumentCategories.map((category) => (
                      <div key={category} className="mb-2">
                        <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-800 z-10">
                          {category}
                        </div>
                        {INSTRUMENTS.filter((i) => i.category === category).map((inst) => (
                          <button
                            key={inst.id}
                            onClick={() => addTrack(inst.id)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-700 text-left transition-colors group"
                          >
                            <div className={clsx('w-3 h-3 rounded-full', inst.color)} />
                            <span className="text-slate-200 group-hover:text-white text-sm">
                              {inst.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={handleToggleAddMenu}
                  className={clsx(
                    'w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/30 transition-all hover:scale-105 active:scale-95',
                    showAddMenu
                      ? 'bg-slate-700 text-white rotate-45'
                      : 'bg-cyan-500 text-slate-900 hover:bg-cyan-400'
                  )}
                >
                  <Plus size={28} />
                </button>
              </div>
            </div>
          </div>

          <div
            className={clsx(
              'fixed inset-y-0 right-0 w-full md:w-[450px] bg-slate-950 border-l border-slate-800 transform transition-transform duration-300 ease-in-out z-40 shadow-2xl flex flex-col pt-16',
              showCode ? 'translate-x-0' : 'translate-x-full'
            )}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900">
              <h2 className="font-mono text-sm text-cyan-400 font-bold flex items-center gap-2">
                <Code size={16} />
                STRUDEL CODE
                {pinnedSequenceId && (
                  <span className="text-[10px] bg-cyan-900/50 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-700/50">
                    PINNED VIEW
                  </span>
                )}
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={applyCode}
                  className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-slate-300 border border-slate-700 transition-colors"
                >
                  Apply Changes
                </button>
                <button
                  onClick={handleToggleCode}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 relative">
              <textarea
                value={codeContent}
                onChange={handleCodeChange}
                className="w-full h-full bg-slate-950 text-slate-300 font-mono text-sm p-4 resize-none focus:outline-none leading-relaxed"
                spellCheck={false}
                placeholder="// Strudel code will appear here..."
              />
            </div>
            <div className="p-4 bg-slate-900 border-t border-slate-800 text-xs text-slate-500">
              <p>Edit code to update the UI (experimental).</p>
              <p className="mt-1">
                Supports <code className="text-cyan-400">.note</code>,{' '}
                <code className="text-cyan-400">.gain</code>,{' '}
                <code className="text-cyan-400">.pan</code>,{' '}
                <code className="text-cyan-400">.delay</code>,{' '}
                <code className="text-cyan-400">.room</code>,{' '}
                <code className="text-cyan-400">.distort</code>.
              </p>
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
