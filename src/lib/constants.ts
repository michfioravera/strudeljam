export const TOTAL_STEPS = 16;
export const DEFAULT_STEP_COUNT = 16;

export type InstrumentType = 
  | 'kick' | 'snare' | 'rim' | 'hat' | 'open_hat' | 'tom' | 'ride' | 'crash' | 'clap' | 'perc'
  | 'sine' | 'triangle' | 'square' | 'sawtooth'
  | 'white' | 'pink' | 'brown';

export interface InstrumentDef {
  id: InstrumentType;
  name: string;
  strudelName: string;
  defaultNote?: string;
  color: string; // Tailwind class for background/text
  category: 'Drums' | 'Synths' | 'Noise';
}

export const INSTRUMENTS: InstrumentDef[] = [
  // Drums
  { id: 'kick', name: 'Kick (Cassa)', strudelName: 'bd', category: 'Drums', color: 'bg-red-600', defaultNote: 'C1' },
  { id: 'snare', name: 'Snare', strudelName: 'sd', category: 'Drums', color: 'bg-orange-500', defaultNote: 'C2' },
  { id: 'rim', name: 'Rimshot', strudelName: 'rim', category: 'Drums', color: 'bg-amber-700', defaultNote: 'C2' },
  { id: 'hat', name: 'Hi-Hat Closed', strudelName: 'hh', category: 'Drums', color: 'bg-yellow-400', defaultNote: 'C4' },
  { id: 'open_hat', name: 'Hi-Hat Open', strudelName: 'oh', category: 'Drums', color: 'bg-yellow-200', defaultNote: 'C4' },
  { id: 'tom', name: 'Tom', strudelName: 'tom', category: 'Drums', color: 'bg-green-600', defaultNote: 'G2' },
  { id: 'ride', name: 'Ride', strudelName: 'ride', category: 'Drums', color: 'bg-emerald-800', defaultNote: 'C4' },
  { id: 'crash', name: 'Crash', strudelName: 'crash', category: 'Drums', color: 'bg-cyan-400', defaultNote: 'C4' },
  { id: 'clap', name: 'Clap', strudelName: 'cp', category: 'Drums', color: 'bg-blue-500', defaultNote: 'C4' },
  { id: 'perc', name: 'Percussion', strudelName: 'perc', category: 'Drums', color: 'bg-blue-900', defaultNote: 'C4' },

  // Synths
  { id: 'sine', name: 'Sine Wave', strudelName: 'sine', category: 'Synths', color: 'bg-fuchsia-500', defaultNote: 'C4' },
  { id: 'triangle', name: 'Triangle', strudelName: 'triangle', category: 'Synths', color: 'bg-purple-600', defaultNote: 'C4' },
  { id: 'square', name: 'Square', strudelName: 'square', category: 'Synths', color: 'bg-pink-600', defaultNote: 'C4' },
  { id: 'sawtooth', name: 'Sawtooth', strudelName: 'sawtooth', category: 'Synths', color: 'bg-pink-400', defaultNote: 'C4' },

  // Noise
  { id: 'white', name: 'White Noise', strudelName: 'white', category: 'Noise', color: 'bg-slate-400', defaultNote: 'C4' },
  { id: 'pink', name: 'Pink Noise', strudelName: 'pink', category: 'Noise', color: 'bg-rose-300', defaultNote: 'C4' },
  { id: 'brown', name: 'Brown Noise', strudelName: 'brown', category: 'Noise', color: 'bg-amber-900', defaultNote: 'C4' },
];

export interface Step {
  active: boolean;
  note: string;
  velocity: number; // 1-100
}

export interface Track {
  id: string;
  instrument: InstrumentType;
  steps: Step[];
  stepCount: number;
  volume: number;
  muted: boolean;
  pan: number;
  delay: number;
  reverb: number;
  distortion: number;
}

export interface Sequence {
  id: string;
  name: string;
  tracks: Track[];
}
