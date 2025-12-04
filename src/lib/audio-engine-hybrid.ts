// src/lib/audio-engine-hybrid.ts
// StrudelJam v3.0 - Hybrid Engine (Fixed)

import * as Tone from 'tone';
import { 
  Track, 
  INSTRUMENTS, 
  InstrumentType,
  POLYPHONY_CONFIG,
  SAFE_MODE_CONFIG,
  DEBUG_CONFIG 
} from './constants';

interface ChannelStrip {
  type: InstrumentType;
  synth: Tone.Synth | Tone.PolySynth | Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth;
  filter: Tone.Filter;
  distortion: Tone.Distortion;
  delay: Tone.FeedbackDelay;
  reverb: Tone.Reverb;
  panner: Tone.Panner;
  volume: Tone.Volume;
  voiceCount: number;
}

interface PartState {
  stepCount: number;
}

export interface AudioStats {
  totalVoices: number;
  activeVoices: number;
  activeParts: number;
  estimatedCpuLoad: number;
  isOverloaded: boolean;
  engine: 'strudel' | 'tone.js' | 'hybrid';
}

class PolyphonyManager {
  private activeVoices: Map<string, number> = new Map();

  getActiveVoices(trackId?: string): number {
    if (trackId) {
      return this.activeVoices.get(trackId) || 0;
    }
    return Array.from(this.activeVoices.values()).reduce((a, b) => a + b, 0);
  }

  incrementVoice(trackId: string): boolean {
    const total = this.getActiveVoices();
    if (total >= POLYPHONY_CONFIG.MAX_TOTAL_VOICES) {
      return false;
    }

    const trackVoices = this.activeVoices.get(trackId) || 0;
    if (trackVoices >= POLYPHONY_CONFIG.MAX_VOICES_PER_TRACK) {
      return false;
    }

    this.activeVoices.set(trackId, trackVoices + 1);
    return true;
  }

  decrementVoice(trackId: string): void {
    const count = this.activeVoices.get(trackId) || 0;
    if (count > 0) {
      this.activeVoices.set(trackId, count - 1);
    }
  }

  reset(): void {
    this.activeVoices.clear();
  }
}

class GainLimiter {
  private gains: Map<string, number> = new Map();
  private maxGain: number = 1.0;

  registerTrack(trackId: string, baseGain: number): void {
    this.gains.set(trackId, baseGain);
    this.recalculateNormalization();
  }

  unregisterTrack(trackId: string): void {
    this.gains.delete(trackId);
    this.recalculateNormalization();
  }

  private recalculateNormalization(): void {
    const totalGain = Array.from(this.gains.values()).reduce((a, b) => a + b, 0);
    this.maxGain = totalGain > 1.0 ? 1.0 / totalGain : 1.0;
  }

  getScaledGain(trackId: string): number {
    const baseGain = this.gains.get(trackId) ?? 0.8;
    return Math.min(1.0, baseGain * this.maxGain * 0.95);
  }

  reset(): void {
    this.gains.clear();
    this.maxGain = 1.0;
  }
}

class HybridAudioEngine {
  private channels: Map<string, ChannelStrip> = new Map();
  private parts: Map<string, Tone.Part> = new Map();
  private partStates: Map<string, PartState> = new Map();
  private currentTracks: Map<string, Track> = new Map();
  private polyphonyManager: PolyphonyManager = new PolyphonyManager();
  private gainLimiter: GainLimiter = new GainLimiter();
  private masterLoop: Tone.Loop | null = null;
  private masterLimiter: Tone.Limiter | null = null;
  private recorder: Tone.Recorder | null = null;
  
  private voiceTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();
  
  private isRunning: boolean = false;
  private isDisposed: boolean = false;
  private isInitialized: boolean = false;
  private lastStatsLog: number = 0;

  constructor() {
    console.log('[HYBRID] Engine created (waiting for user gesture to initialize)');
  }

