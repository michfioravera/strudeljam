import { Track, INSTRUMENTS, TOTAL_STEPS, Step } from './constants';

export const generateStrudelCode = (tracks: Track[], bpm: number): string => {
  if (tracks.length === 0) return '// Aggiungi una traccia per iniziare\n';

  const trackLines = tracks.map(track => {
    if (track.muted) return null;
    
    const instDef = INSTRUMENTS.find(i => i.id === track.instrument);
    if (!instDef) return null;

    // Check if track is empty
    if (track.steps.every(s => !s.active)) return null;

    // Check if all active steps have the same note
    const activeSteps = track.steps.filter(s => s.active);
    const firstNote = activeSteps[0]?.note;
    const allSameNote = activeSteps.every(s => s.note === firstNote);

    const gain = track.volume.toFixed(2);
    let line = `  s("${instDef.strudelName}")`;

    if (allSameNote && firstNote) {
      const pattern = track.steps.map(s => s.active ? 'x' : '.').join('');
      const formattedPattern = pattern.match(/.{1,4}/g)?.join('.') || pattern;
      
      line += `.note("${firstNote}")`;
      line += `.struct("${formattedPattern}")`;
    } else {
      const notePattern = track.steps.map(s => s.active ? s.note : '~').join(' ');
      line += `.note("${notePattern}")`;
    }
    
    // Volume
    if (track.volume < 1) {
      line += `.gain(${gain})`;
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
        note: instDef.defaultNote || 'C3' 
      }));

      // Note & Struct parsing (same as before)
      const noteMatch = line.match(/\.note\("([^"]+)"\)/);
      const structMatch = line.match(/\.struct\("([^"]+)"\)/);
      
      if (noteMatch) {
        const noteContent = noteMatch[1];
        if (noteContent.includes('~') || noteContent.includes(' ')) {
           const tokens = noteContent.trim().split(/\s+/);
           for (let i = 0; i < Math.min(tokens.length, TOTAL_STEPS); i++) {
             if (tokens[i] !== '~' && tokens[i] !== '.') {
               steps[i] = { active: true, note: tokens[i] };
             }
           }
        } else {
           const fixedNote = noteContent;
           if (structMatch) {
             const rawChars = structMatch[1].replace(/\s/g, '').split('');
             for (let i = 0; i < Math.min(rawChars.length, TOTAL_STEPS); i++) {
                if (rawChars[i] !== '.') {
                  steps[i] = { active: true, note: fixedNote };
                }
             }
           }
        }
      } else if (structMatch) {
         const rawChars = structMatch[1].replace(/\s/g, '').split('');
         for (let i = 0; i < Math.min(rawChars.length, TOTAL_STEPS); i++) {
            if (rawChars[i] !== '.') {
              steps[i] = { active: true, note: instDef.defaultNote || 'C3' };
            }
         }
      }

      // Volume
      const gainMatch = line.match(/\.gain\(([\d.-]+)\)/);
      const volume = gainMatch ? parseFloat(gainMatch[1]) : 1;

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
        volume,
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
