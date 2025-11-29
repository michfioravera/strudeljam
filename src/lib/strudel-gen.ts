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

    // Basic volume mapping
    const gain = track.volume.toFixed(2);
    let line = `  s("${instDef.strudelName}")`;

    if (allSameNote && firstNote) {
      // Use the concise struct format if notes are uniform, as per user preference
      const pattern = track.steps.map(s => s.active ? 'x' : '.').join('');
      // Group by 4 for readability in struct string "x...x..."
      const formattedPattern = pattern.match(/.{1,4}/g)?.join('.') || pattern;
      
      line += `.note("${firstNote}")`;
      line += `.struct("${formattedPattern}")`;
    } else {
      // Use note pattern for varying notes: note("C3 ~ D3 ~")
      const notePattern = track.steps.map(s => s.active ? s.note : '~').join(' ');
      line += `.note("${notePattern}")`;
    }
    
    if (track.volume < 1) {
      line += `.gain(${gain})`;
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

      // Check for .note("...")
      const noteMatch = line.match(/\.note\("([^"]+)"\)/);
      const structMatch = line.match(/\.struct\("([^"]+)"\)/);
      
      if (noteMatch) {
        const noteContent = noteMatch[1];
        
        // Case 1: note("C3 ~ D3 ~") - Pattern Mode
        if (noteContent.includes('~') || noteContent.includes(' ')) {
           const tokens = noteContent.trim().split(/\s+/);
           // Map tokens to steps. 
           // Note: This is a simplified parser assuming 16 tokens or repeating
           for (let i = 0; i < Math.min(tokens.length, TOTAL_STEPS); i++) {
             if (tokens[i] !== '~' && tokens[i] !== '.') {
               steps[i] = { active: true, note: tokens[i] };
             }
           }
        } 
        // Case 2: note("C3") - Single Note Mode (likely paired with struct)
        else {
           const fixedNote = noteContent;
           if (structMatch) {
             const structPattern = structMatch[1].replace(/[.\s]/g, (c) => c === '.' ? '.' : ''); // keep x and .
             // Expand struct "x..x" -> boolean
             // We need to handle the dots correctly. struct("x.x.")
             // Simplest approach: remove dots that are separators if any, but Strudel uses . as rest in mini notation inside quotes usually? 
             // Actually struct("x..x") usually means x . . x
             const rawChars = structMatch[1].replace(/\s/g, '').split('');
             
             for (let i = 0; i < Math.min(rawChars.length, TOTAL_STEPS); i++) {
                if (rawChars[i] !== '.') {
                  steps[i] = { active: true, note: fixedNote };
                }
             }
           }
        }
      } else if (structMatch) {
         // Struct without note (use default)
         const rawChars = structMatch[1].replace(/\s/g, '').split('');
         for (let i = 0; i < Math.min(rawChars.length, TOTAL_STEPS); i++) {
            if (rawChars[i] !== '.') {
              steps[i] = { active: true, note: instDef.defaultNote || 'C3' };
            }
         }
      }

      // Volume
      const gainMatch = line.match(/\.gain\(([\d.]+)\)/);
      const volume = gainMatch ? parseFloat(gainMatch[1]) : 1;

      parsedTracks.push({
        id: Math.random().toString(36).substr(2, 9),
        instrument: instDef.id,
        steps,
        volume,
        muted: false
      });
    });

    return parsedTracks.length > 0 ? parsedTracks : null;
  } catch (e) {
    console.error("Failed to parse code", e);
    return null;
  }
};
