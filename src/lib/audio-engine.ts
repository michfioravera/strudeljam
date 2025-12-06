// src/lib/audio-engine-hybrid.ts
import { 
  Synth, 
  PolySynth, 
  MembraneSynth, 
  NoiseSynth, 
  MetalSynth,
  Filter,
  Distortion,
  FeedbackDelay,
  Reverb,
  Panner,
  Volume,
  Part,
  Loop,
  Limiter,
  Recorder,
  Transport,
  Draw,
  context,
  start,
  getContext,
  Destination
} from 'tone';
import { 
  Track, 
  INSTRUMENTS, 
  InstrumentType, 
  POLYPHONY_CONFIG, 
  SAFE_MODE_CONFIG,
  DEBUG_CONFIG,
  SEQUENCER_CONFIG
} from './constants';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface ChannelStrip {
  type: InstrumentType;
  synth: Synth | PolySynth | MembraneSynth | NoiseSynth | MetalSynth;
  filter: Filter;
  distortion: Distortion;
  delay: FeedbackDelay;
  reverb: Reverb;
  panner: Panner;
  volume: Volume;
  voiceCount: number;
}

interface PartState {
  stepCount: number;
}

interface AudioStats {
  totalVoices: number;
  activeVoices: number;
  activeParts: number;
  estimatedCpuLoad: number;
  isOverloaded: boolean;
  engine: 'tone.js';
}

// ============================================================================
// POLYPHONY MANAGER
// ============================================================================

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
      if (DEBUG_CONFIG.ENABLED) {
        console.warn(`[POLYPHONY] Max voices reached (${total}/${POLYPHONY_CONFIG.MAX_TOTAL_VOICES})`);
      }
      return false;
    }

    const trackVoices = this.activeVoices.get(trackId) || 0;
    if (trackVoices >= POLYPHONY_CONFIG.MAX_VOICES_PER_TRACK) {
      if (DEBUG_CONFIG.ENABLED) {
        console.warn(`[POLYPHONY] Track ${trackId} max voices (${trackVoices}/${POLYPHONY_CONFIG.MAX_VOICES_PER_TRACK})`);
      }
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

// ============================================================================
// GAIN LIMITER
// ============================================================================

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
    return Math.min(1.0, baseGain * this.maxGain * 0.95);
  }

  reset(): void {
    this.gains.clear();
    this.maxGain = 1.0;
  }
}

// ============================================================================
// HYBRID AUDIO ENGINE
// ============================================================================

class HybridAudioEngine {
  private channels: Map<string, ChannelStrip> = new Map();
  private parts: Map<string, Part> = new Map();
  private partStates: Map<string, PartState> = new Map();
  private currentTracks: Map<string, Track> = new Map();
  
  private polyphonyManager: PolyphonyManager = new PolyphonyManager();
  private gainLimiter: GainLimiter = new GainLimiter();
  
  private masterLoop: Loop | null = null;
  private masterLimiter: Limiter | null = null;
  private recorder: Recorder | null = null;
  
  private isRunning: boolean = false;
  private isInitialized: boolean = false;
  
  private onStepCallback: ((trackId: string, step: number) => void) | null = null;
  private onGlobalStepCallback: ((step: number) => void) | null = null;
  
  private globalStepCount: number = SEQUENCER_CONFIG.STEPS_PER_MEASURE;
  private lastStatsLog: number = 0;
  private pageVisibilityHandler: (() => void) | null = null;

  constructor() {
    // Page visibility listener (pause when tab loses focus)
    this.pageVisibilityHandler = this.handlePageVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.pageVisibilityHandler);
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    
    await start();
    
    // Setup master limiter (-3dB to prevent clipping)
    this.masterLimiter = new Limiter(-3).toDestination();
    
    // Setup recorder
    this.recorder = new Recorder();
    this.masterLimiter.connect(this.recorder);
    
    this.isInitialized = true;
    
