import * as Tone from 'tone';
import { Track, INSTRUMENTS, InstrumentType, POLYPHONY_CONFIG, SAFE_MODE_CONFIG } from './constants';

interface ChannelStrip {
  type: InstrumentType;
  synth: Tone.Synth | Tone.PolySynth | Tone.MembraneSynth | Tone.NoiseSynth | Tone.MetalSynth;
  filter: Tone.Filter;
  distortion: Tone.Distortion;
  delay: Tone.FeedbackDelay;
  reverb: Tone.Reverb;
  panner: Tone.Panner;
  volume: Tone.Volume;
}

interface PartState {
  stepCount: number;
  stepsHash: string;
}

class HybridAudioEngine {
  private channels: Map<string, ChannelStrip> = new Map();
  private parts: Map<string, Tone.Part> = new Map();
  private partStates: Map<string, PartState> = new Map();
  private currentTracks: Map<string, Track> = new Map();
  private masterLoop: Tone.Loop | null = null;
  private masterLimiter: Tone.Limiter | null = null;
  private recorder: Tone.Recorder | null = null;
  private isRunning: boolean = false;
  private isInitialized: boolean = false;
  private onStepCallback: ((trackId: string, step: number) => void) | null = null;
  private onGlobalStepCallback: ((step: number) => void) | null = null;

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    await Tone.start();
    this.masterLimiter = new Tone.Limiter(-3).toDestination();
    this.recorder = new Tone.Recorder();
    this.masterLimiter.connect(this.recorder);
    this.isInitialized = true;
    console.log('[AUDIO] Engine initialized, recreating parts for', this.currentTracks.size, 'tracks');

