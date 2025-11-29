export const TOTAL_STEPS = 16;

export type InstrumentType = 'kick' | 'bass' | 'hat' | 'clap' | 'snare' | 'perc' | 'lead';

export interface InstrumentDef {
  id: InstrumentType;
  name: string;
  strudelName: string; // The name used in s("name")
  defaultNote?: string; // For melodic instruments
  color: string;
}

export const INSTRUMENTS: InstrumentDef[] = [
  { id: 'kick', name: 'Cassa (Kick)', strudelName: 'bd', color: 'bg-pink-500', defaultNote: 'C1' },
  { id: 'bass', name: 'Basso Psy', strudelName: 'bass', defaultNote: 'C2', color: 'bg-purple-500' },
  { id: 'hat', name: 'Hi-Hat', strudelName: 'hh', color: 'bg-yellow-500', defaultNote: 'C4' },
  { id: 'clap', name: 'Clap', strudelName: 'cp', color: 'bg-orange-500', defaultNote: 'C4' },
  { id: 'snare', name: 'Snare', strudelName: 'sd', color: 'bg-red-500', defaultNote: 'C4' },
  { id: 'perc', name: 'Percussioni', strudelName: 'perc', color: 'bg-emerald-500', defaultNote: 'C4' },
  { id: 'lead', name: 'Synth Lead', strudelName: 'sawtooth', defaultNote: 'C4', color: 'bg-cyan-500' },
];

export interface Step {
  active: boolean;
  note: string;
}

export interface Track {
  id: string;
  instrument: InstrumentType;
  steps: Step[];
  volume: number; // 0-1 linear
  muted: boolean;
}