    if (DEBUG_CONFIG.ENABLED) {
      console.log('[AUDIO] Engine initialized, sample rate:', getContext().sampleRate);
    }

    // If there are pending tracks, recreate parts now
    if (this.currentTracks.size > 0) {
      const tracks = Array.from(this.currentTracks.values());
      this.recreateAllParts(tracks);
    }
  }

  private handlePageVisibilityChange(): void {
    if (document.hidden && this.isRunning) {
      if (DEBUG_CONFIG.ENABLED) {
        console.log('[AUDIO] Tab hidden - pausing audio');
      }
      this.hardStop();
    }
  }

  // ============================================================================
  // SYNTH CREATION
  // ============================================================================

  private createSynth(type: InstrumentType): Synth | PolySynth | MembraneSynth | NoiseSynth | MetalSynth {
    switch (type) {
      case 'kick':
        return new MembraneSynth({
          pitchDecay: 0.05,
          octaves: 6,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 1.2 }
        });
        
      case 'tom':
        return new MembraneSynth({
          pitchDecay: 0.05,
          octaves: 3,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 1.0 }
        });
        
      case 'snare':
      case 'rim':
      case 'clap':
        return new NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 }
        });
        
      case 'hat':
      case 'open_hat':
      case 'ride':
      case 'crash':
        return new MetalSynth({
          envelope: { attack: 0.001, decay: 0.1, release: 0.05 },
          harmonicity: 5.1,
          modulationIndex: 32,
          resonance: 4000,
          octaves: 1.5
        });
        
      case 'perc':
        return new MembraneSynth();
        
      case 'sine':
        return new PolySynth(Synth, {
          oscillator: { type: 'sine' },
          envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 },
          maxVoices: POLYPHONY_CONFIG.MAX_VOICES_PER_TRACK
        });
        
      case 'triangle':
        return new PolySynth(Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 },
          maxVoices: POLYPHONY_CONFIG.MAX_VOICES_PER_TRACK
        });
        
      case 'square':
        return new PolySynth(Synth, {
          oscillator: { type: 'square' },
          envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 },
          maxVoices: POLYPHONY_CONFIG.MAX_VOICES_PER_TRACK
        });
        
      case 'sawtooth':
        return new PolySynth(Synth, {
          oscillator: { type: 'sawtooth' },
          envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 },
          maxVoices: POLYPHONY_CONFIG.MAX_VOICES_PER_TRACK
        });
        
      case 'white':
        return new NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 }
        });
        
      case 'pink':
        return new NoiseSynth({
          noise: { type: 'pink' },
          envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 }
        });
        
      case 'brown':
        return new NoiseSynth({
          noise: { type: 'brown' },
          envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 }
        });
        
      default:
        return new Synth();
    }
  }

  // ============================================================================
  // CHANNEL MANAGEMENT
  // ============================================================================

  private getOrCreateChannel(trackId: string, type: InstrumentType): ChannelStrip | null {
    if (!this.isInitialized || !this.masterLimiter) return null;
    
    let channel = this.channels.get(trackId);
    
    // If channel exists but type changed, swap the synth
    if (channel && channel.type !== type) {
      try {
        channel.synth.dispose();
      } catch (e) {
        if (DEBUG_CONFIG.ENABLED) console.warn(`[AUDIO] Error disposing old synth: ${e}`);
      }
      
      const newSynth = this.createSynth(type);
      newSynth.connect(channel.filter);
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
    const filter = new Filter({
      frequency: SAFE_MODE_CONFIG.FILTER_FREQ,
      type: 'lowpass',
      rolloff: -24
    });
    
    const distortion = new Distortion(0);
    
    const delay = new FeedbackDelay("8n", 0.3);
    delay.wet.value = 0;
    
    const reverb = new Reverb(1.5);
    reverb.wet.value = 0;
    
    const panner = new Panner(0);
    const volume = new Volume(0);
    
    // Signal chain: Synth -> Filter -> Distortion -> Delay -> Reverb -> Volume -> Panner -> Master
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
      console.log(`[AUDIO] Channel created for track ${trackId} (type: ${type})`);
    }
    
    return newChannel;
  }

  // ============================================================================
  // PART CREATION - FIXED TIMING WITH DYNAMIC STEP COUNT
  // ============================================================================

  /**
   * Calculate the loopEnd time based on stepCount.
   * 16 steps = 1 measure (1m)
   * 8 steps = half measure (0:2:0)
   * 32 steps = 2 measures (2m)
   * 
   * Formula: stepCount / 16 measures
   */
  private calculateLoopEnd(stepCount: number): string {
    // Each step is a 16th note
    // 16 steps = 1 measure = 4 beats
    // So stepCount steps = stepCount/4 beats = stepCount/16 measures
    const measures = stepCount / 16;
    
    if (measures === 1) {
      return "1m";
    } else if (measures === 2) {
      return "2m";
    } else if (measures === 0.5) {
      return "0:2:0"; // 2 beats = half measure
    } else if (measures === 0.25) {
      return "0:1:0"; // 1 beat = quarter measure
    } else {
      // For arbitrary step counts, use ticks for precision
      const PPQ = Transport.PPQ;
      const ticksPerMeasure = PPQ * 4;
      const totalTicks = Math.round((stepCount / 16) * ticksPerMeasure);
      return `${totalTicks}i`;
    }
  }

  /**
   * Calculate tick-based timing for accurate step sequencing.
   * Uses PPQ (Pulses Per Quarter) for precise sixteenth-note timing.
   * 
   * IMPORTANT: All steps are 16th notes regardless of stepCount.
   * stepCount only affects the loop length, not the note spacing.
   */
  private calculateStepEvents(stepCount: number): { time: string; stepIdx: number }[] {
    const PPQ = Transport.PPQ; // Usually 192
    const ticksPerSixteenth = PPQ / 4; // 16th note = PPQ/4 ticks
    
    return Array.from({ length: stepCount }, (_, i) => ({
      time: Math.round(i * ticksPerSixteenth) + "i", // "i" suffix = ticks
      stepIdx: i
    }));
  }

  private createPartForTrack(track: Track): Part | null {
    const channel = this.channels.get(track.id);
    if (!channel) return null;
    
    const stepCount = Math.max(1, Math.min(SEQUENCER_CONFIG.MAX_STEPS, track.stepCount || SEQUENCER_CONFIG.STEPS_PER_MEASURE));
    const events = this.calculateStepEvents(stepCount);
    const loopEnd = this.calculateLoopEnd(stepCount);
    const trackId = track.id;
    
    if (DEBUG_CONFIG.ENABLED) {
      console.log(`[AUDIO] Creating Part for ${trackId}: ${stepCount} steps, loopEnd=${loopEnd}, events:`, events.slice(0, 4).map(e => e.time));
    }
    
    const part = new Part((time, event) => {
      // Dynamic callback: reads latest data from currentTracks
      const currentTrack = this.currentTracks.get(trackId);
      if (!currentTrack || currentTrack.muted) return;
      
      // UI Feedback
      if (this.onStepCallback) {
        Draw.schedule(() => {
          this.onStepCallback!(trackId, event.stepIdx);
        }, time);
      }
      
      // Audio trigger - read step dynamically from currentTracks
      const step = currentTrack.steps[event.stepIdx];
      if (step && step.active) {
        const instDef = INSTRUMENTS.find(i => i.id === currentTrack.instrument);
        const ch = this.channels.get(trackId);
        
        if (ch && instDef) {
          // Polyphony check
          if (!this.polyphonyManager.incrementVoice(trackId)) {
            return;
          }
          
          const noteToPlay = step.note || instDef.defaultNote || 'C2';
          const velocity = (step.velocity ?? 100) / 100;
          
          try {
            const synth = ch.synth;
            
            if (synth instanceof MembraneSynth) {
              synth.triggerAttackRelease(noteToPlay, '8n', time, velocity);
            } else if (synth instanceof NoiseSynth) {
              synth.triggerAttackRelease('8n', time, velocity);
            } else if (synth instanceof MetalSynth) {
              const dur = (instDef.id.includes('hat') || instDef.id === 'ride') ? '32n' : '16n';
              synth.triggerAttackRelease(noteToPlay, dur, time, velocity);
            } else if (synth instanceof PolySynth) {
              synth.triggerAttackRelease(noteToPlay, '8n', time, velocity);
            } else if (synth instanceof Synth) {
              synth.triggerAttackRelease(noteToPlay, '8n', time, velocity);
            }
            
            // Decrement voice count after note release
            setTimeout(() => {
              this.polyphonyManager.decrementVoice(trackId);
            }, 200);
            
          } catch (e) {
            if (DEBUG_CONFIG.ENABLED) console.error(`[AUDIO] Error triggering note:`, e);
            this.polyphonyManager.decrementVoice(trackId);
          }
        }
      }
    }, events);
    
    part.loop = true;
    part.loopEnd = loopEnd;
    part.mute = track.muted;
    
    return part;
  }

  private recreateAllParts(tracks: Track[]): void {
    tracks.forEach(track => {
      const ch = this.getOrCreateChannel(track.id, track.instrument);
      if (!ch) return;
      
      const existingPart = this.parts.get(track.id);
      if (existingPart) {
        existingPart.mute = track.muted;
        return; // Part already exists, don't recreate
      }
      
      const part = this.createPartForTrack(track);
      if (part) {
        this.parts.set(track.id, part);
        this.partStates.set(track.id, {
          stepCount: track.stepCount || SEQUENCER_CONFIG.STEPS_PER_MEASURE
        });
        
        if (DEBUG_CONFIG.ENABLED) {
          console.log(`[AUDIO] Part created during init for track ${track.id}`);
        }
      }
    });
  }

  // ============================================================================
  // TRANSPORT CONTROL
  // ============================================================================

  public async start(): Promise<void> {
    await this.ensureInitialized();
    
    // Resume context if suspended
    if (context.state === 'suspended') {
      await context.resume();
    }
    
    // Reset position and start transport
    Transport.position = 0;
    Transport.start();
    this.isRunning = true;
    
    // Start all existing parts
    this.parts.forEach((part, id) => {
      try {
        if (!(part as any).started) {
          part.start(0);
          if (DEBUG_CONFIG.ENABLED) {
            console.log(`[AUDIO] Part started for track ${id}`);
          }
        }
      } catch (e) {
        if (DEBUG_CONFIG.ENABLED) console.warn(`[AUDIO] Error starting part ${id}:`, e);
      }
    });
    
    // Start master loop
    if (this.masterLoop) {
      try {
        if (!(this.masterLoop as any).running) {
          this.masterLoop.start(0);
        }
      } catch (e) {
        if (DEBUG_CONFIG.ENABLED) console.warn('[AUDIO] Error starting master loop:', e);
      }
    }
    
    if (DEBUG_CONFIG.ENABLED) {
      console.log('[AUDIO] Engine started');
    }
  }

  public stop(): void {
    Transport.stop();
    Transport.position = 0;
    
    this.parts.forEach((part, id) => {
      try {
        part.stop();
      } catch (e) {
        if (DEBUG_CONFIG.ENABLED) console.warn(`[AUDIO] Error stopping part ${id}:`, e);
      }
    });
    
    if (this.masterLoop) {
      try {
        this.masterLoop.stop();
      } catch (e) {
        if (DEBUG_CONFIG.ENABLED) console.warn('[AUDIO] Error stopping master loop:', e);
      }
    }
    
    this.isRunning = false;
    
    if (DEBUG_CONFIG.ENABLED) {
      console.log('[AUDIO] Engine stopped');
    }
  }

  /**
   * Hard stop: Kill ALL voices and effects immediately.
   * Use this for emergency stop or tab visibility changes.
   */
  public hardStop(): void {
    if (DEBUG_CONFIG.ENABLED) {
      console.log('[AUDIO] HARD STOP triggered');
    }
    
    // Stop all parts
    this.parts.forEach((part, id) => {
      try {
        part.stop();
        part.dispose();
      } catch (e) {
        if (DEBUG_CONFIG.ENABLED) console.warn(`[AUDIO] Error disposing part ${id}:`, e);
      }
    });
    this.parts.clear();
    this.partStates.clear();
    
    // Release all synth voices
    this.channels.forEach((ch, id) => {
      try {
        if (ch.synth instanceof PolySynth) {
          ch.synth.releaseAll();
        }
      } catch (e) {
        if (DEBUG_CONFIG.ENABLED) console.warn(`[AUDIO] Error releasing voices for ${id}:`, e);
      }
    });
    
    // Stop transport
    Transport.stop();
    Transport.position = 0;
    
    // Dispose master loop
    if (this.masterLoop) {
      try {
        this.masterLoop.stop();
        this.masterLoop.dispose();
      } catch (e) {
        if (DEBUG_CONFIG.ENABLED) console.warn('[AUDIO] Error disposing master loop:', e);
      }
      this.masterLoop = null;
    }
    
    this.polyphonyManager.reset();
    this.isRunning = false;
  }

  public setBpm(bpm: number): void {
    Transport.bpm.value = bpm;
  }

  // ============================================================================
  // SEQUENCE UPDATE - MAIN METHOD (FIXED)
  // ============================================================================

  public updateSequence(
    tracks: Track[],
    onStep: (trackId: string, step: number) => void,
    onGlobalStep: (step: number) => void
  ): void {
    if (DEBUG_CONFIG.ENABLED) {
      console.log('[AUDIO] updateSequence called with', tracks.length, 'tracks, initialized:', this.isInitialized, 'running:', this.isRunning);
    }
    
    this.onStepCallback = onStep;
    this.onGlobalStepCallback = onGlobalStep;
    
    // === PHASE 1: Cleanup removed tracks ===
    const newTrackIds = new Set(tracks.map(t => t.id));
    for (const [id] of this.currentTracks) {
      if (!newTrackIds.has(id)) {
        this.cleanupTrack(id);
      }
    }
    
    // === PHASE 2: Update currentTracks map (Source of Truth for Callbacks) ===
    // This is critical - the Part callback reads from currentTracks dynamically,
    // so step changes (active/note/velocity) are reflected immediately without
    // recreating the Part.
    tracks.forEach(t => {
      this.currentTracks.set(t.id, t);
    });
    
    // Defer part creation until engine is initialized
    if (!this.isInitialized) {
      if (DEBUG_CONFIG.ENABLED) {
        console.log('[AUDIO] Engine not initialized, deferring part creation');
      }
      return;
    }
    
    // === PHASE 3: Process Tracks ===
    tracks.forEach(track => {
      // --- A. Channel Strip Updates (Real-time, smooth, no glitches) ---
      const ch = this.getOrCreateChannel(track.id, track.instrument);
      if (!ch) return;
      
      // Apply gain normalization
      const scaledGain = this.gainLimiter.getScaledGain(track.id);
      const volDb = track.volume <= 0.001 ? -100 : 20 * Math.log10(track.volume * scaledGain);
      ch.volume.volume.rampTo(volDb, 0.05);
      
      // Pan
      ch.panner.pan.rampTo(track.pan, 0.05);
      
      // Effects with clamping
      ch.distortion.distortion = Math.min(0.8, 0.4 + (track.distortion / 200));
      ch.distortion.wet.value = Math.min(0.8, track.distortion / 100);
      ch.delay.wet.value = Math.min(0.6, track.delay / 100);
      ch.reverb.wet.value = Math.min(0.5, track.reverb / 100);
      
      // --- B. Sequencer Part Management ---
      // ONLY recreate Part when stepCount changes, NOT when steps content changes.
      // Step content (active/note/velocity) is read dynamically from currentTracks.
      
      const stepCount = Math.max(1, Math.min(SEQUENCER_CONFIG.MAX_STEPS, track.stepCount || SEQUENCER_CONFIG.STEPS_PER_MEASURE));
      const existingPart = this.parts.get(track.id);
      const prevState = this.partStates.get(track.id);
      
      // Handle Mute on existing part (no recreation needed)
      if (existingPart) {
        existingPart.mute = track.muted;
      }
      
      // ONLY recreate if stepCount changed (structural change)
      const needsRecreate = !existingPart || !prevState || prevState.stepCount !== stepCount;
      
      if (needsRecreate) {
        if (DEBUG_CONFIG.ENABLED) {
          console.log(`[AUDIO] Recreating part for track ${track.id} (${track.instrument}): stepCount changed from ${prevState?.stepCount || 'none'} to ${stepCount}`);
        }
        
        // Check polyphony limits before creating new part
        if (this.parts.size >= POLYPHONY_CONFIG.MAX_ACTIVE_PARTS && !existingPart) {
          if (DEBUG_CONFIG.ENABLED) {
            console.warn(`[POLYPHONY] Max active parts reached (${this.parts.size})`);
          }
          return;
        }
        
        // Graceful hot-swap of Part during playback
        if (existingPart) {
          this.hotSwapPart(track, stepCount);
        } else {
          // No existing part, create new one
          this.createAndStartPart(track, stepCount);
        }
      }
    });
    
    // === PHASE 4: Master Loop (Global Step) - Create once ===
    if (!this.masterLoop && this.isInitialized) {
      this.createMasterLoop();
    }
    
    // === PHASE 5: Log stats if interval reached ===
    this.logStatsIfNeeded();
  }

  /**
   * Hot-swap a Part during playback without losing sync.
   * This is used when stepCount changes during playback.
   */
  private hotSwapPart(track: Track, stepCount: number): void {
    const existingPart = this.parts.get(track.id);
    
    // Calculate current position in the loop for sync
    const transportPosition = Transport.position;
    
    // Create new part first
    const newPart = this.createPartForTrack({ ...track, stepCount });
    if (!newPart) return;
    
    if (this.isRunning && Transport.state === 'started') {
      // Schedule the swap to happen at the next measure boundary for clean transition
      // This prevents audio glitches and keeps things in sync
      const nextMeasure = this.getNextMeasureBoundary();
      
            if (DEBUG_CONFIG.ENABLED) {
        console.log(`[AUDIO] Hot-swap scheduled for track ${track.id} at ${nextMeasure}, current position: ${transportPosition}`);
      }
      
      // Stop old part at next measure boundary
      try {
        existingPart?.stop(nextMeasure);
      } catch (e) {
        if (DEBUG_CONFIG.ENABLED) console.warn('[AUDIO] Error scheduling old part stop:', e);
      }
      
      // Start new part at next measure boundary
      try {
        newPart.start(nextMeasure);
      } catch (e) {
        if (DEBUG_CONFIG.ENABLED) console.warn('[AUDIO] Error scheduling new part start:', e);
      }
      
      // Dispose old part after a delay to ensure clean handoff
      if (existingPart) {
        setTimeout(() => {
          try {
            existingPart.dispose();
          } catch (e) {
            if (DEBUG_CONFIG.ENABLED) console.warn('[AUDIO] Error disposing old part after hot-swap:', e);
          }
        }, 500);
      }
    } else {
      // Transport not running, safe to swap immediately
      if (existingPart) {
        try {
          existingPart.stop();
          existingPart.dispose();
        } catch (e) {
          if (DEBUG_CONFIG.ENABLED) console.warn('[AUDIO] Error disposing old part:', e);
        }
      }
      
      try {
        newPart.start(0);
      } catch (e) {
        if (DEBUG_CONFIG.ENABLED) console.warn('[AUDIO] Error starting new part:', e);
      }
    }
    
    // Update maps
    this.parts.set(track.id, newPart);
    this.partStates.set(track.id, { stepCount });
    
    if (DEBUG_CONFIG.ENABLED) {
      console.log(`[AUDIO] Part hot-swapped for track ${track.id} with ${stepCount} steps`);
    }
  }

  /**
   * Get the next measure boundary for scheduling.
   * Returns a time string that can be used with js scheduling.
   */
  private getNextMeasureBoundary(): string {
    try {
      const position = Transport.position;
      // Parse current position (format: "bars:beats:sixteenths")
      const parts = position.toString().split(':');
      const currentBar = parseInt(parts[0]) || 0;
      const currentBeat = parseFloat(parts[1]) || 0;
      const currentSixteenth = parseFloat(parts[2]) || 0;
      
      // If we're at the very start of a measure, use current position + small offset
      if (currentBeat < 0.1 && currentSixteenth < 0.1) {
        return `+0.05`;
      }
      
      // Otherwise, schedule for start of next measure
      const nextBar = currentBar + 1;
      return `${nextBar}:0:0`;
    } catch (e) {
      if (DEBUG_CONFIG.ENABLED) console.warn('[AUDIO] Error calculating next measure boundary:', e);
      return "+1m"; // Fallback: next measure
    }
  }

  /**
   * Create and start a new Part for a track.
   */
  private createAndStartPart(track: Track, stepCount: number): void {
    const newPart = this.createPartForTrack({ ...track, stepCount });
    if (!newPart) return;
    
    if (this.isRunning && Transport.state === 'started') {
      try {
        // Start immediately synced with transport
        newPart.start("+0");
      } catch (e) {
        if (DEBUG_CONFIG.ENABLED) console.warn('[AUDIO] Error starting new part:', e);
      }
    } else {
      try {
        newPart.start(0);
      } catch (e) {
        if (DEBUG_CONFIG.ENABLED) console.warn('[AUDIO] Error starting new part at 0:', e);
      }
    }
    
    this.parts.set(track.id, newPart);
    this.partStates.set(track.id, { stepCount });
    
    if (DEBUG_CONFIG.ENABLED) {
      console.log(`[AUDIO] Part created for track ${track.id} with ${stepCount} steps, running=${this.isRunning}`);
    }
  }

  /**
   * Create the master loop for global step tracking.
   */
  private createMasterLoop(): void {
    let globalStep = 0;
    
    this.masterLoop = new Loop((time) => {
      if (this.onGlobalStepCallback) {
        Draw.schedule(() => {
          this.onGlobalStepCallback!(globalStep);
          globalStep = (globalStep + 1) % this.globalStepCount;
        }, time);
      }
    }, "16n"); // 16th note interval
    
    if (this.isRunning) {
      try {
        this.masterLoop.start(0);
      } catch (e) {
        if (DEBUG_CONFIG.ENABLED) console.warn('[AUDIO] Error starting master loop:', e);
      }
    }
    
    if (DEBUG_CONFIG.ENABLED) {
      console.log('[AUDIO] Master loop created');
    }
  }

  // ============================================================================
  // CLEANUP & DISPOSAL
  // ============================================================================

  public cleanupTrack(trackId: string): void {
    try {
      // Cleanup channel
      const ch = this.channels.get(trackId);
      if (ch) {
        // Release any held voices
        if (ch.synth instanceof PolySynth) {
          try {
            ch.synth.releaseAll();
          } catch (e) {}
        }
        
        // Dispose all nodes in reverse signal chain order
        try { ch.synth.dispose(); } catch (e) {}
        try { ch.filter.dispose(); } catch (e) {}
        try { ch.distortion.dispose(); } catch (e) {}
        try { ch.delay.dispose(); } catch (e) {}
        try { ch.reverb.dispose(); } catch (e) {}
        try { ch.panner.dispose(); } catch (e) {}
        try { ch.volume.dispose(); } catch (e) {}
        
        this.channels.delete(trackId);
      }
      
      // Cleanup part
      const part = this.parts.get(trackId);
      if (part) {
        try {
          part.stop();
          part.dispose();
        } catch (e) {}
        this.parts.delete(trackId);
      }
      
      this.partStates.delete(trackId);
      this.currentTracks.delete(trackId);
      this.gainLimiter.unregisterTrack(trackId);
      
      if (DEBUG_CONFIG.ENABLED) {
        console.log(`[AUDIO] Track ${trackId} cleaned up`);
      }
    } catch (e) {
      if (DEBUG_CONFIG.ENABLED) {
        console.error(`[AUDIO] Error cleaning up track ${trackId}:`, e);
      }
    }
  }

  public dispose(): void {
    if (DEBUG_CONFIG.ENABLED) {
      console.log('[AUDIO] Disposing audio engine');
    }
    
    // Remove page visibility listener
    if (this.pageVisibilityHandler) {
      document.removeEventListener('visibilitychange', this.pageVisibilityHandler);
      this.pageVisibilityHandler = null;
    }
    
    // Hard stop everything
    this.hardStop();
    
    // Cleanup all channels
    for (const trackId of this.channels.keys()) {
      this.cleanupTrack(trackId);
    }
    
    // Dispose master limiter and recorder
    if (this.masterLimiter) {
      try {
        this.masterLimiter.dispose();
      } catch (e) {}
      this.masterLimiter = null;
    }
    
    if (this.recorder) {
      try {
        this.recorder.dispose();
      } catch (e) {}
      this.recorder = null;
    }
    
    // Clear all maps
    this.channels.clear();
    this.parts.clear();
    this.partStates.clear();
    this.currentTracks.clear();
    
    // Reset managers
    this.polyphonyManager.reset();
    this.gainLimiter.reset();
    
    this.isInitialized = false;
  }

  // ============================================================================
  // RECORDING
  // ============================================================================

  public async startRecording(): Promise<void> {
    await this.ensureInitialized();
    if (this.recorder) {
      try {
        this.recorder.start();
        if (DEBUG_CONFIG.ENABLED) {
          console.log('[AUDIO] Recording started');
        }
      } catch (e) {
        if (DEBUG_CONFIG.ENABLED) {
          console.error('[AUDIO] Error starting recording:', e);
        }
      }
    }
  }

  public async stopRecording(): Promise<string> {
    if (!this.recorder) return '';
    
    try {
      const blob = await this.recorder.stop();
      if (DEBUG_CONFIG.ENABLED) {
        console.log('[AUDIO] Recording stopped, blob size:', blob.size);
      }
      return URL.createObjectURL(blob);
    } catch (e) {
      if (DEBUG_CONFIG.ENABLED) {
        console.error('[AUDIO] Error stopping recording:', e);
      }
      return '';
    }
  }

  // ============================================================================
  // STATS & DEBUGGING
  // ============================================================================

  private logStatsIfNeeded(): void {
    if (!DEBUG_CONFIG.ENABLED) return;
    
    const now = Date.now();
    if (now - this.lastStatsLog >= DEBUG_CONFIG.LOG_INTERVAL_MS) {
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
      isOverloaded,
      engine: 'tone.js'
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  public isEngineRunning(): boolean {
    return this.isRunning;
  }

  public isEngineInitialized(): boolean {
    return this.isInitialized;
  }

  public getTransportState(): string {
    return Transport.state;
  }

  public getTransportPosition(): string {
    return Transport.position.toString();
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export let audioEngine = new HybridAudioEngine();

// Support HMR - recreate engine on hot reload
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    if (audioEngine) {
      audioEngine.dispose();
    }
    audioEngine = new HybridAudioEngine();
    if (DEBUG_CONFIG.ENABLED) {
      console.log('[AUDIO] Engine recreated after HMR');
    }
  });
}