    // FIX: Se ci sono track in sospeso, ricreali ora che l'engine è inizializzato
    if (this.currentTracks.size > 0) {
      const tracks = Array.from(this.currentTracks.values());
      this.recreateAllParts(tracks);
    }
  }

  private recreateAllParts(tracks: Track[]): void {
    tracks.forEach(track => {
      const ch = this.getOrCreateChannel(track.id, track.instrument);
      if (!ch) return;

      const stepCount = Math.max(1, Math.min(32, track.stepCount || 16));
      const existingPart = this.parts.get(track.id);

      if (existingPart) {
        existingPart.mute = track.muted;
        return; // Parte già esiste, non ricrearlo
      }

      const events = Array.from({ length: stepCount }, (_, i) => ({ time: `0:${i}:0`, stepIdx: i }));
      const trackId = track.id;

      const part = new Tone.Part((time, event) => {
        const currentTrack = this.currentTracks.get(trackId);
        if (!currentTrack || currentTrack.muted) return;

        if (this.onStepCallback) {
          Tone.Draw.schedule(() => this.onStepCallback!(trackId, event.stepIdx), time);
        }

        const step = currentTrack.steps[event.stepIdx];
        if (step && step.active) {
          const instDef = INSTRUMENTS.find(i => i.id === currentTrack.instrument);
          const channel = this.channels.get(trackId);
          if (channel && instDef) {
            const noteToPlay = step.note || instDef.defaultNote || 'C2';
            const velocity = (step.velocity ?? 100) / 100;
            const synth = channel.synth;
            try {
              if (synth instanceof Tone.MembraneSynth) {
                synth.triggerAttackRelease(noteToPlay, '8n', time, velocity);
              } else if (synth instanceof Tone.NoiseSynth) {
                synth.triggerAttackRelease('8n', time, velocity);
              } else if (synth instanceof Tone.MetalSynth) {
                synth.triggerAttackRelease(noteToPlay, '16n', time, velocity);
              } else if (synth instanceof Tone.PolySynth) {
                synth.triggerAttackRelease(noteToPlay, '8n', time, velocity);
              } else if (synth instanceof Tone.Synth) {
                synth.triggerAttackRelease(noteToPlay, '8n', time, velocity);
              }
            } catch (e) {}
          }
        }
      }, events);

      part.loop = true;
      part.loopEnd = `0:${stepCount}:0`;
      part.mute = track.muted;

      this.parts.set(track.id, part);
      this.partStates.set(track.id, {
        stepCount,
        stepsHash: this.getStepsHash(track.steps)
      });
      console.log(`[AUDIO] Part created during init for track ${track.id} with ${stepCount} steps`);
    });
  }

  public async start(): Promise<void> {
    await this.ensureInitialized();
    if (Tone.context.state === 'suspended') {
      await Tone.context.resume();
    }
    Tone.Transport.position = 0;
    Tone.Transport.start();
    this.isRunning = true;
    this.parts.forEach(part => {
      try {
        if (!part.started) part.start(0);
      } catch (e) {
        console.warn('[AUDIO] Error starting part:', e);
      }
    });
    if (this.masterLoop) {
      try {
        if (!this.masterLoop.running) this.masterLoop.start(0);
      } catch (e) {
        console.warn('[AUDIO] Error starting master loop:', e);
      }
    }
  }

  public stop(): void {
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    this.parts.forEach(part => {
      try {
        part.stop();
      } catch (e) {
        console.warn('[AUDIO] Error stopping part:', e);
      }
    });
    if (this.masterLoop) {
      try {
        this.masterLoop.stop();
      } catch (e) {
        console.warn('[AUDIO] Error stopping master loop:', e);
      }
    }
    this.isRunning = false;
  }

  public setBpm(bpm: number): void {
    Tone.Transport.bpm.value = bpm;
  }

  private createSynth(type: InstrumentType): any {
    switch (type) {
      case 'kick':
        return new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 1.2 } });
      case 'tom':
        return new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 3, oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 1.0 } });
      case 'snare':
      case 'rim':
      case 'clap':
        return new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 } });
      case 'hat':
      case 'open_hat':
      case 'ride':
      case 'crash':
        return new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.1, release: 0.05 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 });
      case 'perc':
        return new Tone.MembraneSynth();
      case 'sine':
        return new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 } });
      case 'triangle':
        return new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 } });
      case 'square':
        return new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 } });
      case 'sawtooth':
        return new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 } });
      case 'white':
        return new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 } });
      case 'pink':
        return new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 } });
      case 'brown':
        return new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.005, decay: 0.2, sustain: 0, release: 0.1 } });
      default:
        return new Tone.Synth();
    }
  }

  private getOrCreateChannel(trackId: string, type: InstrumentType): ChannelStrip | null {
    if (!this.isInitialized || !this.masterLimiter) return null;
    let channel = this.channels.get(trackId);
    if (channel) {
      if (channel.type !== type) {
        channel.synth.dispose();
        const newSynth = this.createSynth(type);
        newSynth.connect(channel.filter);
        channel.synth = newSynth;
        channel.type = type;
      }
      return channel;
    }
    const synth = this.createSynth(type);
    const filter = new Tone.Filter({ frequency: SAFE_MODE_CONFIG.FILTER_FREQ, type: 'lowpass', rolloff: -24 });
    const distortion = new Tone.Distortion(0);
    const delay = new Tone.FeedbackDelay("8n", 0.3);
    delay.wet.value = 0;
    const reverb = new Tone.Reverb(1.5);
    reverb.wet.value = 0;
    const panner = new Tone.Panner(0);
    const volume = new Tone.Volume(0);
    synth.connect(filter);
    filter.connect(distortion);
    distortion.connect(delay);
    delay.connect(reverb);
    reverb.connect(volume);
    volume.connect(panner);
    panner.connect(this.masterLimiter);
    const newChannel: ChannelStrip = { type, synth, filter, distortion, delay, reverb, panner, volume };
    this.channels.set(trackId, newChannel);
    return newChannel;
  }

  private getStepsHash(steps: any[]): string {
    try {
      return JSON.stringify(steps.map(s => ({ active: s.active, note: s.note, velocity: s.velocity })));
    } catch {
      return '';
    }
  }

  public updateSequence(tracks: Track[], onStep: (trackId: string, step: number) => void, onGlobalStep: (step: number) => void): void {
    console.log('[AUDIO] updateSequence called with', tracks.length, 'tracks, initialized:', this.isInitialized, 'running:', this.isRunning);
    this.onStepCallback = onStep;
    this.onGlobalStepCallback = onGlobalStep;

    const newTrackIds = new Set(tracks.map(t => t.id));

    // FIX: Stoppare tutti i synth che stanno suonando (evita glitch quando cambia sequenza)
    for (const [id, ch] of this.channels) {
      if (!newTrackIds.has(id)) {
        try {
          if (ch.synth instanceof Tone.PolySynth) {
            ch.synth.triggerRelease();
          }
        } catch (e) {
          console.warn('[AUDIO] Error releasing voices:', e);
        }
      }
    }

    for (const [id] of this.currentTracks) {
      if (!newTrackIds.has(id)) this.cleanupTrack(id);
    }
    tracks.forEach(t => this.currentTracks.set(t.id, t));
    if (!this.isInitialized) {
      console.log('[AUDIO] Engine not initialized, deferring part creation');
      return;
    }

    tracks.forEach(track => {
      const ch = this.getOrCreateChannel(track.id, track.instrument);
      if (!ch) return;
      const volDb = track.volume <= 0.001 ? -100 : 20 * Math.log10(track.volume * 0.8);
      ch.volume.volume.rampTo(volDb, 0.05);
      ch.panner.pan.rampTo(track.pan, 0.05);
      ch.distortion.distortion = Math.min(0.8, 0.4 + (track.distortion / 200));
      ch.distortion.wet.value = Math.min(0.8, track.distortion / 100);
      ch.delay.wet.value = Math.min(0.6, track.delay / 100);
      ch.reverb.wet.value = Math.min(0.5, track.reverb / 100);

      const stepCount = Math.max(1, Math.min(32, track.stepCount || 16));
      const existingPart = this.parts.get(track.id);
      const prevState = this.partStates.get(track.id);
      const currentStepsHash = this.getStepsHash(track.steps);

      if (existingPart) {
        existingPart.mute = track.muted;
      }

      const needsRecreate = !existingPart || !prevState || prevState.stepCount !== stepCount || prevState.stepsHash !== currentStepsHash;

      if (needsRecreate) {
        console.log(`[AUDIO] Recreating part for track ${track.id} (${track.instrument}): stepCount=${stepCount}, hasSteps=${track.steps.length > 0}`);
        if (existingPart) {
          try {
            existingPart.stop();
            existingPart.dispose();
          } catch (e) {
            console.warn('[AUDIO] Error disposing old part:', e);
          }
        }

        const events = Array.from({ length: stepCount }, (_, i) => ({ time: `0:${i}:0`, stepIdx: i }));
        const trackId = track.id;
        
        const part = new Tone.Part((time, event) => {
          const currentTrack = this.currentTracks.get(trackId);
          if (!currentTrack || currentTrack.muted) return;
          
          if (this.onStepCallback) {
            Tone.Draw.schedule(() => this.onStepCallback!(trackId, event.stepIdx), time);
          }
          
          const step = currentTrack.steps[event.stepIdx];
          if (step && step.active) {
            const instDef = INSTRUMENTS.find(i => i.id === currentTrack.instrument);
            const channel = this.channels.get(trackId);
            if (channel && instDef) {
              const noteToPlay = step.note || instDef.defaultNote || 'C2';
              const velocity = (step.velocity ?? 100) / 100;
              const synth = channel.synth;
              try {
                if (synth instanceof Tone.MembraneSynth) {
                  synth.triggerAttackRelease(noteToPlay, '8n', time, velocity);
                } else if (synth instanceof Tone.NoiseSynth) {
                  synth.triggerAttackRelease('8n', time, velocity);
                } else if (synth instanceof Tone.MetalSynth) {
                  synth.triggerAttackRelease(noteToPlay, '16n', time, velocity);
                } else if (synth instanceof Tone.PolySynth) {
                  synth.triggerAttackRelease(noteToPlay, '8n', time, velocity);
                } else if (synth instanceof Tone.Synth) {
                  synth.triggerAttackRelease(noteToPlay, '8n', time, velocity);
                }
              } catch (e) {}
            }
          }
        }, events);
        
        part.loop = true;
        part.loopEnd = `0:${stepCount}:0`;
        part.mute = track.muted;
        
        if (this.isRunning) {
          try {
            part.start(0);
          } catch (e) {
            console.warn('[AUDIO] Error starting new part:', e);
          }
        }
        
        this.parts.set(track.id, part);
        this.partStates.set(track.id, { stepCount, stepsHash: currentStepsHash });
        console.log(`[AUDIO] Part created for track ${track.id} with ${stepCount} steps, started=${this.isRunning}`);
      }
    });

    if (!this.masterLoop && this.isInitialized) {
      let globalStep = 0;
      this.masterLoop = new Tone.Loop((time) => {
        if (this.onGlobalStepCallback) {
          Tone.Draw.schedule(() => {
            this.onGlobalStepCallback!(globalStep);
            globalStep = (globalStep + 1) % 16;
          }, time);
        }
      }, "16n");
      if (this.isRunning) {
        try {
          this.masterLoop.start(0);
        } catch (e) {
          console.warn('[AUDIO] Error starting master loop:', e);
        }
      }
    }
  }

  public cleanupTrack(trackId: string): void {
    const ch = this.channels.get(trackId);
    if (ch) {
      try { ch.synth.dispose(); } catch (e) {}
      try { ch.filter.dispose(); } catch (e) {}
      try { ch.distortion.dispose(); } catch (e) {}
      try { ch.delay.dispose(); } catch (e) {}
      try { ch.reverb.dispose(); } catch (e) {}
      try { ch.panner.dispose(); } catch (e) {}
      try { ch.volume.dispose(); } catch (e) {}
      this.channels.delete(trackId);
    }
    const part = this.parts.get(trackId);
    if (part) {
      try { part.stop(); part.dispose(); } catch (e) {}
      this.parts.delete(trackId);
    }
    this.partStates.delete(trackId);
    this.currentTracks.delete(trackId);
  }

  public dispose(): void {
    this.stop();
    for (const trackId of this.channels.keys()) {
      this.cleanupTrack(trackId);
    }
    if (this.masterLimiter) {
      try { this.masterLimiter.dispose(); } catch (e) {}
    }
    if (this.recorder) {
      try { this.recorder.dispose(); } catch (e) {}
    }
    if (this.masterLoop) {
      try { this.masterLoop.dispose(); } catch (e) {}
    }
    this.channels.clear();
    this.parts.clear();
    this.partStates.clear();
    this.currentTracks.clear();
  }

  public async startRecording(): Promise<void> {
    if (!this.recorder) return;
    await this.ensureInitialized();
    this.recorder.start();
  }

  public async stopRecording(): Promise<string> {
    if (!this.recorder) return '';
    const blob = await this.recorder.stop();
    return URL.createObjectURL(blob);
  }

  public getAudioStats() {
    return {
      totalVoices: 0,
      activeVoices: 0,
      activeParts: this.parts.size,
      estimatedCpuLoad: 0,
      isOverloaded: false,
      engine: 'tone.js' as const
    };
  }
}

export const audioEngine = new HybridAudioEngine();
