// src/lib/strudel-gen.ts
import { Track, Step, InstrumentType, INSTRUMENTS, SEQUENCER_CONFIG } from './constants';
import { generateId } from '../utils/id';

export function generateStrudelCode(tracks: Track[], bpm: number): string {
  if (tracks.length === 0) {
    return `// Nessuna traccia\n// Aggiungi strumenti per generare il codice\n\nsetcps(${(bpm / 60 / 4).toFixed(4)})`;
  }

  const cps = bpm / 60 / 4;
  let code = `// BPM: ${bpm}\n\n`;
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
    expr += `\n  .gain(${track.volume.toFixed(2)})`;

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

/**
 * Estrae il contenuto tra parentesi, ignorando il tipo di virgolette
 * Es: note("C3 D3") -> "C3 D3"
 * Es: .sound("bd") -> "bd"
 */
function extractParenContent(text: string, funcName: string): string | null {
  // Trova "funcName(" 
  const funcStart = text.indexOf(funcName + '(');
  if (funcStart === -1) return null;
  
  // Trova la prima parentesi aperta dopo il nome funzione
  const openParen = funcStart + funcName.length;
  
  // Trova la parentesi chiusa corrispondente
  let depth = 1;
  let i = openParen + 1;
  while (i < text.length && depth > 0) {
    if (text[i] === '(') depth++;
    if (text[i] === ')') depth--;
    i++;
  }
  
  if (depth !== 0) return null;
  
  // Estrai il contenuto tra le parentesi
  let content = text.substring(openParen + 1, i - 1).trim();
  
  // Rimuovi le virgolette (qualsiasi tipo) all'inizio e alla fine
  content = content.replace(/^["'""''`]+/, '').replace(/["'""''`]+$/, '');
  
  return content;
}

/**
 * Estrae un numero da una chiamata di metodo
 * Es: .gain(0.80) -> 0.80
 */
function extractNumberParam(text: string, funcName: string): number | null {
  const content = extractParenContent(text, funcName);
  if (content === null) return null;
  
  const num = parseFloat(content);
  return isNaN(num) ? null : num;
}

export function parseStrudelCode(code: string): Partial<Track>[] | null {
  console.log('[STRUDEL-GEN] === START PARSING ===');
  console.log('[STRUDEL-GEN] Code length:', code.length);
  
  try {
    const tracks: Partial<Track>[] = [];
    
    // Split per "// Traccia X:" usando regex con flag global
    const trackRegex = /\/\/\s*Traccia\s+\d+:\s*([^\n]*)\n([\s\S]*?)(?=\/\/\s*Traccia\s+\d+:|$)/gi;
    let match;
    
    while ((match = trackRegex.exec(code)) !== null) {
      const instrumentName = match[1].trim();
      const blockContent = match[2].trim();
      
      console.log('[STRUDEL-GEN] Found track:', instrumentName);
      
      // Controlla se è muted
      const isMuted = blockContent.includes('DISATTIVATA');
      
      // Pulisci il blocco dai commenti se muted
      let cleanBlock = blockContent;
      if (isMuted) {
        cleanBlock = blockContent
          .split('\n')
          .map(line => line.replace(/^\/\/\s*/, ''))
          .join('\n');
      }
      
      // Estrai pattern note usando il nuovo metodo
      const pattern = extractParenContent(cleanBlock, 'note');
      if (!pattern) {
        console.warn('[STRUDEL-GEN] No note() pattern in block');
        
        // Debug: mostra i primi caratteri con i loro codici
        const firstChars = cleanBlock.substring(0, 30);
        console.log('[STRUDEL-GEN] First 30 chars:', firstChars);
        console.log('[STRUDEL-GEN] Char codes:', [...firstChars].map(c => c.charCodeAt(0)));
        continue;
      }
      
      const notes = pattern.split(/\s+/).filter(n => n.length > 0);
      console.log('[STRUDEL-GEN] Notes:', notes.length, '-', notes.slice(0, 6).join(', '));
      
      // Estrai sound
      const sound = extractParenContent(cleanBlock, '.sound') || 'sine';
      const instrument = getInstrumentFromSound(sound);
      console.log('[STRUDEL-GEN] Sound:', sound, '-> Instrument:', instrument);
      
      // Estrai parametri numerici
      const volume = extractNumberParam(cleanBlock, '.gain') ?? 0.8;
      const panRaw = extractNumberParam(cleanBlock, '.pan');
      const pan = panRaw !== null ? panRaw * 2 - 1 : 0;
      const delay = Math.round((extractNumberParam(cleanBlock, '.delay') ?? 0) * 100);
      const reverb = Math.round((extractNumberParam(cleanBlock, '.room') ?? 0) * 100);
      const distortion = Math.round((extractNumberParam(cleanBlock, '.distort') ?? 0) * 100);
      
      console.log('[STRUDEL-GEN] Params - vol:', volume, 'pan:', pan, 'delay:', delay);
      
      // Build steps array
      const steps: Step[] = [];
      const instDef = INSTRUMENTS.find((i) => i.id === instrument);
      const defaultNote = instDef?.defaultNote || 'C3';
      
      notes.forEach((note) => {
        if (note === '~' || note === '-' || note === '.') {
          steps.push({
            active: false,
            note: defaultNote,
            velocity: SEQUENCER_CONFIG.DEFAULT_VELOCITY,
          });
        } else {
          steps.push({
            active: true,
            note: note,
            velocity: SEQUENCER_CONFIG.DEFAULT_VELOCITY,
          });
        }
      });
      
      // Pad to MAX_STEPS
      while (steps.length < SEQUENCER_CONFIG.MAX_STEPS) {
        steps.push({
          active: false,
          note: defaultNote,
          velocity: SEQUENCER_CONFIG.DEFAULT_VELOCITY,
        });
      }
      
      const track: Partial<Track> = {
        id: generateId(),
        instrument,
        stepCount: Math.min(notes.length, SEQUENCER_CONFIG.MAX_STEPS),
        steps,
        volume: Math.min(1, Math.max(0, volume)),
        muted: isMuted,
        pan: Math.min(1, Math.max(-1, pan)),
        delay: Math.min(100, Math.max(0, delay)),
        reverb: Math.min(100, Math.max(0, reverb)),
        distortion: Math.min(100, Math.max(0, distortion)),
      };
      
      console.log('[STRUDEL-GEN] ✓ Track created:', instrument, 'with', track.stepCount, 'steps');
      tracks.push(track);
    }
    
    console.log('[STRUDEL-GEN] === PARSING COMPLETE:', tracks.length, 'tracks ===');
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