import { Track, INSTRUMENTS, TOTAL_STEPS, Step } from './constants';

/**
 * Generates lightweight Strudel code that prevents:
 * - Nested stacks (exponential voice growth)
 * - Complex polyphonic patterns
 * - Excessive effects chains
 */
export const generateStrudelCode = (tracks: Track[], bpm: number): string => {
  if (tracks.length === 0) return '// Aggiungi una traccia per iniziare\n';

  // Filter and limit tracks to prevent overload
  const MAX_TRACKS = 16; // Hard limit
  const trackLines = tracks
    .slice(0, MAX_TRACKS)
    .map(track => {
      if (track.muted) return null;
      
      const instDef = INSTRUMENTS.find(i => i.id === track.instrument);
      if (!instDef) return null;

      const stepCount = Math.max(1, Math.min(32, track.stepCount || 16));
      const activeSteps = track.steps.slice(0, stepCount).filter(s => s.active);
      
      if (activeSteps.length === 0) return null;

      const firstNote = activeSteps[0]?.note;
      const allSameNote = activeSteps.every(s => s.note === firstNote);
      
      // Check if all velocities are 100
      const allFullVelocity = activeSteps.every(s => (s.velocity ?? 100) === 100);

      let line = `  s("${instDef.strudelName}")`;

      // Note & Struct - LIGHTWEIGHT PATTERN (no nested structures)
      const patternChars = track.steps.slice(0, stepCount).map(s => s.active ? 'x' : '.');
      const patternString = patternChars.join('');

      if (allSameNote && firstNote) {
        // Simple pattern: single note with struct
        line += `.note("${firstNote}")`;
        line += `.struct("${patternString}")`;
      } else if (activeSteps.length <= stepCount / 2) {
        // For sparse melodic patterns, use note pattern
        const notePattern = track.steps.slice(0, stepCount).map(s => s.active ? s.note : '~').join(' ');
        line += `.note("${notePattern}")`;
      } else {
        // Fall back to single note if too many variations
        line += `.note("${firstNote || instDef.defaultNote || 'C4'}")`;
        line += `.struct("${patternString}")`;
      }
      
      // Gain / Velocity - CLAMPED to prevent distortion
      const trackVol = Math.min(1.0, track.volume); // Never exceed 1.0
      
      if (allFullVelocity) {
        if (trackVol < 1.0) {
          line += `.gain(${trackVol.toFixed(2)})`;
        }
      } else {
        // Generate gain pattern with normalization
        const gainPattern = track.steps.slice(0, stepCount).map(s => {
          if (!s.active) return '~';
          const vel = Math.min(1.0, (s.velocity ?? 100) / 100);
          const finalGain = Math.min(1.0, vel * trackVol * 0.95); // 0.95 for headroom
          return finalGain === 1.0 ? 1 : parseFloat(finalGain.toFixed(2));
        }).join(' ');
        line += `.gain("${gainPattern}")`;
      }

      // Pan - KEEP SUBTLE
      if (Math.abs(track.pan) > 0.1) {
        line += `.pan(${Math.max(-0.9, Math.min(0.9, track.pan))})`;
      }

      // Effects - REDUCE to prevent feedback loops and CPU load
      // Only apply if value is significant
      if (track.delay > 10) {
        const delayAmount = Math.min(0.5, track.delay / 200); // Reduced max
        line += `.delay(${delayAmount.toFixed(2)})`;
      }
      if (track.reverb > 10) {
        const reverbAmount = Math.min(0.4, track.reverb / 250); // Reduced max
        line += `.reverb(${reverbAmount.toFixed(2)})`;
      }
      if (track.distortion > 15) {
        const distAmount = Math.min(0.5, track.distortion / 200); // Reduced max
        line += `.distortion(${distAmount.toFixed(2)})`;
      }

      return line;
    })
    .filter(Boolean);

  if (trackLines.length === 0) return `// Tutte le tracce sono mute o vuote\nsetcps(${bpm/60/4})`;

  // Generate lightweight code WITHOUT nested stacks
  return `// Strudel Code - Lightweight Mode (Performance Optimized)
setcps(${(bpm / 60 / 4).toFixed(4)}); // ${bpm} BPM

stack(
${trackLines.join(',\n')}
).out();
`;
};

/**
 * Parse Strudel code with safety constraints:
 * - Max 16 tracks (prevents exponential growth)
 * - Clamped effects values
 * - No nested structures
 * - Normalized gain to prevent clipping
 */
