import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Square, Plus, Code, Mic, MicOff, X, Music, Settings, ChevronUp, ChevronDown } from 'lucide-react';
import { Track, INSTRUMENTS, DEFAULT_STEP_COUNT, InstrumentType, Sequence } from './lib/constants';
import { generateStrudelCode, parseStrudelCode } from './lib/strudel-gen';
import { audioEngine } from './lib/audio-engine';
import { TrackList } from './components/TrackList';
import { SequenceList } from './components/SequenceList';
import { clsx } from 'clsx';

// NumberInput Component with better UX - waits for blur or Enter to commit
const NumberInput = ({ 
  value, 
  onChange, 
  min = 0, 
  max = 100, 
  label = '',
  step = 1
}: { 
  value: number, 
  onChange: (val: number) => void, 
  min?: number, 
  max?: number,
  label?: string,
  step?: number
}) => {
  const [localValue, setLocalValue] = useState<string>(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const commit = (val: string) => {
    let numVal = parseInt(val);
    if (isNaN(numVal)) numVal = value;
    numVal = Math.max(min, Math.min(max, numVal));
    setLocalValue(numVal.toString());
    if (numVal !== value) {
      onChange(numVal);
    }
  };

  const handleBlur = () => {
    commit(localValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit(localValue);
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setLocalValue(value.toString());
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 group hover:border-slate-600 transition-colors">
      <span className="text-xs text-slate-400 font-bold tracking-wider group-hover:text-slate-300 whitespace-nowrap">{label}</span>
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
};

function App() {
  // --- Sequence State ---
  const [sequences, setSequences] = useState<Sequence[]>([
    { id: 'seq-1', name: 'Pattern A', tracks: [] }
  ]);
  
  const [activeSequenceId, setActiveSequenceId] = useState<string>('seq-1');
  const [pinnedSequenceId, setPinnedSequenceId] = useState<string | null>(null);
  const [playMode, setPlayMode] = useState<'single' | 'all'>('single');
  
  const playbackSequence = sequences.find(s => s.id === activeSequenceId) || sequences[0];
  const playbackTracks = playbackSequence.tracks;

  const displayedSequenceId = pinnedSequenceId || activeSequenceId;
  const displayedSequence = sequences.find(s => s.id === displayedSequenceId) || sequences[0];
  const displayedTracks = displayedSequence.tracks;

  // --- Existing State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [defaultStepCount, setDefaultStepCount] = useState(DEFAULT_STEP_COUNT);
  
  const [currentTrackSteps, setCurrentTrackSteps] = useState<Record<string, number>>({});
  const [globalStep, setGlobalStep] = useState(-1);

  const [showCode, setShowCode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [codeContent, setCodeContent] = useState('');

  const sequencesRef = useRef(sequences);
  const activeSeqIdRef = useRef(activeSequenceId);
  const playModeRef = useRef(playMode);
  
  useEffect(() => { sequencesRef.current = sequences; }, [sequences]);
  useEffect(() => { activeSeqIdRef.current = activeSequenceId; }, [activeSequenceId]);
  useEffect(() => { playModeRef.current = playMode; }, [playMode]);

  useEffect(() => {
    audioEngine.setBpm(bpm);
  }, [bpm]);

  const handleTrackStep = useCallback((trackId: string, step: number) => {
    setCurrentTrackSteps(prev => ({
        ...prev,
        [trackId]: step
    }));
  }, []);

  const handleGlobalStep = useCallback((step: number) => {
    setGlobalStep(step);
    if (step === 15 && playModeRef.current === 'all') {
      const currentSeqs = sequencesRef.current;
      const currentId = activeSeqIdRef.current;
      const currentIndex = currentSeqs.findIndex(s => s.id === currentId);
      
      if (currentIndex !== -1) {
        const nextIndex = (currentIndex + 1) % currentSeqs.length;
        const nextSeq = currentSeqs[nextIndex];
        setActiveSequenceId(nextSeq.id);
      }
    }
  }, []);

  useEffect(() => {
    audioEngine.updateSequence(playbackTracks, handleTrackStep, handleGlobalStep);
  }, [playbackTracks, handleTrackStep, handleGlobalStep]);

  useEffect(() => {
    const code = generateStrudelCode(displayedTracks, bpm);
    setCodeContent(code);
  }, [displayedTracks, bpm]);

  const setTracks = (newTracks: Track[]) => {
    setSequences(prev => prev.map(s => 
      s.id === displayedSequenceId ? { ...s, tracks: newTracks } : s
    ));
  };

  const addSequence = () => {
    const newSeq: Sequence = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Pattern ${String.fromCharCode(65 + sequences.length)}`,
      tracks: [] 
    };
    setSequences([...sequences, newSeq]);
    setActiveSequenceId(newSeq.id);
    setPinnedSequenceId(null);
  };

  const duplicateSequence = (id: string) => {
    const seqToCopy = sequences.find(s => s.id === id);
    if (seqToCopy) {
      const newSeq: Sequence = {
        ...seqToCopy,
        id: Math.random().toString(36).substr(2, 9),
        name: `${seqToCopy.name} (Copy)`,
        tracks: seqToCopy.tracks.map(t => ({
            ...t,
            steps: t.steps.map(s => ({ ...s }))
        }))
      };
      setSequences([...sequences, newSeq]);
      setActiveSequenceId(newSeq.id);
      setPinnedSequenceId(null);
    }
  };

  const deleteSequence = (id: string) => {
    if (sequences.length <= 1) return;
    const newSeqs = sequences.filter(s => s.id !== id);
    setSequences(newSeqs);
    if (activeSequenceId === id) {
      setActiveSequenceId(newSeqs[0].id);
    }
    if (pinnedSequenceId === id) {
      setPinnedSequenceId(null);
    }
  };

  const renameSequence = (id: string, newName: string) => {
    setSequences(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
  };

  const togglePlay = async () => {
    if (!isPlaying) {
      await audioEngine.start();
      setIsPlaying(true);
    } else {
      audioEngine.stop();
      setIsPlaying(false);
      setGlobalStep(-1);
      setCurrentTrackSteps({});
    }
  };

  const addTrack = (type: InstrumentType) => {
    const instDef = INSTRUMENTS.find(i => i.id === type);
    const newTrack: Track = {
      id: Math.random().toString(36).substr(2, 9),
      instrument: type,
      stepCount: defaultStepCount,
      steps: Array(32).fill(null).map(() => ({ 
        active: false, 
        note: instDef?.defaultNote || 'C3',
        velocity: 100
      })),
      volume: 0.8,
      muted: false,
      pan: 0,
      delay: 0,
      reverb: 0,
      distortion: 0
    };
    setTracks([...displayedTracks, newTrack]);
    setShowAddMenu(false);
  };

  const updateTrack = (id: string, updates: Partial<Track>) => {
    const updatedTracks = displayedTracks.map(t => t.id === id ? { ...t, ...updates } : t);
    setTracks(updatedTracks);
  };

  const removeTrack = (id: string) => {
    audioEngine.cleanupTrack(id);
    const updatedTracks = displayedTracks.filter(t => t.id !== id);
    setTracks(updatedTracks);
  };

  const handleRecord = async () => {
    if (isRecording) {
      const url = await audioEngine.stopRecording();
      setIsRecording(false);
      const a = document.createElement('a');
      a.href = url;
      a.download = `strudel-session-${new Date().toISOString().slice(0,19)}.webm`;
      a.click();
    } else {
      audioEngine.startRecording();
      setIsRecording(true);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCodeContent(e.target.value);
  };

  const applyCode = () => {
    const parsed = parseStrudelCode(codeContent);
    if (parsed) {
        const fullTracks: Track[] = parsed.map(p => ({
            id: p.id || Math.random().toString(),
            instrument: p.instrument as InstrumentType,
            stepCount: p.stepCount || 16,
            steps: p.steps || Array(32).fill(null).map(() => ({ active: false, note: 'C3', velocity: 100 })),
            volume: p.volume ?? 0.8,
            muted: p.muted ?? false,
            pan: p.pan ?? 0,
            delay: p.delay ?? 0,
            reverb: p.reverb ?? 0,
            distortion: p.distortion ?? 0
        }));
        setTracks(fullTracks);
    } else {
        alert("Codice non valido o formato non supportato per il parsing inverso.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-cyan-500/30">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Music size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 hidden sm:block">
              Strudel UI
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* BPM Control */}
            <NumberInput 
              value={bpm}
              onChange={setBpm}
              min={40}
              max={300}
              label="BPM"
            />

            {/* Default Steps Control */}
            <NumberInput 
              value={defaultStepCount}
              onChange={setDefaultStepCount}
              min={1}
              max={32}
              label="STEPS"
            />

            {/* Transport */}
            <button 
              onClick={togglePlay}
              className={clsx(
                "flex items-center gap-2 px-4 py-1.5 rounded-lg font-medium transition-all shadow-lg",
                isPlaying 
                  ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/50" 
                  : "bg-cyan-500 text-slate-900 hover:bg-cyan-400 shadow-cyan-500/20"
              )}
            >
              {isPlaying ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              <span className="hidden sm:inline">{isPlaying ? "Stop" : "Play"}</span>
            </button>

            {/* Record */}
            <button 
              onClick={handleRecord}
              className={clsx(
                "p-2 rounded-lg transition-all border",
                isRecording 
                  ? "bg-red-500 text-white border-red-500 animate-pulse" 
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-red-400 hover:border-red-400/50"
              )}
              title="Registra Audio"
            >
              {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {/* Code Toggle */}
            <button 
              onClick={() => setShowCode(!showCode)}
              className={clsx(
                "p-2 rounded-lg transition-all border",
                showCode 
                  ? "bg-slate-700 text-cyan-400 border-cyan-500/50" 
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-cyan-400"
              )}
              title="Mostra/Nascondi Codice"
            >
              <Code size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex h-[calc(100vh-64px)] relative overflow-hidden">
        
        {/* Tracks Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          {/* Sticky Sequence Strip */}
          <div className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 pt-4 pb-2 px-4 shadow-lg">
            <SequenceList 
                sequences={sequences}
                activeSequenceId={activeSequenceId}
                pinnedSequenceId={pinnedSequenceId}
                onSelect={setActiveSequenceId}
                onPin={(id) => setPinnedSequenceId(prev => prev === id ? null : id)}
                onCreate={addSequence}
                onDuplicate={duplicateSequence}
                onDelete={deleteSequence}
                onRename={renameSequence}
                playMode={playMode}
                onTogglePlayMode={() => setPlayMode(prev => prev === 'single' ? 'all' : 'single')}
            />
          </div>

          <div className="py-6 px-4">
            {/* Track List - Shows DISPLAYED tracks */}
            <TrackList 
              tracks={displayedTracks} 
              currentTrackSteps={currentTrackSteps}
              onUpdateTrack={updateTrack}
              onRemoveTrack={removeTrack}
            />
          </div>

          {/* Floating Add Button */}
          <div className="fixed bottom-8 right-8 z-30">
             <div className="relative">
                {showAddMenu && (
                  <div className="absolute bottom-16 right-0 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-2 w-64 max-h-[70vh] overflow-y-auto custom-scrollbar flex flex-col gap-1 animate-in slide-in-from-bottom-4 fade-in duration-200">
                    {['Drums', 'Synths', 'Noise'].map(category => (
                        <div key={category} className="mb-2">
                            <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-800 z-10">
                                {category}
                            </div>
                            {INSTRUMENTS.filter(i => i.category === category).map(inst => (
                                <button
                                    key={inst.id}
                                    onClick={() => addTrack(inst.id)}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-700 text-left transition-colors group"
                                >
                                    <div className={clsx("w-3 h-3 rounded-full", inst.color)} />
                                    <span className="text-slate-200 group-hover:text-white text-sm">{inst.name}</span>
                                </button>
                            ))}
                        </div>
                    ))}
                  </div>
                )}
                <button 
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  className={clsx(
                    "w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/30 transition-all hover:scale-105 active:scale-95",
                    showAddMenu ? "bg-slate-700 text-white rotate-45" : "bg-cyan-500 text-slate-900 hover:bg-cyan-400"
                  )}
                >
                  <Plus size={28} />
                </button>
             </div>
          </div>
        </div>

        {/* Code Panel (Drawer) */}
        <div className={clsx(
          "fixed inset-y-0 right-0 w-full md:w-[450px] bg-slate-950 border-l border-slate-800 transform transition-transform duration-300 ease-in-out z-40 shadow-2xl flex flex-col pt-16",
          showCode ? "translate-x-0" : "translate-x-full"
        )}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900">
            <h2 className="font-mono text-sm text-cyan-400 font-bold flex items-center gap-2">
              <Code size={16} />
              STRUDEL CODE
              {pinnedSequenceId && <span className="text-[10px] bg-cyan-900/50 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-700/50">PINNED VIEW</span>}
            </h2>
            <div className="flex gap-2">
                <button onClick={applyCode} className="text-xs bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-slate-300 border border-slate-700">
                    Applica Modifiche
                </button>
                <button onClick={() => setShowCode(false)} className="text-slate-500 hover:text-white">
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
            />
          </div>
          <div className="p-4 bg-slate-900 border-t border-slate-800 text-xs text-slate-500">
            <p>Modifica il codice per aggiornare la UI (sperimentale).</p>
            <p className="mt-1">Supporta <code>.note</code>, <code>.gain</code>, <code>.pan</code>, <code>.delay</code>, <code>.reverb</code>, <code>.distortion</code>.</p>
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;
