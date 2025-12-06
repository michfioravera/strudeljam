// src/lib/strudel-gen.ts
import { Track, Step, InstrumentType, INSTRUMENTS, SEQUENCER_CONFIG } from './constants';
import { generateId } from '../utils/id';

export function generateStrudelCode(tracks: Track[], bpm: number): string {
  if (tracks.length === 0) {
    return `// Nessuna traccia\n// Aggiungi strumenti per generare il codice\n\nsetcps(${(bpm / 60 / 4).toFixed(4)})`;
  }

  const cps = bpm / 60 / 4;
  let code = `// StrudelJam v3.0 - Codice Generato\n`;
  code += `// BPM: ${bpm}\n\n`;
  code += `setcps(${cps.toFixed(4)})\n\n`;

  const trackCodes: string[] = [];

  tracks.forEach((track, index) => {
    const instDef = INSTRUMENTS.find((i) => i.id === track.instrument);
    if (!instDef) return;

    const stepCount = track.stepCount || SEQUENCER_CONFIG.STEPS_PER_MEASURE;
    const activeSteps = track.steps.slice(0, stepCount);

    const patternParts: string[] = [];
    
    activeSteps.forEach((step) => {
      if (step.active) {
        patternParts.push(step.note || instDef.defaultNote);
      } else {
        patternParts.push('~');
      }
    });

    const pattern = patternParts.join(' ');

    let expr = `// Traccia ${index + 1}: ${instDef.name}\n`;
    expr += `note("${pattern}")`;
    expr += `\n  .sound("${getStrudelSound(track.instrument)}")`;

    const activeStepsWithVelocity = activeSteps.filter((s) => s.active);
    if (activeStepsWithVelocity.length > 0) {
      const velocities = activeStepsWithVelocity.map((s) => (s.velocity ?? 100) / 100);
      const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
      expr += `\n  .gain(${(track.volume * avgVelocity).toFixed(2)})`;
    } else {
      expr += `\n  .gain(${track.volume.toFixed(2)})`;
    }

    if (track.pan !== 0) {
      expr += `\n  .pan(${((track.pan + 1) / 2).toFixed(2)})`;
    }

    if (track.delay > 0) {
      expr += `\n  .delay(${(track.delay / 100).toFixed(2)})`;
    }

    if (track.reverb > 0) {
      expr += `\n  .room(${(track.reverb / 100).toFixed(2)})`;
    }

    if (track.distortion > 0) {
      expr += `\n  .distort(${(track.distortion / 100).toFixed(2)})`;
    }

    if (track.muted) {
      expr = `// DISATTIVATA\n// ${expr.split('\n').join('\n// ')}`;
    }

    trackCodes.push(expr);
  });

  code += trackCodes.join('\n\n');

  return code;
}

function getStrudelSound(type: InstrumentType): string {
  const soundMap: Record<InstrumentType, string> = {
    kick: 'bd',
    snare: 'sd',
    hat: 'hh',
    open_hat: 'oh',
    clap: 'cp',
    tom: 'tom',
    rim: 'rim',
    crash: 'crash',
    ride: 'ride',
    perc: 'perc',
    sine: 'sine',
    triangle: 'triangle',
    square: 'square',
    sawtooth: 'sawtooth',
    white: 'white',
    pink: 'pink',
    brown: 'brown',
  };
  return soundMap[type] || 'sine';
}