export const parseStrudelCode = (code: string): Partial<Track>[] | null => {
  try {
    const lines = code.split('\n');
    const parsedTracks: Partial<Track>[] = [];
    const MAX_PARSED_TRACKS = 16;

    for (const line of lines) {
      if (parsedTracks.length >= MAX_PARSED_TRACKS) break;

      const sMatch = line.match(/s\("([^"]+)"\)/);
      if (!sMatch) continue;

      const strudelName = sMatch[1];
      const instDef = INSTRUMENTS.find(i => i.strudelName === strudelName);
      if (!instDef) continue;

      // Default initialization
      let stepCount = 16;
      const steps: Step[] = Array(32).fill(null).map(() => ({
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
          // Pattern like "C3 ~ D3 ~"
          const tokens = noteContent.trim().split(/\s+/).slice(0, 32); // Limit tokens
          stepCount = Math.max(1, Math.min(32, tokens.length));
           
          for (let i = 0; i < stepCount; i++) {
            if (tokens[i] && tokens[i] !== '~' && tokens[i] !== '.') {
              steps[i] = { active: true, note: tokens[i], velocity: 100 };
            }
          }
        } else {
          // Single note applied to a struct
          const fixedNote = noteContent;
          if (structMatch) {
            const cleanStruct = structMatch[1].replace(/\s/g, '').slice(0, 32);
            stepCount = Math.max(1, Math.min(32, cleanStruct.length));
             
            for (let i = 0; i < stepCount; i++) {
              if (cleanStruct[i] !== '.') {
                steps[i] = { active: true, note: fixedNote, velocity: 100 };
              }
            }
          }
        }
      } else if (structMatch) {
        const cleanStruct = structMatch[1].replace(/\s/g, '').slice(0, 32);
        stepCount = Math.max(1, Math.min(32, cleanStruct.length));
        for (let i = 0; i < stepCount; i++) {
          if (cleanStruct[i] !== '.') {
            steps[i] = { active: true, note: instDef.defaultNote || 'C3', velocity: 100 };
          }
        }
      }

      // Volume & Velocity Parsing with clamping
      const gainPatternMatch = line.match(/\.gain\("([^"]+)"\)/);
      const gainSingleMatch = line.match(/\.gain\(([\d.-]+)\)/);
      
      let trackVolume = 1.0;

      if (gainPatternMatch) {
        const tokens = gainPatternMatch[1].trim().split(/\s+/);
        if (tokens.length === stepCount) {
          for (let i = 0; i < stepCount; i++) {
            if (tokens[i] !== '~' && steps[i].active) {
              const gainVal = Math.max(0, Math.min(1.0, parseFloat(tokens[i])));
              steps[i].velocity = Math.max(1, Math.min(100, Math.round(gainVal * 100)));
            }
          }
        }
      } else if (gainSingleMatch) {
        trackVolume = Math.max(0, Math.min(1.0, parseFloat(gainSingleMatch[1])));
      }

      // Pan - Clamped to [-1, 1]
      const panMatch = line.match(/\.pan\(([\d.-]+)\)/);
      const pan = panMatch ? Math.max(-1, Math.min(1, parseFloat(panMatch[1]))) : 0;

      // Effects - All clamped and reduced
      const delayMatch = line.match(/\.delay\(([\d.]+)\)/);
      const delay = delayMatch ? Math.max(0, Math.min(100, parseFloat(delayMatch[1]) * 100)) : 0;

      const reverbMatch = line.match(/\.reverb\(([\d.]+)\)/);
      const reverb = reverbMatch ? Math.max(0, Math.min(100, parseFloat(reverbMatch[1]) * 100)) : 0;

      const distMatch = line.match(/\.distortion\(([\d.]+)\)/);
      const distortion = distMatch ? Math.max(0, Math.min(100, parseFloat(distMatch[1]) * 100)) : 0;

      parsedTracks.push({
        id: Math.random().toString(36).substr(2, 9),
        instrument: instDef.id,
        steps: steps.slice(0, 32),
        stepCount: stepCount,
        volume: trackVolume,
        muted: false,
        pan,
        delay,
        reverb,
        distortion
      });
    }

    return parsedTracks.length > 0 ? parsedTracks : null;
  } catch (e) {
    console.error("[PARSE] Failed to parse Strudel code:", e);
    return null;
  }
};
