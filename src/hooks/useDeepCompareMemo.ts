// src/hooks/useDeepCompareMemo.ts
import { useRef, useMemo } from 'react';
import { Track } from '../lib/constants';

/**
 * Custom hook that memoizes a value using deep comparison
 * Useful for complex objects that need reference stability
 */
export function useDeepCompareMemo<T>(value: T): T {
  const ref = useRef<T>(value);
  const signatureRef = useRef<string>('');
  
  const signature = useMemo(() => {
    try {
      return JSON.stringify(value);
    } catch {
      // Handle circular references or non-serializable values
      return String(value);
    }
  }, [value]);
  
  if (signatureRef.current !== signature) {
    signatureRef.current = signature;
    ref.current = value;
  }
  
  return ref.current;
}

/**
 * Creates a stable signature for track comparison
 */
export function createTracksSignature(tracks: Track[]): string {
  try {
    return JSON.stringify(tracks.map(t => ({
      id: t.id,
      instrument: t.instrument,
      volume: t.volume,
      muted: t.muted,
      pan: t.pan,
      delay: t.delay,
      reverb: t.reverb,
      distortion: t.distortion,
      stepCount: t.stepCount,
      steps: t.steps?.map(s => ({ 
        active: s.active, 
        note: s.note, 
        velocity: s.velocity 
      }))
    })));
  } catch {
    return '';
  }
}