export function parseStrudelCode(code: string): Partial<Track>[] | null {
  try {
    const tracks: Partial<Track>[] = [];
    // Fix: Match "Traccia" (Italian) instead of "Track"
    const trackBlocks = code.split(/\/\/ Traccia \d+:/);

    trackBlocks.forEach((block) => {
      const trimmedBlock = block.trim();
      if (!trimmedBlock || trimmedBlock.startsWith('// StrudelJam') || trimmedBlock.startsWith('setcps')) {
        return;
      }

      const isMuted = trimmedBlock.includes('// DISATTIVATA');
      const cleanBlock = trimmedBlock.replace(/\/\/ DISATTIVATA\n?/g, '').replace(/^\/\/ /gm, '');

      // More flexible note pattern matching
      const noteMatch = cleanBlock.match(/note\s*\(\s*["']([^"']+)["']\s*\)/);
      if (!noteMatch) {
        console.warn('[STRUDEL-GEN] No note pattern found in block:', cleanBlock.substring(0, 100));
        return;
      }

      const pattern = noteMatch[1];
      const notes = pattern.split(/\s+/).filter(n => n.length > 0);

      // More flexible sound matching
      const soundMatch = cleanBlock.match(/\.sound\s*\(\s*["']([^"']+)["']\s*\)/);
      const sound = soundMatch ? soundMatch[1] : 'sine';
      const instrument = getInstrumentFromSound(sound);

      // More flexible parameter matching with optional whitespace
      const gainMatch = cleanBlock.match(/\.gain\s*\(\s*([0-9.]+)\s*\)/);
      const gain = gainMatch ? parseFloat(gainMatch[1]) : 0.8;

      const panMatch = cleanBlock.match(/\.pan\s*\(\s*([0-9.]+)\s*\)/);
      const pan = panMatch ? parseFloat(panMatch[1]) * 2 - 1 : 0;

      const delayMatch = cleanBlock.match(/\.delay\s*\(\s*([0-9.]+)\s*\)/);
      const delay = delayMatch ? Math.round(parseFloat(delayMatch[1]) * 100) : 0;

      const roomMatch = cleanBlock.match(/\.room\s*\(\s*([0-9.]+)\s*\)/);
      const reverb = roomMatch ? Math.round(parseFloat(roomMatch[1]) * 100) : 0;

      const distortMatch = cleanBlock.match(/\.distort\s*\(\s*([0-9.]+)\s*\)/);
      const distortion = distortMatch ? Math.round(parseFloat(distortMatch[1]) * 100) : 0;

      const steps: Step[] = [];
      const instDef = INSTRUMENTS.find((i) => i.id === instrument);

      notes.forEach((note) => {
        if (note === '~' || note === '-' || note === '.') {
          steps.push({
            active: false,
            note: instDef?.defaultNote || 'C3',
            velocity: SEQUENCER_CONFIG.DEFAULT_VELOCITY,
          });
        } else {
          steps.push({
            active: true,
            note: note,
            velocity: Math.round(gain * 100),
          });
        }
      });

      while (steps.length < SEQUENCER_CONFIG.MAX_STEPS) {
        steps.push({
          active: false,
          note: instDef?.defaultNote || 'C3',
          velocity: SEQUENCER_CONFIG.DEFAULT_VELOCITY,
        });
      }

      tracks.push({
        id: generateId(),
        instrument,
        stepCount: Math.min(notes.length, SEQUENCER_CONFIG.MAX_STEPS),
        steps,
        volume: Math.min(1, gain),
        muted: isMuted,
        pan,
        delay,
        reverb,
        distortion,
      });
    });

    if (tracks.length === 0) {
      console.warn('[STRUDEL-GEN] No tracks parsed from code');
    }

    return tracks.length > 0 ? tracks : null;
  } catch (error) {
    console.error('[STRUDEL-GEN] Parse error:', error);
    return null;
  }
}

function getInstrumentFromSound(sound: string): InstrumentType {
  const reverseMap: Record<string, InstrumentType> = {
    bd: 'kick',
    sd: 'snare',
    hh: 'hat',
    oh: 'open_hat',
    cp: 'clap',
    tom: 'tom',
    rim: 'rim',
    crash: 'crash',
    ride: 'ride',
    perc: 'perc',
    sine: 'sine',
    triangle: 'triangle',
    square: 'square',
    sawtooth: 'sawtooth',
    saw: 'sawtooth',
    white: 'white',
    pink: 'pink',
    brown: 'brown',
  };
  return reverseMap[sound] || 'sine';
}