import { Track, INSTRUMENTS, TOTAL_STEPS, Step } from './constants';

export const generateStrudelCode = (tracks: Track[], bpm: number): string => {
  if (tracks.length === 0) return '// Aggiungi una traccia per iniziare\n';

  const trackLines = tracks.map(track => {
    if (track.muted) return null;
    
    const instDef = INSTRUMENTS.find(i => i.id === track.instrument);
    if (!instDef) return null;

    const stepCount = track.stepCount || 16;
    const activeSteps = track.steps.slice(0, stepCount).filter(s => s.active);
    
    if (activeSteps.length === 0) return null;

    const firstNote = activeSteps[0]?.note;
    const allSameNote = activeSteps.every(s => s.note === firstNote);
    
    // Check if all velocities are 100
    const allFullVelocity = activeSteps.every(s => (s.velocity ?? 100) === 100);

    let line = `  s("${instDef.strudelName}")`;

    // Note & Struct
    // We use the stepCount to determine the cycle division
    const patternChars = track.steps.slice(0, stepCount).map(s => s.active ? 'x' : '.');
    const patternString = patternChars.join('');
    
    // Format pattern for readability (chunks of 4 if possible)
    const formattedPattern = patternString.match(/.{1,4}/g)?.join('.') || patternString;

    if (allSameNote && firstNote) {
      line += `.note("${firstNote}")`;
      line += `.struct("${formattedPattern}")`;
    } else {
      // For melodic patterns, we map notes to the grid
      const notePattern = track.steps.slice(0, stepCount).map(s => s.active ? s.note : '~').join(' ');
      line += `.note("${notePattern}")`;
    }
    
    // Gain / Velocity
    const trackVol = track.volume;
    
    if (allFullVelocity) {
        if (trackVol < 1) {
            line += `.gain(${trackVol.toFixed(2)})`;
        }
    } else {
        // Generate gain pattern matching the step count
        const gainPattern = track.steps.slice(0, stepCount).map(s => {
            if (!s.active) return '~';
            const vel = (s.velocity ?? 100) / 100;
            const finalGain = vel * trackVol;
            return parseFloat(finalGain.toFixed(2));
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

      // Default initialization
      let stepCount = 16;
      const steps: Step[] = Array(32).fill(null).map(() => ({ // Allocating max 32
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
           // It's a pattern like "C3 ~ D3 ~"
           const tokens = noteContent.trim().split(/\s+/);
           stepCount = tokens.length; // Inferred length
           
           for (let i = 0; i < tokens.length; i++) {
             if (tokens[i] !== '~' && tokens[i] !== '.') {
               steps[i] = { active: true, note: tokens[i], velocity: 100 };
             }
           }
        } else {
           // Single note applied to a struct
           const fixedNote = noteContent;
           if (structMatch) {
             const rawChars = structMatch[1].replace(/[\s.]/g, (m) => m === '.' ? '.' : ''); // Keep dots, remove spaces? No, struct("x.x.")
             // Actually struct string: "x.x." -> length 4
             const cleanStruct = structMatch[1].replace(/\s/g, '');
             stepCount = cleanStruct.length;
             
             for (let i = 0; i < cleanStruct.length; i++) {
                if (cleanStruct[i] !== '.') {
                  steps[i] = { active: true, note: fixedNote, velocity: 100 };
                }
             }
           }
        }
      } else if (structMatch) {
         const cleanStruct = structMatch[1].replace(/\s/g, '');
         stepCount = cleanStruct.length;
         for (let i = 0; i < cleanStruct.length; i++) {
            if (cleanStruct[i] !== '.') {
              steps[i] = { active: true, note: instDef.defaultNote || 'C3', velocity: 100 };
            }
         }
      }

      // Volume & Velocity Parsing
      const gainPatternMatch = line.match(/\.gain\("([^"]+)"\)/);
      const gainSingleMatch = line.match(/\.gain\(([\d.-]+)\)/);
      
      let trackVolume = 1;

      if (gainPatternMatch) {
         const tokens = gainPatternMatch[1].trim().split(/\s+/);
         // If gain pattern length differs from stepCount, it's complex. Assume they match.
         if (tokens.length === stepCount) {
             for (let i = 0; i < stepCount; i++) {
                if (tokens[i] !== '~' && steps[i].active) {
                    const gainVal = parseFloat(tokens[i]);
                    steps[i].velocity = Math.min(100, Math.max(1, Math.round(gainVal * 100)));
                }
             }
         }
      } else if (gainSingleMatch) {
         trackVolume = parseFloat(gainSingleMatch[1]);
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
        steps: steps.slice(0, 32), // Ensure we have buffer
        stepCount: Math.max(1, Math.min(32, stepCount)),
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