  /**
   * Initialize audio - MUST be called after user gesture
   */
  private async initializeAudio(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Start Tone.js - this resumes the AudioContext
      await Tone.start();
      console.log('[HYBRID] Tone.js started, AudioContext state:', Tone.context.state);

      // Create master chain
      this.masterLimiter = new Tone.Limiter(-3).toDestination();
      this.recorder = new Tone.Recorder();
      this.masterLimiter.connect(this.recorder);

      this.isInitialized = true;
      console.log('[HYBRID] ✅ Audio initialized successfully');
    } catch (e) {
      console.error('[HYBRID] Audio initialization failed:', e);
      throw e;
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning || this.isDisposed) return;

    try {
      // Initialize audio on first start (requires user gesture)
      if (!this.isInitialized) {
        await this.initializeAudio();
      }

      // Double-check AudioContext state
      if (Tone.context.state === 'suspended') {
        await Tone.context.resume();
        console.log('[HYBRID] AudioContext resumed');
      }

      // Start transport
      if (Tone.Transport.state !== 'started') {
        Tone.Transport.position = 0;
        Tone.Transport.start();
      }

      this.isRunning = true;
      console.log('[HYBRID] ✅ Engine started');

      // Restart existing parts
      this.parts.forEach((part) => {
        if (part.state !== 'started') {
          part.start(0);
        }
      });

      if (this.masterLoop && this.masterLoop.state !== 'started') {
        this.masterLoop.start(0);
      }
    } catch (e) {
      console.error('[HYBRID] Start error:', e);
      throw e;
    }
  }

  public stop(): void {
    if (this.isDisposed) return;
    
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    
    this.parts.forEach(part => {
      try { part.stop(); } catch (e) { /* ignore */ }
    });
    
    this.isRunning = false;
    console.log('[HYBRID] Engine stopped');
  }

  public hardStop(): void {
    if (this.isDisposed) return;
    
    console.log('[HYBRID] HARD STOP');

    this.clearAllVoiceTimeouts();

    this.parts.forEach(part => {
      try {
        part.stop();
        part.dispose();
      } catch (e) { /* ignore */ }
    });
    this.parts.clear();
    this.partStates.clear();

    this.channels.forEach(ch => {
      if (ch.synth instanceof Tone.PolySynth) {
        try { ch.synth.releaseAll(); } catch (e) { /* ignore */ }
      }
    });

    Tone.Transport.stop();
    Tone.Transport.position = 0;

    if (this.masterLoop) {
      try { this.masterLoop.dispose(); } catch (e) { /* ignore */ }
      this.masterLoop = null;
    }

    this.polyphonyManager.reset();
    this.isRunning = false;
  }

  private clearAllVoiceTimeouts(): void {
    this.voiceTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.voiceTimeouts.clear();
  }

  private scheduleVoiceDecrement(trackId: string, delayMs: number): void {
    const timeoutId = setTimeout(() => {
      this.polyphonyManager.decrementVoice(trackId);
      this.voiceTimeouts.delete(timeoutId);
    }, delayMs);
    this.voiceTimeouts.add(timeoutId);
  }

  public setBpm(bpm: number): void {
    if (this.isDisposed) return;
    Tone.Transport.bpm.value = bpm;
  }

  private createSynth(type: InstrumentType): Tone.Synth | Tone.PolySynth | Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth {
    switch (type) {
      case 'kick':
        return new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 6,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 1.2 }
        });
      case 'tom':
        return new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 3,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 1.0 }
        });
      case 'snare':
      case 'rim':
      case 'clap':
        return new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 }
        });
      case 'hat':
      case 'open_hat':
      case 'ride':
      case 'crash':
        return new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.1, release: 0.05 },
          harmonicity: 5.1,
          modulationIndex: 32,
          resonance: 4000,
          octaves: 1.5
        });
      case 'perc':
        return new Tone.MembraneSynth();
      case 'sine':
        return new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sine' },
          envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 }
        });
      case 'triangle':
        return new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 }
        });
      case 'square':
        return new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'square' },
          envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 }
        });
      case 'sawtooth':
        return new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 }
        });
      case 'white':
        return new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 }
        });
      case 'pink':
        return new Tone.NoiseSynth({
          noise: { type: 'pink' },
          envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 }
        });
      case 'brown':
        return new Tone.NoiseSynth({
          noise: { type: 'brown' },
          envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 }
        });
      default:
        return new Tone.Synth();
    }
  }

  private getChannel(trackId: string, type: InstrumentType): ChannelStrip | null {
    if (!this.isInitialized || !this.masterLimiter) {
      return null;
    }

    let channel = this.channels.get(trackId);

    if (channel && channel.type !== type) {
      try { channel.synth.dispose(); } catch (e) { /* ignore */ }
      const newSynth = this.createSynth(type);
      newSynth.connect(channel.filter);
      channel.synth = newSynth;
      channel.type = type;
      return channel;
    }

    if (channel) return channel;

    const synth = this.createSynth(type);
    const filter = new Tone.Filter({
      frequency: SAFE_MODE_CONFIG.FILTER_FREQ,
      type: 'lowpass',
      rolloff: -24
    });

    const distortion = new Tone.Distortion(0);
    const delay = new Tone.FeedbackDelay("8n", 0.3);
    delay.wet.value = 0;

    const reverb = new Tone.Reverb(1.5);
    reverb.wet.value = 0;

    const panner = new Tone.Panner(0);
    const volume = new Tone.Volume(0);

    // Connect chain
    synth.connect(filter);
    filter.connect(distortion);
    distortion.connect(delay);
    delay.connect(reverb);
    reverb.connect(volume);
    volume.connect(panner);
    panner.connect(this.masterLimiter);

    const newChannel: ChannelStrip = {
      type,
      synth,
      filter,
      distortion,
      delay,
      reverb,
      panner,
      volume,
      voiceCount: 0
    };

    this.channels.set(trackId, newChannel);
    this.gainLimiter.registerTrack(trackId, 0.8);

    if (DEBUG_CONFIG.ENABLED) {
      console.log(`[AUDIO] Channel created: ${trackId} (${type})`);
    }

    return newChannel;
  }

  public updateSequence(
    tracks: Track[],
    onStep: (trackId: string, step: number) => void,
    onGlobalStep: (step: number) => void
  ): void {
    if (this.isDisposed) return;

    // Cleanup removed tracks
    const newTrackIds = new Set(tracks.map(t => t.id));
    for (const [id] of this.currentTracks) {
      if (!newTrackIds.has(id)) {
        this.cleanupTrack(id);
      }
    }

    // Update tracks map
    tracks.forEach(t => this.currentTracks.set(t.id, t));

    // Only process if audio is initialized
    if (!this.isInitialized) {
      return;
    }

    // Process each track
    tracks.forEach(track => {
      const ch = this.getChannel(track.id, track.instrument);
      if (!ch) return;

      // Apply effects (real-time)
      const scaledGain = this.gainLimiter.getScaledGain(track.id);
      const volDb = track.volume <= 0.001 ? -100 : 20 * Math.log10(track.volume * scaledGain);
      ch.volume.volume.rampTo(volDb, 0.05);

      ch.panner.pan.rampTo(track.pan, 0.05);
      ch.distortion.distortion = Math.min(0.8, 0.4 + (track.distortion / 200));
      ch.distortion.wet.value = Math.min(0.8, track.distortion / 100);
      ch.delay.wet.value = Math.min(0.6, track.delay / 100);
      ch.reverb.wet.value = Math.min(0.5, track.reverb / 100);

      // Sequencer management
      const stepCount = Math.max(1, Math.min(32, track.stepCount || 16));
      const existingPart = this.parts.get(track.id);
      const prevState = this.partStates.get(track.id);

      const needsRecreate = !existingPart || !prevState || prevState.stepCount !== stepCount;

      if (existingPart) {
        existingPart.mute = track.muted;
      }

      if (needsRecreate) {
        // Dispose old part
        if (existingPart) {
          try {
            existingPart.stop();
            existingPart.dispose();
          } catch (e) { /* ignore */ }
          this.parts.delete(track.id);
        }

        if (this.parts.size >= POLYPHONY_CONFIG.MAX_ACTIVE_PARTS) {
          return;
        }

        const PPQ = Tone.Transport.PPQ;
        const ticksPerMeasure = PPQ * 4;
        const ticksPerStep = ticksPerMeasure / stepCount;

        const events = Array.from({ length: stepCount }, (_, i) => ({
          time: Math.round(i * ticksPerStep) + "i",
          stepIdx: i
        }));

        const trackId = track.id;

        const part = new Tone.Part((time, event) => {
          if (this.isDisposed) return;
          
          const currentTrack = this.currentTracks.get(trackId);
          if (!currentTrack || currentTrack.muted) return;

          // Visual callback
          Tone.Draw.schedule(() => {
            onStep(trackId, event.stepIdx);
          }, time);

          const step = currentTrack.steps[event.stepIdx];
          if (step && step.active) {
            const instDef = INSTRUMENTS.find(i => i.id === currentTrack.instrument);
            const channel = this.channels.get(trackId);

            if (channel && instDef) {
              if (!this.polyphonyManager.incrementVoice(trackId)) {
                return;
              }

              const noteToPlay = step.note || instDef.defaultNote || 'C2';
              const velocity = (step.velocity ?? 100) / 100;
              const duration = (ticksPerStep / 2) + "i";

              try {
                const synth = channel.synth;
                
                if (synth instanceof Tone.MembraneSynth) {
                  synth.triggerAttackRelease(noteToPlay, '8n', time, velocity);
                } else if (synth instanceof Tone.NoiseSynth) {
                  synth.triggerAttackRelease('8n', time, velocity);
                } else if (synth instanceof Tone.MetalSynth) {
                  const dur = (instDef.id.includes('hat') || instDef.id === 'ride') ? '32n' : '16n';
                  synth.triggerAttackRelease(noteToPlay, dur, time, velocity);
                } else if (synth instanceof Tone.PolySynth) {
                  synth.triggerAttackRelease(noteToPlay, duration, time, velocity);
                } else if (synth instanceof Tone.Synth) {
                  synth.triggerAttackRelease(noteToPlay, '8n', time, velocity);
                }

                // Schedule voice cleanup
                const actualDuration = Tone.Time(duration).toSeconds();
                this.scheduleVoiceDecrement(trackId, actualDuration * 1000 + 100);
              } catch (e) {
                console.error(`[AUDIO] Trigger error:`, e);
                this.polyphonyManager.decrementVoice(trackId);
              }
            }
          }
        }, events);

        part.loop = true;
        part.loopEnd = "1m";
        part.mute = track.muted;

        // Start the part
        if (this.isRunning && Tone.Transport.state === 'started') {
          part.start(0);
        } else {
          part.start(0);
        }

        this.parts.set(track.id, part);
        this.partStates.set(track.id, { stepCount });
      }
    });

    // Master loop for global step
    if (!this.masterLoop && this.isInitialized) {
      let globalStep = 0;
      this.masterLoop = new Tone.Loop((time) => {
        if (this.isDisposed) return;
        
        Tone.Draw.schedule(() => {
          onGlobalStep(globalStep);
          globalStep = (globalStep + 1) % 16;
        }, time);
      }, "16n");
      
      if (this.isRunning) {
        this.masterLoop.start(0);
      }
    }

    this.logStatsIfNeeded();
  }

    private logStatsIfNeeded(): void {
    if (!DEBUG_CONFIG.ENABLED) return;

    const now = Date.now();
    if (now - this.lastStatsLog >= DEBUG_CONFIG.LOG_INTERVAL_MS) {
      const stats = this.getAudioStats();
      console.log(
        `[HYBRID STATS] Engine: ${stats.engine} | Voices: ${stats.activeVoices}/${POLYPHONY_CONFIG.MAX_TOTAL_VOICES} | Parts: ${stats.activeParts} | CPU: ~${stats.estimatedCpuLoad.toFixed(1)}%`
      );
      this.lastStatsLog = now;
    }
  }

  public getAudioStats(): AudioStats {
    const totalVoices = this.polyphonyManager.getActiveVoices();
    const activeParts = this.parts.size;
    const estimatedCpuLoad = (totalVoices / POLYPHONY_CONFIG.MAX_TOTAL_VOICES) * 100;
    const isOverloaded = totalVoices >= POLYPHONY_CONFIG.VOICE_CLEANUP_THRESHOLD;

    return {
      totalVoices,
      activeVoices: totalVoices,
      activeParts,
      estimatedCpuLoad,
      isOverloaded,
      engine: 'tone.js'
    };
  }

  public cleanupTrack(trackId: string): void {
    if (this.isDisposed) return;
    
    try {
      const ch = this.channels.get(trackId);
      if (ch) {
        if (ch.synth instanceof Tone.PolySynth) {
          try { ch.synth.releaseAll(); } catch (e) { /* ignore */ }
        }

        try { ch.synth.dispose(); } catch (e) { /* ignore */ }
        try { ch.filter.dispose(); } catch (e) { /* ignore */ }
        try { ch.distortion.dispose(); } catch (e) { /* ignore */ }
        try { ch.delay.dispose(); } catch (e) { /* ignore */ }
        try { ch.reverb.dispose(); } catch (e) { /* ignore */ }
        try { ch.panner.dispose(); } catch (e) { /* ignore */ }
        try { ch.volume.dispose(); } catch (e) { /* ignore */ }

        this.channels.delete(trackId);
      }

      const part = this.parts.get(trackId);
      if (part) {
        try {
          part.stop();
          part.dispose();
        } catch (e) { /* ignore */ }
        this.parts.delete(trackId);
      }

      this.partStates.delete(trackId);
      this.currentTracks.delete(trackId);
      this.gainLimiter.unregisterTrack(trackId);

      if (DEBUG_CONFIG.ENABLED) {
        console.log(`[AUDIO] Track ${trackId} cleaned up`);
      }
    } catch (e) {
      console.error(`[AUDIO] Cleanup error for ${trackId}:`, e);
    }
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    
    console.log('[HYBRID] Disposing engine');

    this.clearAllVoiceTimeouts();
    this.hardStop();

    // Cleanup all tracks
    for (const trackId of this.channels.keys()) {
      this.cleanupTrack(trackId);
    }

    if (this.masterLimiter) {
      try { this.masterLimiter.dispose(); } catch (e) { /* ignore */ }
    }
    
    if (this.recorder) {
      try { this.recorder.dispose(); } catch (e) { /* ignore */ }
    }

    this.channels.clear();
    this.parts.clear();
    this.partStates.clear();
    this.currentTracks.clear();
  }

  public async startRecording(): Promise<void> {
    if (this.isDisposed || !this.recorder) return;
    
    if (!this.isInitialized) {
      await this.initializeAudio();
    }

    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
    
    this.recorder.start();
    console.log('[HYBRID] Recording started');
  }

  public async stopRecording(): Promise<string> {
    if (this.isDisposed || !this.recorder) return '';
    
    const blob = await this.recorder.stop();
    const url = URL.createObjectURL(blob);
    console.log('[HYBRID] Recording stopped');
    return url;
  }

  public isEngineRunning(): boolean {
    return this.isRunning;
  }

  public isEngineInitialized(): boolean {
    return this.isInitialized;
  }
}

export const audioEngine = new HybridAudioEngine();