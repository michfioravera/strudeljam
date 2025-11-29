import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Square, Plus, Code, Mic, MicOff, X, Music } from 'lucide-react';
import { Track, INSTRUMENTS, TOTAL_STEPS, InstrumentType, Sequence } from './lib/constants';
import { generateStrudelCode, parseStrudelCode } from './lib/strudel-gen';
import { audioEngine } from './lib/audio-engine';
import { TrackList } from './components/TrackList';
import { SequenceList } from './components/SequenceList';
import { clsx } from 'clsx';

function App() {
  // --- Sequence State ---
  const [sequences, setSequences] = useState<Sequence[]>([
    { id: 'seq-1', name: 'Pattern A', tracks: [] }
  ]);
  const [activeSequenceId, setActiveSequenceId] = useState<string>('seq-1');
  const [playMode, setPlayMode] = useState<'single' | 'all'>('single');
  
  // Derived state for current tracks
  const activeSequence = sequences.find(s => s.id === activeSequenceId) || sequences[0];
  const tracks = activeSequence.tracks;

  // --- Existing State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [currentStep, setCurrentStep] = useState(-1);
  const [showCode, setShowCode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [codeContent, setCodeContent] = useState('');

  // Refs for playback logic
  const sequencesRef = useRef(sequences);
  const activeSeqIdRef = useRef(activeSequenceId);
  const playModeRef = useRef(playMode);
  
  // Sync refs
  useEffect(() => { sequencesRef.current = sequences; }, [sequences]);
  useEffect(() => { activeSeqIdRef.current = activeSequenceId; }, [activeSequenceId]);
  useEffect(() => { playModeRef.current = playMode; }, [playMode]);

  useEffect(() => {
    audioEngine.setBpm(bpm);
  }, [bpm]);

  // --- Playback Logic with Sequence Chaining ---
  const handleStepUpdate = useCallback((step: number) => {
    setCurrentStep(step);

    // Logic for "Play All" mode: Switch sequence at the end of the bar
    if (step === TOTAL_STEPS - 1 && playModeRef.current === 'all') {
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
    // When tracks (of the active sequence) change, update the audio engine
    audioEngine.updateSequence(tracks, handleStepUpdate);
  }, [tracks, handleStepUpdate]);

  useEffect(() => {
    const code = generateStrudelCode(tracks, bpm);
    setCodeContent(code);
  }, [tracks, bpm]);

  // --- Sequence Actions ---
  const setTracks = (newTracks: Track[]) => {
    setSequences(prev => prev.map(s => 
      s.id === activeSequenceId ? { ...s, tracks: newTracks } : s
    ));
  };

  const addSequence = () => {
    const newSeq: Sequence = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Pattern ${String.fromCharCode(65 + sequences.length)}`, // A, B, C...
      tracks: [] 
    };
    setSequences([...sequences, newSeq]);
    setActiveSequenceId(newSeq.id);
  };

  const duplicateSequence = (id: string) => {
    const seqToCopy = sequences.find(s => s.id === id);
    if (seqToCopy) {
      const newSeq: Sequence = {
        ...seqToCopy,
        id: Math.random().toString(36).substr(2, 9),
        name: `${seqToCopy.name} (Copy)`,
        // Deep copy tracks to avoid reference issues
        tracks: seqToCopy.tracks.map(t => ({
            ...t,
            steps: t.steps.map(s => ({ ...s }))
        }))
      };
      setSequences([...sequences, newSeq]);
      setActiveSequenceId(newSeq.id);
    }
  };

  const deleteSequence = (id: string) => {
    if (sequences.length <= 1) return;
    const newSeqs = sequences.filter(s => s.id !== id);
    setSequences(newSeqs);
    if (activeSequenceId === id) {
      setActiveSequenceId(newSeqs[0].id);
    }
  };

  const renameSequence = (id: string, newName: string) => {
    setSequences(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
  };


  // --- Existing Actions (Wrapped) ---
  const togglePlay = async () => {
    if (!isPlaying) {
      await audioEngine.start();
      setIsPlaying(true);
    } else {
      audioEngine.stop();
      setIsPlaying(false);
      setCurrentStep(-1);
    }
  };

  const addTrack = (type: InstrumentType) => {
    const instDef = INSTRUMENTS.find(i => i.id === type);
    const newTrack: Track = {
      id: Math.random().toString(36).substr(2, 9),
      instrument: type,
      steps: Array(TOTAL_STEPS).fill(null).map(() => ({ 
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
    setTracks([...tracks, newTrack]);
    setShowAddMenu(false);
  };

  const updateTrack = (id: string, updates: Partial<Track>) => {
    const updatedTracks = tracks.map(t => t.id === id ? { ...t, ...updates } : t);
    setTracks(updatedTracks);
  };

  const removeTrack = (id: string) => {
    audioEngine.cleanupTrack(id);
    const updatedTracks = tracks.filter(t => t.id !== id);
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
            steps: p.steps || Array(TOTAL_STEPS).fill(null).map(() => ({ active: false, note: 'C3', velocity: 100 })),
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
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              <span className="text-xs text-slate-400 font-bold tracking-wider">BPM</span>
              <input 
                type="number" 
                value={bpm} 
                onChange={(e) => setBpm(Math.max(40, Math.min(300, parseInt(e.target.value) || 120)))}
                className="w-12 bg-transparent text-center font-mono focus:outline-none text-cyan-400"
              />
            </div>

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
        <div className="flex-1 overflow-y-auto custom-scrollbar relative" onClick={() => {
          // Close menus if clicking on background
        }}>
          <div className="py-6">
            
            {/* Sequence Bar */}
            <SequenceList 
                sequences={sequences}
                activeSequenceId={activeSequenceId}
                onSelect={setActiveSequenceId}
                onCreate={addSequence}
                onDuplicate={duplicateSequence}
                onDelete={deleteSequence}
                onRename={renameSequence}
                playMode={playMode}
                onTogglePlayMode={() => setPlayMode(prev => prev === 'single' ? 'all' : 'single')}
            />

            {/* Track List */}
            <TrackList 
              tracks={tracks} 
              currentStep={currentStep} 
              onUpdateTrack={updateTrack}
              onRemoveTrack={removeTrack}
            />
          </div>

          {/* Floating Add Button */}
          <div className="fixed bottom-8 right-8 z-30">
             <div className="relative">
                {showAddMenu && (
                  <div className="absolute bottom-16 right-0 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-2 w-56 flex flex-col gap-1 animate-in slide-in-from-bottom-4 fade-in duration-200">
                    <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Aggiungi Strumento</div>
                    {INSTRUMENTS.map(inst => (
                      <button
                        key={inst.id}
                        onClick={() => addTrack(inst.id)}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-700 text-left transition-colors group"
                      >
                        <div className={clsx("w-2 h-2 rounded-full", inst.color)} />
                        <span className="text-slate-200 group-hover:text-white">{inst.name}</span>
                      </button>
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
