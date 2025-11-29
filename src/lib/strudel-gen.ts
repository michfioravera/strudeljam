import { Track, INSTRUMENTS, TOTAL_STEPS, Step } from './constants';

export const generateStrudelCode = (tracks: Track[], bpm: number): string => {
  if (tracks.length === 0) return '// Aggiungi una traccia per iniziare\n';

  const trackLines = tracks.map(track => {
    if (track.muted) return null;
    
    const instDef = INSTRUMENTS.find(i => i.id === track.instrument);
    if (!instDef) return null;

    if (track.steps.every(s => !s.active)) return null;

    const activeSteps = track.steps.filter(s => s.active);
    const firstNote = activeSteps[0]?.note;
    const allSameNote = activeSteps.every(s => s.note === firstNote);
    
    // Check if all velocities are 100
    const allFullVelocity = activeSteps.every(s => (s.velocity ?? 100) === 100);

    let line = `  s("${instDef.strudelName}")`;

    // Note & Struct
    if (allSameNote && firstNote) {
      const pattern = track.steps.map(s => s.active ? 'x' : '.').join('');
      const formattedPattern = pattern.match(/.{1,4}/g)?.join('.') || pattern;
      
      line += `.note("${firstNote}")`;
      line += `.struct("${formattedPattern}")`;
    } else {
      const notePattern = track.steps.map(s => s.active ? s.note : '~').join(' ');
      line += `.note("${notePattern}")`;
    }
    
    // Gain / Velocity
    // If all velocities are 100, use simple global gain.
    // If velocities vary, create a gain pattern: (stepVel/100) * trackVol
    const trackVol = track.volume;
    
    if (allFullVelocity) {
        if (trackVol < 1) {
            line += `.gain(${trackVol.toFixed(2)})`;
        }
    } else {
        // Generate gain pattern
        const gainPattern = track.steps.map(s => {
            if (!s.active) return '~';
            const vel = (s.velocity ?? 100) / 100;
            const finalGain = vel * trackVol;
            return parseFloat(finalGain.toFixed(2)); // Remove unnecessary decimals
        }).join(' ');
        line += `.gain("${gainPattern}")`;
    }

    // Pan
    if (track.pan !== 0) {
        line += `.pan(${track.pan})`;
    }

    // Effects
    if (track.delay > 0) {
        line += `.delay(${track.delay / 100})`;
    }
    if (track.reverb > 0) {
        line += `.reverb(${track.reverb / 100})`;
    }
    if (track.distortion > 0) {
        line += `.distortion(${track.distortion / 100})`;
    }

    return line;
  }).filter(Boolean);

  if (trackLines.length === 0) return `// Tutte le tracce sono mute o vuote\nsetcps(${bpm/60/4})`;

  return `// Strudel Code Generated
setcps(${bpm / 60 / 4}); // ${bpm} BPM

stack(
${trackLines.join(',\n')}
).out();
`;
};

export const parseStrudelCode = (code: string): Partial<Track>[] | null => {
  try {
    const lines = code.split('\n');
    const parsedTracks: Partial<Track>[] = [];

    lines.forEach(line => {
      const sMatch = line.match(/s\("([^"]+)"\)/);
      if (!sMatch) return;

      const strudelName = sMatch[1];
      const instDef = INSTRUMENTS.find(i => i.strudelName === strudelName);
      if (!instDef) return;

      const steps: Step[] = Array(TOTAL_STEPS).fill(null).map(() => ({ 
        active: false, 
        note: instDef.defaultNote || 'C3',
        velocity: 100
      }));

      // Note & Struct parsing
      const noteMatch = line.match(/\.note\("([^"]+)"\)/);
      const structMatch = line.match(/\.struct\("([^"]+)"\)/);
      
      if (noteMatch) {
        const noteContent = noteMatch[1];
        if (noteContent.includes('~') || noteContent.includes(' ')) {
           const tokens = noteContent.trim().split(/\s+/);
           for (let i = 0; i < Math.min(tokens.length, TOTAL_STEPS); i++) {
             if (tokens[i] !== '~' && tokens[i] !== '.') {
               steps[i] = { active: true, note: tokens[i], velocity: 100 };
             }
           }
        } else {
           const fixedNote = noteContent;
           if (structMatch) {
             const rawChars = structMatch[1].replace(/\s/g, '').split('');
             for (let i = 0; i < Math.min(rawChars.length, TOTAL_STEPS); i++) {
                if (rawChars[i] !== '.') {
                  steps[i] = { active: true, note: fixedNote, velocity: 100 };
                }
             }
           }
        }
      } else if (structMatch) {
         const rawChars = structMatch[1].replace(/\s/g, '').split('');
         for (let i = 0; i < Math.min(rawChars.length, TOTAL_STEPS); i++) {
            if (rawChars[i] !== '.') {
              steps[i] = { active: true, note: instDef.defaultNote || 'C3', velocity: 100 };
            }
         }
      }

      // Volume & Velocity Parsing
      // Check for gain pattern: .gain("0.5 0.8 ...")
      const gainPatternMatch = line.match(/\.gain\("([^"]+)"\)/);
      const gainSingleMatch = line.match(/\.gain\(([\d.-]+)\)/);
      
      let trackVolume = 1;

      if (gainPatternMatch) {
         // If gain is a pattern, we assume track volume is 1 and values are velocities
         // Or we could try to normalize. Let's assume track volume 1 for simplicity when parsing complex patterns.
         trackVolume = 1;
         const tokens = gainPatternMatch[1].trim().split(/\s+/);
         for (let i = 0; i < Math.min(tokens.length, TOTAL_STEPS); i++) {
            if (tokens[i] !== '~' && steps[i].active) {
                const gainVal = parseFloat(tokens[i]);
                // Map gain 0-1 to velocity 1-100
                steps[i].velocity = Math.min(100, Math.max(1, Math.round(gainVal * 100)));
            }
         }
      } else if (gainSingleMatch) {
         trackVolume = parseFloat(gainSingleMatch[1]);
         // Steps remain at default velocity 100
      }

      // Pan
      const panMatch = line.match(/\.pan\(([\d.-]+)\)/);
      const pan = panMatch ? parseFloat(panMatch[1]) : 0;

      // Effects
      const delayMatch = line.match(/\.delay\(([\d.]+)\)/);
      const delay = delayMatch ? parseFloat(delayMatch[1]) * 100 : 0;

      const reverbMatch = line.match(/\.reverb\(([\d.]+)\)/);
      const reverb = reverbMatch ? parseFloat(reverbMatch[1]) * 100 : 0;

      const distMatch = line.match(/\.distortion\(([\d.]+)\)/);
      const distortion = distMatch ? parseFloat(distMatch[1]) * 100 : 0;

      parsedTracks.push({
        id: Math.random().toString(36).substr(2, 9),
        instrument: instDef.id,
        steps,
        volume: trackVolume,
        muted: false,
        pan,
        delay,
        reverb,
        distortion
      });
    });

    return parsedTracks.length > 0 ? parsedTracks : null;
  } catch (e) {
    console.error("Failed to parse code", e);
    return null;
  }
};
