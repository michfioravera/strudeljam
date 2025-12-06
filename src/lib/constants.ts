// src/lib/constants.ts
// StrudelJam v3.0 - Constants and Types

export interface Step {
  active: boolean;
  note: string;
  velocity: number;
}

export interface Track {
  id: string;
  instrument: InstrumentType;
  stepCount: number;
  steps: Step[];
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

export type InstrumentType = 
  | 'kick' | 'snare' | 'hat' | 'open_hat' | 'clap' | 'tom' | 'rim' | 'crash' | 'ride' | 'perc'
  | 'sine' | 'triangle' | 'square' | 'sawtooth'
  | 'white' | 'pink' | 'brown';

export interface InstrumentDefinition {
  id: InstrumentType;
  name: string;
  category: 'Casse' | 'Sintetizzatori' | 'Rumori';
  defaultNote: string;
  color: string;
}

export const INSTRUMENTS: InstrumentDefinition[] = [
  // Casse
  { id: 'kick', name: 'Kick', category: 'Casse', defaultNote: 'C2', color: 'bg-red-500' },
  { id: 'snare', name: 'Snare', category: 'Casse', defaultNote: 'D2', color: 'bg-orange-500' },
  { id: 'hat', name: 'Hi-Hat', category: 'Casse', defaultNote: 'F#2', color: 'bg-yellow-500' },
  { id: 'open_hat', name: 'Open Hat', category: 'Casse', defaultNote: 'A#2', color: 'bg-yellow-600' },
  { id: 'clap', name: 'Clap', category: 'Casse', defaultNote: 'D#2', color: 'bg-pink-500' },
  { id: 'tom', name: 'Tom', category: 'Casse', defaultNote: 'G2', color: 'bg-amber-600' },
  { id: 'rim', name: 'Rimshot', category: 'Casse', defaultNote: 'C#2', color: 'bg-orange-400' },
  { id: 'crash', name: 'Crash', category: 'Casse', defaultNote: 'C#3', color: 'bg-cyan-500' },
  { id: 'ride', name: 'Ride', category: 'Casse', defaultNote: 'D#3', color: 'bg-teal-500' },
  { id: 'perc', name: 'Percussion', category: 'Casse', defaultNote: 'C3', color: 'bg-lime-500' },
  
  // Sintetizzatori
  { id: 'sine', name: 'Sine', category: 'Sintetizzatori', defaultNote: 'C4', color: 'bg-blue-500' },
  { id: 'triangle', name: 'Triangle', category: 'Sintetizzatori', defaultNote: 'C4', color: 'bg-indigo-500' },
  { id: 'square', name: 'Square', category: 'Sintetizzatori', defaultNote: 'C4', color: 'bg-purple-500' },
  { id: 'sawtooth', name: 'Sawtooth', category: 'Sintetizzatori', defaultNote: 'C4', color: 'bg-violet-500' },
  
  // Rumori
  { id: 'white', name: 'White Noise', category: 'Rumori', defaultNote: 'C3', color: 'bg-gray-400' },
  { id: 'pink', name: 'Pink Noise', category: 'Rumori', defaultNote: 'C3', color: 'bg-pink-400' },
  { id: 'brown', name: 'Brown Noise', category: 'Rumori', defaultNote: 'C3', color: 'bg-amber-700' },
];

export const DEFAULT_STEP_COUNT = 16;

// Sequencer configuration constants
export const SEQUENCER_CONFIG = {
  STEPS_PER_MEASURE: 16,
  BEATS_PER_MEASURE: 4,
  LAST_STEP_INDEX: 15,
  DEFAULT_VELOCITY: 100,
  MIN_VELOCITY: 1,
  MAX_VELOCITY: 100,
  MIN_BPM: 40,
  MAX_BPM: 300,
  MIN_STEPS: 1,
  MAX_STEPS: 32,
} as const;

// Polyphony configuration
export const POLYPHONY_CONFIG = {
  MAX_TOTAL_VOICES: 32,
  MAX_VOICES_PER_TRACK: 8,
  MAX_ACTIVE_PARTS: 16,
  VOICE_CLEANUP_THRESHOLD: 28,
} as const;

// Audio buffer configuration
export const AUDIO_BUFFER_CONFIG = {
  BUFFER_SIZE: 4096,
  SAMPLE_RATE: 48000,
} as const;

// Safe mode configuration
export const SAFE_MODE_CONFIG = {
  ENABLED: true,
  FILTER_FREQ: 8000,
  REDUCE_HARMONICS: true,
} as const;

// Debug configuration
export const DEBUG_CONFIG = {
  ENABLED: true,
  LOG_INTERVAL_MS: 2000,
} as const;