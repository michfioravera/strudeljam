// src/hooks/useAudioEngine.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { audioEngine } from '../lib/audio-engine';
import { Track } from '../lib/constants';
import * as Tone from 'tone';

interface UseAudioEngineReturn {
  isPlaying: boolean;
  isRecording: boolean;
  play: () => Promise<void>;
  stop: () => void;
  togglePlay: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
  setBpm: (bpm: number) => void;
  updateSequence: (
    tracks: Track[],
    onStep: (trackId: string, step: number) => void,
    onGlobalStep: (step: number) => void
  ) => void;
  cleanupTrack: (trackId: string) => void;
  getStats: () => ReturnType<typeof audioEngine.getAudioStats>;
}

export function useAudioEngine(): UseAudioEngineReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      audioEngine.dispose();
    };
  }, []);

  const play = useCallback(async () => {
    try {
      // Resume audio context if suspended
      const audioContext = (Tone.Destination as any)?.context;
      if (audioContext && audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      await audioEngine.start();
      if (mountedRef.current) {
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('[useAudioEngine] Play error:', error);
    }
  }, []);

  const stop = useCallback(() => {
    audioEngine.stop();
    if (mountedRef.current) {
      setIsPlaying(false);
    }
  }, []);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      stop();
    } else {
      await play();
    }
  }, [isPlaying, play, stop]);

  const startRecording = useCallback(async () => {
    await audioEngine.startRecording();
    if (mountedRef.current) {
      setIsRecording(true);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const url = await audioEngine.stopRecording();
    if (mountedRef.current) {
      setIsRecording(false);
    }
    return url;
  }, []);

  const setBpm = useCallback((bpm: number) => {
    audioEngine.setBpm(bpm);
  }, []);

  const updateSequence = useCallback((
    tracks: Track[],
    onStep: (trackId: string, step: number) => void,
    onGlobalStep: (step: number) => void
  ) => {
    audioEngine.updateSequence(tracks, onStep, onGlobalStep);
  }, []);

  const cleanupTrack = useCallback((trackId: string) => {
    audioEngine.cleanupTrack(trackId);
  }, []);

  const getStats = useCallback(() => {
    return audioEngine.getAudioStats();
  }, []);

  return {
    isPlaying,
    isRecording,
    play,
    stop,
    togglePlay,
    startRecording,
    stopRecording,
    setBpm,
    updateSequence,
    cleanupTrack,
    getStats,
  };
}