// src/lib/strudel-gen.ts
// Strudel code generation and parsing

import { Track, Step, InstrumentType, INSTRUMENTS, SEQUENCER_CONFIG } from './constants';
import { generateId } from '../utils/id';

/**
 * Generate Strudel code from tracks
 */
export function generateStrudelCode(tracks: Track[], bpm: number): string {
  if (tracks.length === 0) {
    return `// No tracks yet\n// Add instruments to generate Strudel code\n\nsetcps(${(bpm / 60 / 4).toFixed(4)})`;
  }

  const cps = bpm / 60 / 4;
  let code = `// StrudelJam v3.0 - Generated Code\n`;
  code += `// BPM: ${bpm}\n\n`;
  code += `setcps(${cps.toFixed(4)})\n\n`;

  const trackCodes: string[] = [];

  tracks.forEach((track, index) => {
    const instDef = INSTRUMENTS.find((i) => i.id === track.instrument);
    if (!instDef) return;

    const stepCount = track.stepCount || SEQUENCER_CONFIG.STEPS_PER_MEASURE;
    const activeSteps = track.steps.slice(0, stepCount);

    // Build pattern string
    const patternParts: string[] = [];
    
    activeSteps.forEach((step) => {
      if (step.active) {
        patternParts.push(step.note || instDef.defaultNote);
      } else {
        patternParts.push('~');
      }
    });

    const pattern = patternParts.join(' ');

    // Build the Strudel expression
    let expr = `// Track ${index + 1}: ${instDef.name}\n`;
    expr += `note("${pattern}")`;

    // Add sound/instrument
    expr += `\n  .sound("${getStrudelSound(track.instrument)}")`;

    // Add gain based on velocity (average of active steps)
    const activeStepsWithVelocity = activeSteps.filter((s) => s.active);
    if (activeStepsWithVelocity.length > 0) {
      const velocities = activeStepsWithVelocity.map((s) => (s.velocity ?? 100) / 100);
      const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
      expr += `\n  .gain(${(track.volume * avgVelocity).toFixed(2)})`;
    } else {
      expr += `\n  .gain(${track.volume.toFixed(2)})`;
    }

    // Add pan
    if (track.pan !== 0) {
      expr += `\n  .pan(${((track.pan + 1) / 2).toFixed(2)})`;
    }

    // Add delay
    if (track.delay > 0) {
      expr += `\n  .delay(${(track.delay / 100).toFixed(2)})`;
    }

    // Add reverb
    if (track.reverb > 0) {
      expr += `\n  .room(${(track.reverb / 100).toFixed(2)})`;
    }

    // Add distortion
    if (track.distortion > 0) {
      expr += `\n  .distort(${(track.distortion / 100).toFixed(2)})`;
    }

    // Add mute comment
    if (track.muted) {
      expr = `// MUTED\n// ${expr.split('\n').join('\n// ')}`;
    }

    trackCodes.push(expr);
  });

  code += trackCodes.join('\n\n');

  return code;
}

/**
 * Get Strudel sound name from instrument type
 */
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

/**
 * Parse Strudel code back to track configuration
 */
export function parseStrudelCode(code: string): Partial<Track>[] | null {
  try {
    const tracks: Partial<Track>[] = [];

    // Split by track comments or double newlines
    const trackBlocks = code.split(/\/\/ Track \d+:|(?:\n\s*\n)/);

    trackBlocks.forEach((block) => {
      const trimmedBlock = block.trim();
      if (!trimmedBlock || trimmedBlock.startsWith('// StrudelJam') || trimmedBlock.startsWith('setcps')) {
        return;
      }

      // Check if muted
      const isMuted = trimmedBlock.includes('// MUTED');
      const cleanBlock = trimmedBlock.replace(/\/\/ MUTED\n?/g, '').replace(/\/\/ /g, '');

      // Parse note pattern
      const noteMatch = cleanBlock.match(/note$"([^"]+)"$/);
      if (!noteMatch) return;

      const pattern = noteMatch[1];
      const notes = pattern.split(/\s+/);

      // Parse sound
      const soundMatch = cleanBlock.match(/\.sound$"([^"]+)"$/);
      const sound = soundMatch ? soundMatch[1] : 'sine';
      const instrument = getInstrumentFromSound(sound);

      // Parse gain
      const gainMatch = cleanBlock.match(/\.gain$([0-9.]+)$/);
      const gain = gainMatch ? parseFloat(gainMatch[1]) : 0.8;

      // Parse pan
      const panMatch = cleanBlock.match(/\.pan$([0-9.]+)$/);
      const pan = panMatch ? parseFloat(panMatch[1]) * 2 - 1 : 0;

      // Parse delay
      const delayMatch = cleanBlock.match(/\.delay$([0-9.]+)$/);
      const delay = delayMatch ? Math.round(parseFloat(delayMatch[1]) * 100) : 0;

      // Parse reverb
      const roomMatch = cleanBlock.match(/\.room$([0-9.]+)$/);
      const reverb = roomMatch ? Math.round(parseFloat(roomMatch[1]) * 100) : 0;

      // Parse distortion
      const distortMatch = cleanBlock.match(/\.distort$([0-9.]+)$/);
      const distortion = distortMatch ? Math.round(parseFloat(distortMatch[1]) * 100) : 0;

      // Build steps
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

      // Pad to 32 steps
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

    return tracks.length > 0 ? tracks : null;
  } catch (error) {
    console.error('[STRUDEL-GEN] Parse error:', error);
    return null;
  }
}

/**
 * Get instrument type from Strudel sound name
 */
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