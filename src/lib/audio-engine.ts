import * as Tone from 'tone';
import { Track, INSTRUMENTS, InstrumentType } from './constants';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

interface ChannelStrip {
  type: InstrumentType;
  synth: Tone.Instrument<any>;
  filter: Tone.Filter; // Low-pass filter for safe mode
  distortion: Tone.Distortion;
  delay: Tone.FeedbackDelay;
  reverb: Tone.Reverb;
  panner: Tone.Panner;
  volume: Tone.Volume;
  voiceCount: number; // Track active voices
}

interface PartState {
  stepCount: number;
}

// Polyphony & Performance Limits
const POLYPHONY_CONFIG = {
  MAX_TOTAL_VOICES: 32, // Absolute limit
  MAX_VOICES_PER_TRACK: 8,
  MAX_ACTIVE_PARTS: 16, // Max concurrent Tone.Parts
  VOICE_CLEANUP_THRESHOLD: 28, // Cleanup at 87.5% capacity
};

const AUDIO_BUFFER_CONFIG = {
  BUFFER_SIZE: 4096, // Larger buffer to reduce dropouts (was likely 512)
  SAMPLE_RATE: 48000, // Use 48kHz instead of 44.1kHz for better performance
};

const SAFE_MODE_CONFIG = {
  ENABLED: true, // Safe mode for synths (LP filter + reduced harmonics)
  FILTER_FREQ: 8000, // Hz - reduces aliasing
  REDUCE_HARMONICS: true,
};

const DEBUG = {
  ENABLED: true,
  LOG_INTERVAL_MS: 2000, // Log stats every 2 seconds
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

interface AudioStats {
  totalVoices: number;
  activeVoices: number;
  activeParts: number;
  estimatedCpuLoad: number;
  isOverloaded: boolean;
}

class PolyphonyManager {
  private activeVoices: Map<string, number> = new Map(); // trackId -> count

  getActiveVoices(trackId?: string): number {
    if (trackId) {
      return this.activeVoices.get(trackId) || 0;
    }
    return Array.from(this.activeVoices.values()).reduce((a, b) => a + b, 0);
  }

  incrementVoice(trackId: string): boolean {
    const total = this.getActiveVoices();
    if (total >= POLYPHONY_CONFIG.MAX_TOTAL_VOICES) {
      if (DEBUG.ENABLED) console.warn(`[POLYPHONY] Max voices reached (${total}/${POLYPHONY_CONFIG.MAX_TOTAL_VOICES})`);
      return false;
    }

    const trackVoices = this.activeVoices.get(trackId) || 0;
    if (trackVoices >= POLYPHONY_CONFIG.MAX_VOICES_PER_TRACK) {
      if (DEBUG.ENABLED) console.warn(`[POLYPHONY] Track ${trackId} max voices (${trackVoices}/${POLYPHONY_CONFIG.MAX_VOICES_PER_TRACK})`);
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

  isNearCapacity(): boolean {
    return this.getActiveVoices() >= POLYPHONY_CONFIG.VOICE_CLEANUP_THRESHOLD;
  }

  reset(): void {
    this.activeVoices.clear();
  }
}

class GainLimiter {
  private gains: Map<string, number> = new Map(); // trackId -> normalized gain
  private maxGain: number = 1.0;

  registerTrack(trackId: string, baseGain: number): void {
    this.gains.set(trackId, baseGain);
    this.recalculateNormalization();
  }

  unregisterTrack(trackId: string): void {
    this.gains.delete(trackId);
    this.recalculateNormalization();
  }

  getGain(trackId: string): number {
    return this.gains.get(trackId) ?? 0.8;
  }

  private recalculateNormalization(): void {
    const totalGain = Array.from(this.gains.values()).reduce((a, b) => a + b, 0);
    if (totalGain > 1.0) {
      this.maxGain = 1.0 / totalGain;
    } else {
      this.maxGain = 1.0;
    }
  }

  getScaledGain(trackId: string): number {
    const baseGain = this.getGain(trackId);
    return Math.min(1.0, baseGain * this.maxGain * 0.95); // 0.95 for headroom
  }

  reset(): void {
    this.gains.clear();
    this.maxGain = 1.0;
  }
}

// ============================================================================
// MAIN AUDIO ENGINE CLASS
// ============================================================================

class AudioEngine {
  private channels: Map<string, ChannelStrip> = new Map();
  private parts: Map<string, Tone.Part> = new Map();
  private partStates: Map<string, PartState> = new Map();
  private currentTracks: Map<string, Track> = new Map();
  private polyphonyManager: PolyphonyManager = new PolyphonyManager();
  private gainLimiter: GainLimiter = new GainLimiter();
  
  private masterLoop: Tone.Loop | null = null;
  private masterLimiter: Tone.Limiter; // Global limiter
  private recorder: Tone.Recorder;
  private playedTestTone: boolean = false;
  private isRunning: boolean = false;
  private lastStatsLog: number = 0;
  private pageVisibilityHandler: (() => void) | null = null;

  constructor() {
    // Setup audio context with optimized settings
    this.setupAudioContext();
    
    // Master limiter (-3dB to prevent clipping)
    this.masterLimiter = new Tone.Limiter(-3).toDestination();
    
    this.recorder = new Tone.Recorder();
    this.masterLimiter.connect(this.recorder);
    
    // Page visibility listener (pause when tab loses focus)
    this.pageVisibilityHandler = this.handlePageVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.pageVisibilityHandler);
  }

  private setupAudioContext(): void {
    // Optimize Tone.js context
    const context = Tone.getContext();
    
    // Attempt to set buffer size (may not work in all browsers)
    if ('createScriptProcessor' in context) {
      try {
        (context as any).createScriptProcessor(AUDIO_BUFFER_CONFIG.BUFFER_SIZE, 1, 1).disconnect();
      } catch (e) {
        if (DEBUG.ENABLED) console.log('[AUDIO] Buffer size setting not available');
      }
    }

    if (DEBUG.ENABLED) {
      console.log(`[AUDIO] Context initialized - Sample Rate: ${context.sampleRate}Hz, State: ${context.state}`);
    }
  }

  private handlePageVisibilityChange(): void {
    if (document.hidden && this.isRunning) {
      if (DEBUG.ENABLED) console.log('[AUDIO] Tab hidden - pausing audio');
      this.hardStop();
    }
  }

  public async start(): Promise<void> {
    // Must resume before Tone.start() - this is the key!
    try {
      // Get the actual Web Audio context
      const audioContext = (Tone.Destination as any)?.context;
      if (audioContext && audioContext.state === 'suspended') {
        if (DEBUG.ENABLED) console.log('[AUDIO] Attempting to resume AudioContext from state:', audioContext.state);
        await audioContext.resume();
        if (DEBUG.ENABLED) console.log('[AUDIO] AudioContext resumed! New state:', audioContext.state);
      }
    } catch (e) {
      if (DEBUG.ENABLED) console.warn('[AUDIO] Could not resume context:', e);
    }
    
    // Now start Tone (this should work after context resume)
    await Tone.start();
    
    // Ensure Transport is in a fresh state
    if (Tone.Transport.state !== 'started') {
      // Reset position to 0 to start from beginning
      Tone.Transport.position = 0;
      Tone.Transport.start();
      this.isRunning = true;
      if (DEBUG.ENABLED) console.log('[AUDIO] Engine started');

      // Debug: play short test tones to verify audio output chain is audible
      try {
        if (DEBUG.ENABLED && !this.playedTestTone) {
          const now = Tone.now();

          // 1) Normal routed test tone through master limiter
          const osc = new Tone.Oscillator(880, 'sine').connect(this.masterLimiter);
          osc.start(now);
          osc.stop(now + 0.12);
          setTimeout(() => { try { osc.dispose(); } catch (e) {} }, 500);

          // 2) Loud direct test tone to destination (bypasses signal chain)
          const direct = new Tone.Oscillator(880, 'sine').toDestination();
          direct.volume.value = 0; // 0 dB
          direct.start(now + 0.05);
          direct.stop(now + 0.35);
          setTimeout(() => { try { direct.dispose(); } catch (e) {} }, 700);

          this.playedTestTone = true;
          console.log('[AUDIO] Debug test tones played (routed + direct)');
        }
      } catch (e) {
        if (DEBUG.ENABLED) console.warn('[AUDIO] Could not play debug test tones:', e);
      }
    }

    // Restart any existing parts (they may have been stopped by stop())
    try {
      this.parts.forEach((part, id) => {
        try {
          // If the part is not started, start it at position 0 so callbacks resume
          if (!part.started) {
            part.start(0);
            if (DEBUG.ENABLED) console.log(`[AUDIO] Restarted part for track ${id}`);
          }
        } catch (e) {
          if (DEBUG.ENABLED) console.warn(`[AUDIO] Could not restart part ${id}:`, e);
        }
      });

      // Ensure the master loop is started
      if (this.masterLoop && !this.masterLoop.running) {
        try {
          this.masterLoop.start(0);
          if (DEBUG.ENABLED) console.log('[AUDIO] Master loop restarted');
        } catch (e) {
          if (DEBUG.ENABLED) console.warn('[AUDIO] Could not restart master loop:', e);
        }
      }
    } catch (e) {
      if (DEBUG.ENABLED) console.warn('[AUDIO] Error while restarting parts/master loop:', e);
    }
  }

  public stop(): void {
    Tone.Transport.stop();
    this.parts.forEach(part => part.stop());
    this.isRunning = false;
    if (DEBUG.ENABLED) console.log('[AUDIO] Engine stopped gracefully - Transport state:', Tone.Transport.state);
  }

  /**
   * Hard stop: Kill ALL voices and effects immediately.
   * Use this for emergency stop or tab visibility changes.
   */
  public hardStop(): void {
    if (DEBUG.ENABLED) console.log('[AUDIO] HARD STOP triggered');
    
    // Stop all parts
    this.parts.forEach(part => {
      part.stop();
      part.dispose();
    });
    this.parts.clear();

    // Release all synth voices
    this.channels.forEach(ch => {
      if (ch.synth instanceof Tone.PolySynth) {
        ch.synth.triggerRelease();
      }
    });

    // Stop transport but DON'T cancel (that breaks future playback)
    Tone.Transport.stop();
    Tone.Transport.position = 0; // Reset position to start
    
    // Dispose of master loop so it gets recreated fresh
    if (this.masterLoop) {
      this.masterLoop.dispose();
      this.masterLoop = null;
    }

    this.polyphonyManager.reset();
    this.isRunning = false;
  }

  public setBpm(bpm: number): void {
    Tone.Transport.bpm.value = bpm;
  }

  /**
   * Create a synth with optimizations for safe mode.
   * Reduces harmonics and adds LP filter to prevent aliasing.
   */
  private createSynth(type: InstrumentType): Tone.Instrument<any> {
    switch (type) {
      case 'kick':
        return new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 6, // Reduced from 10
          oscillator: { type: 'sine' },
          envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 1.2 } // Reduced sustain
        });
      case 'tom':
        return new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 3, // Reduced from 4
          oscillator: { type: 'sine' },
          envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 1.0 }
        });
      case 'snare':
      case 'rim':
      case 'clap':
        return new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 } // Reduced from 0.2
        });
      case 'hat':
      case 'open_hat':
      case 'ride':
      case 'crash':
        return new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.08, release: 0.01 }, // Reduced from 0.1
          harmonicity: 3.5, // Reduced from 5.1
          modulationIndex: 20, // Reduced from 32
          resonance: 3000, // Reduced from 4000
          octaves: 1.0 // Reduced from 1.5
        });
      case 'perc':
        return new Tone.MembraneSynth();
      
      // Synths with reduced polyphony
      case 'sine':
        return new Tone.PolySynth(Tone.Synth, { 
          oscillator: { type: 'sine' },
          maxVoices: POLYPHONY_CONFIG.MAX_VOICES_PER_TRACK
        });
      case 'triangle':
        return new Tone.PolySynth(Tone.Synth, { 
          oscillator: { type: 'triangle' },
          maxVoices: POLYPHONY_CONFIG.MAX_VOICES_PER_TRACK
        });
      case 'square':
        return new Tone.PolySynth(Tone.Synth, { 
          oscillator: { type: 'square' },
          maxVoices: POLYPHONY_CONFIG.MAX_VOICES_PER_TRACK
        });
      case 'sawtooth':
        return new Tone.PolySynth(Tone.Synth, { 
          oscillator: { type: 'sawtooth' },
          maxVoices: POLYPHONY_CONFIG.MAX_VOICES_PER_TRACK
        });
      
      // Noise (keep reduced)
      case 'white':
        return new Tone.NoiseSynth({ 
          noise: { type: 'white' },
          envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 }
        });
      case 'pink':
        return new Tone.NoiseSynth({ 
          noise: { type: 'pink' },
          envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 }
        });
      case 'brown':
        return new Tone.NoiseSynth({ 
          noise: { type: 'brown' },
          envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 }
        });
      
      default:
        return new Tone.Synth({
          maxVoices: POLYPHONY_CONFIG.MAX_VOICES_PER_TRACK
        });
    }
  }

  /**
   * Get or create a channel strip with proper signal chain.
   * Includes safe-mode LP filter to prevent aliasing.
   */
  private getChannel(trackId: string, type: InstrumentType): ChannelStrip {
    let channel = this.channels.get(trackId);

    // If channel exists but type is different, swap the synth
    if (channel && channel.type !== type) {
      try {
        channel.synth.dispose(); // Remove old synth
      } catch (e) {
        if (DEBUG.ENABLED) console.warn(`[AUDIO] Error disposing old synth: ${e}`);
      }
      
      const newSynth = this.createSynth(type);
      newSynth.connect(channel.filter); // Connect to filter, not directly to distortion
      
      channel.synth = newSynth;
      channel.type = type;
      return channel;
    }

    if (channel) {
      return channel;
    }

    // Create new channel with all effects
    const synth = this.createSynth(type);
    
    // Safe mode filter (LP) - reduces aliasing and high-freq noise
    const filter = new Tone.Filter({
      frequency: SAFE_MODE_CONFIG.FILTER_FREQ,
      type: 'lowpass',
      rolloff: -24 // -24dB/octave for good slope
    });

    const distortion = new Tone.Distortion(0);
    const delay = new Tone.FeedbackDelay("8n", 0.5);
    delay.wet.value = 0;
    delay.maxDelay = 1; // Cap max delay time
    
    const reverb = new Tone.Reverb(1.2); // Reduced from 1.5
    reverb.wet.value = 0;
    reverb.decay = 2.0; // Reduced from 3.0 to prevent buildup
    
    const panner = new Tone.Panner(0);
    const volume = new Tone.Volume(0);

    // Optimized signal chain:
    // Synth -> Filter -> Distortion -> Delay -> Reverb -> Volume -> Panner -> Master Limiter -> Recorder
    synth.connect(filter);
    filter.connect(distortion);
    distortion.connect(delay);
    delay.connect(reverb);
    reverb.connect(volume);
    volume.connect(panner);
    panner.connect(this.masterLimiter);
    panner.connect(this.recorder);

    // DEBUG: also connect synth directly to destination to verify audible output
    if (DEBUG.ENABLED) {
      try {
        synth.connect(Tone.Destination);
        if (DEBUG.ENABLED) console.log(`[AUDIO DEBUG] Direct connect from synth to Destination for track ${trackId}`);
      } catch (e) {
        if (DEBUG.ENABLED) console.warn(`[AUDIO DEBUG] Could not directly connect synth for ${trackId}:`, e);
      }
    }

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

    if (DEBUG.ENABLED) console.log(`[AUDIO] Channel created for track ${trackId} (type: ${type})`);

    return newChannel;
  }

  public updateSequence(
    tracks: Track[], 
    onStep: (trackId: string, step: number) => void,
    onGlobalStep: (step: number) => void
  ): void {
    // === PHASE 1: Cleanup removed tracks ===
    const newTrackIds = new Set(tracks.map(t => t.id));
    for (const [id] of this.currentTracks) {
      if (!newTrackIds.has(id)) {
        this.cleanupTrack(id);
      }
    }

    // === PHASE 2: Update currentTracks map (Source of Truth for Callbacks) ===
    tracks.forEach(t => {
      const existing = this.currentTracks.get(t.id);
      if (existing?.steps !== t.steps) {
        if (DEBUG.ENABLED) console.log(`[AUDIO] Track ${t.id} steps updated (${t.steps.length} total)`);
      }
      this.currentTracks.set(t.id, t);
    });

    // === PHASE 3: Process Tracks ===
    let activePartsCount = 0;

    tracks.forEach(track => {
      // --- A. Channel Strip Updates (Real-time, smooth, no glitches) ---
      const ch = this.getChannel(track.id, track.instrument);
      
      // Apply gain normalization
      const scaledGain = this.gainLimiter.getScaledGain(track.id);
      const volDb = track.volume <= 0.001 ? -100 : 20 * Math.log10(track.volume * scaledGain);
      ch.volume.volume.rampTo(volDb, 0.05); // Smooth ramp
      
      // Pan
      ch.panner.pan.rampTo(track.pan, 0.05);
      
      // Effects with clamping
      ch.distortion.distortion = Math.min(0.8, 0.4 + (track.distortion / 200));
      ch.distortion.wet.value = Math.min(0.8, track.distortion / 100);
      ch.delay.wet.value = Math.min(0.6, track.delay / 100); // Reduced max
      ch.reverb.wet.value = Math.min(0.5, track.reverb / 100); // Reduced max

      // --- B. Sequencer Part Management (Lazy recreation) ---
      const stepCount = Math.max(1, Math.min(32, track.stepCount || 16));
      const existingPart = this.parts.get(track.id);
      const prevState = this.partStates.get(track.id);

      // Only recreate if structural change (stepCount) or no part exists
      const needsRecreate = !existingPart || !prevState || prevState.stepCount !== stepCount;

      // Handle Mute
      if (existingPart) {
        existingPart.mute = track.muted;
      }

      if (needsRecreate) {
        // Cleanup old part - but first check if Transport is running
        if (existingPart && Tone.Transport.state === 'stopped') {
          try {
            existingPart.stop();
            existingPart.dispose();
          } catch (e) {
            if (DEBUG.ENABLED) console.warn(`[AUDIO] Error disposing part: ${e}`);
          }
        } else if (existingPart) {
          // If Transport is running, don't dispose - just stop and create new one
          try {
            existingPart.stop();
          } catch (e) {
            if (DEBUG.ENABLED) console.warn(`[AUDIO] Error stopping part: ${e}`);
          }
        }

        // Check polyphony limits before creating new part
        if (this.parts.size >= POLYPHONY_CONFIG.MAX_ACTIVE_PARTS) {
          if (DEBUG.ENABLED) console.warn(`[POLYPHONY] Max active parts reached (${this.parts.size})`);
          return;
        }

        // Create new part with polyphony-aware callback
        const PPQ = Tone.Transport.PPQ;
        const ticksPerMeasure = PPQ * 4;
        const ticksPerStep = ticksPerMeasure / stepCount;

        // Create events for every step
        const events = Array.from({ length: stepCount }, (_, i) => ({
          time: Math.round(i * ticksPerStep) + "i",
          stepIdx: i
        }));

        if (DEBUG.ENABLED) console.log(`[AUDIO] Creating Part for ${track.id}: ${stepCount} steps, PPQ=${PPQ}, ticksPerStep=${Math.round(ticksPerStep)}`);
        if (DEBUG.ENABLED) console.log(`[AUDIO] Step times (first 4): ${events.slice(0, 4).map(e => e.time).join(', ')}`);


        const part = new Tone.Part((time, event) => {
          // Log every callback
          if (event.stepIdx === 0 && DEBUG.ENABLED) {
            console.log(`[AUDIO CALLBACK] Step 0 callback fired at Transport time ${time}`);
          }
          
          // DYNAMIC CALLBACK: Reads latest data from currentTracks
          const currentTrack = this.currentTracks.get(track.id);
          if (!currentTrack || currentTrack.muted) {
            if (event.stepIdx === 0 && DEBUG.ENABLED) {
              console.log(`[AUDIO STEP 0] track muted=${currentTrack?.muted} or not found=${!currentTrack}`);
            }
            return;
          }

          // UI Feedback
          Tone.Draw.schedule(() => {
            onStep(track.id, event.stepIdx);
          }, time);

          // Audio Trigger with Polyphony Check
          const step = currentTrack.steps[event.stepIdx];
          
          if (event.stepIdx === 0 && DEBUG.ENABLED) {
            console.log(`[AUDIO STEP 0] stepIdx=0, steps array length=${currentTrack.steps.length}, step exists=${!!step}, step=${JSON.stringify(step)}`);
          }
          
          if (step && step.active) {
            if (DEBUG.ENABLED) console.log(`[AUDIO TRIGGER] Step ${event.stepIdx}: Note=${step.note}, Velocity=${step.velocity}`);

            const instDef = INSTRUMENTS.find(i => i.id === currentTrack.instrument);
            const channel = this.channels.get(track.id);
            
            if (channel && instDef) {
              // Check if we can add another voice
              if (!this.polyphonyManager.incrementVoice(track.id)) {
                if (DEBUG.ENABLED) console.warn(`[POLYPHONY] Voice limit hit for ${track.id}`);
                return;
              }

              const noteToPlay = step.note || instDef.defaultNote || 'C2';
              const velocity = (step.velocity ?? 100) / 100;
              const duration = (ticksPerStep / 2) + "i";

              // Trigger audio with error handling
              try {
                if (DEBUG.ENABLED) console.log(`[AUDIO TRIGGER] Playing Note: ${noteToPlay}, Track: ${track.instrument}, Velocity: ${velocity.toFixed(2)}`);
                
                const synth = channel.synth;
                if (synth instanceof Tone.MembraneSynth || synth instanceof Tone.Synth) {
                  synth.triggerAttackRelease(noteToPlay, '8n', time, velocity);
                } else if (synth instanceof Tone.NoiseSynth) {
                  synth.triggerAttackRelease('8n', time, velocity);
                } else if (synth instanceof Tone.MetalSynth) {
                  const dur = (instDef.id.includes('hat') || instDef.id === 'ride') ? '32n' : '16n';
                  synth.triggerAttackRelease(noteToPlay, dur, time, velocity);
                } else if (synth instanceof Tone.PolySynth) {
                  synth.triggerAttackRelease(noteToPlay, duration, time, velocity);
                }

                // Decrement voice count after release
                const actualDuration = Tone.Time(duration).toSeconds();
                setTimeout(() => {
                  this.polyphonyManager.decrementVoice(track.id);
                }, actualDuration * 1000 + 100);
              } catch (e) {
                if (DEBUG.ENABLED) console.error(`[AUDIO] Error triggering note: ${e}`);
                this.polyphonyManager.decrementVoice(track.id);
              }
            } else if (DEBUG.ENABLED && event.stepIdx === 0) {
              console.warn(`[AUDIO TRIGGER] Step 0: Channel not found=${!channel}, instDef not found=${!instDef}`);
            }
          } else if (event.stepIdx === 0 && DEBUG.ENABLED && step) {
            console.log(`[AUDIO STEP 0] step.active=${step.active}, skipping audio trigger`);
          }
        }, events);

        part.loop = true;
        part.loopEnd = "1m";
        
        // Start the part at position 0
        // If Transport is already running, the part will sync automatically
        part.start(0);
        
        // If Transport is already running, we need to manually advance the part
        // to match the current Transport position
        if (this.isRunning && Tone.Transport.state === 'started') {
          const currentPos = Tone.Transport.position as number;
          if (currentPos > 0) {
            if (DEBUG.ENABLED) console.log(`[AUDIO] Part ${track.id} started at Transport position ${currentPos.toFixed(3)}`);
          }
        }
        
        this.parts.set(track.id, part);
        this.partStates.set(track.id, { stepCount });
        
        if (DEBUG.ENABLED) console.log(`[AUDIO] Part created for track ${track.id} with ${stepCount} steps`);
        
        activePartsCount++;
      } else {
        activePartsCount++;
      }
    });

    // === PHASE 4: Master Loop (Global Step) - Create once ===
    if (!this.masterLoop) {
      let globalStep = 0;
      this.masterLoop = new Tone.Loop((time) => {
        Tone.Draw.schedule(() => {
          onGlobalStep(globalStep);
          globalStep = (globalStep + 1) % 16;
        }, time);
      }, "16n").start(0);
    }

    // === PHASE 5: Log stats if interval reached ===
    this.logStatsIfNeeded();
  }

  private logStatsIfNeeded(): void {
    if (!DEBUG.ENABLED) return;

    const now = Date.now();
    if (now - this.lastStatsLog >= DEBUG.LOG_INTERVAL_MS) {
      const stats = this.getAudioStats();
      console.log(`[AUDIO STATS] Voices: ${stats.activeVoices}/${POLYPHONY_CONFIG.MAX_TOTAL_VOICES} | Parts: ${stats.activeParts} | CPU: ~${stats.estimatedCpuLoad.toFixed(1)}% | Overloaded: ${stats.isOverloaded}`);
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
      isOverloaded
    };
  }

  /**
   * Clean up all resources for a track.
   * Properly disposes Tone.js nodes to prevent memory leaks.
   */
  public cleanupTrack(trackId: string): void {
    try {
      const ch = this.channels.get(trackId);
      if (ch) {
        // Release any held voices
        if (ch.synth instanceof Tone.PolySynth) {
          ch.synth.triggerRelease();
        }

        // Dispose all nodes in reverse order
        try { ch.synth.dispose(); } catch (e) { if (DEBUG.ENABLED) console.warn(`Error disposing synth: ${e}`); }
        try { ch.filter.dispose(); } catch (e) { if (DEBUG.ENABLED) console.warn(`Error disposing filter: ${e}`); }
        try { ch.distortion.dispose(); } catch (e) { if (DEBUG.ENABLED) console.warn(`Error disposing distortion: ${e}`); }
        try { ch.delay.dispose(); } catch (e) { if (DEBUG.ENABLED) console.warn(`Error disposing delay: ${e}`); }
        try { ch.reverb.dispose(); } catch (e) { if (DEBUG.ENABLED) console.warn(`Error disposing reverb: ${e}`); }
        try { ch.panner.dispose(); } catch (e) { if (DEBUG.ENABLED) console.warn(`Error disposing panner: ${e}`); }
        try { ch.volume.dispose(); } catch (e) { if (DEBUG.ENABLED) console.warn(`Error disposing volume: ${e}`); }

        this.channels.delete(trackId);
      }

      const part = this.parts.get(trackId);
      if (part) {
        try {
          part.stop();
          part.dispose();
        } catch (e) {
          if (DEBUG.ENABLED) console.warn(`Error disposing part: ${e}`);
        }
        this.parts.delete(trackId);
      }

      this.partStates.delete(trackId);
      this.currentTracks.delete(trackId);
      this.gainLimiter.unregisterTrack(trackId);

      if (DEBUG.ENABLED) console.log(`[AUDIO] Track ${trackId} cleaned up`);
    } catch (e) {
      if (DEBUG.ENABLED) console.error(`[AUDIO] Error cleaning up track ${trackId}: ${e}`);
    }
  }

  /**
   * Dispose all resources and prepare for shutdown.
   * Call before unmounting component or closing app.
   */
  public dispose(): void {
    if (DEBUG.ENABLED) console.log('[AUDIO] Disposing audio engine');

    // Remove page visibility listener
    if (this.pageVisibilityHandler) {
      document.removeEventListener('visibilitychange', this.pageVisibilityHandler);
    }

    // Hard stop
    this.hardStop();

    // Cleanup all channels
    for (const trackId of this.channels.keys()) {
      this.cleanupTrack(trackId);
    }

    // Dispose master limiter and recorder
    try { this.masterLimiter.dispose(); } catch (e) { if (DEBUG.ENABLED) console.warn(`Error disposing limiter: ${e}`); }
    try { this.recorder.dispose(); } catch (e) { if (DEBUG.ENABLED) console.warn(`Error disposing recorder: ${e}`); }

    this.channels.clear();
    this.parts.clear();
    this.currentTracks.clear();
  }
  
  public async startRecording(): Promise<void> {
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
    this.recorder.start();
  }

  public async stopRecording(): Promise<string> {
    const blob = await this.recorder.stop();
    const url = URL.createObjectURL(blob);
    return url;
  }
}

export let audioEngine = new AudioEngine();

// Support HMR - recreate engine on hot reload
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    if (audioEngine) {
      audioEngine.dispose();
    }
    audioEngine = new AudioEngine();
    if (DEBUG.ENABLED) console.log('[AUDIO] Engine recreated after HMR');
  });
}

