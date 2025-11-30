import * as Tone from 'tone';
import { Track, INSTRUMENTS, InstrumentType } from './constants';

interface ChannelStrip {
  type: InstrumentType;
  synth: Tone.Instrument<any>;
  distortion: Tone.Distortion;
  delay: Tone.FeedbackDelay;
  reverb: Tone.Reverb;
  panner: Tone.Panner;
  volume: Tone.Volume;
}

interface PartState {
    stepCount: number;
}

class AudioEngine {
  private channels: Map<string, ChannelStrip> = new Map();
  private parts: Map<string, Tone.Part> = new Map();
  private partStates: Map<string, PartState> = new Map();
  private currentTracks: Map<string, Track> = new Map(); // Store latest track data for callbacks
  
  private masterLoop: Tone.Loop | null = null;
  private recorder: Tone.Recorder;

  constructor() {
    this.recorder = new Tone.Recorder();
  }

  public async start() {
    await Tone.start();
    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start();
    }
  }

  public stop() {
    Tone.Transport.stop();
    this.parts.forEach(part => part.stop());
  }

  public setBpm(bpm: number) {
    Tone.Transport.bpm.value = bpm;
  }

  private createSynth(type: InstrumentType): Tone.Instrument<any> {
    switch (type) {
      case 'kick':
        return new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 10,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 }
        });
      case 'tom':
        return new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 4,
          oscillator: { type: 'sine' },
          envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 }
        });
      case 'snare':
      case 'rim':
      case 'clap':
        return new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
        });
      case 'hat':
      case 'open_hat':
      case 'ride':
      case 'crash':
        return new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
          harmonicity: 5.1,
          modulationIndex: 32,
          resonance: 4000,
          octaves: 1.5
        });
      case 'perc':
        return new Tone.MembraneSynth();
      
      // Synths
      case 'sine':
        return new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' } });
      case 'triangle':
        return new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' } });
      case 'square':
        return new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'square' } });
      case 'sawtooth':
        return new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' } });
      
      // Noise
      case 'white':
        return new Tone.NoiseSynth({ noise: { type: 'white' } });
      case 'pink':
        return new Tone.NoiseSynth({ noise: { type: 'pink' } });
      case 'brown':
        return new Tone.NoiseSynth({ noise: { type: 'brown' } });
      
      default:
        return new Tone.Synth();
    }
  }

  private getChannel(trackId: string, type: InstrumentType): ChannelStrip {
    let channel = this.channels.get(trackId);

    // If channel exists but type is different, swap the synth
    if (channel && channel.type !== type) {
        channel.synth.dispose(); // Remove old synth
        const newSynth = this.createSynth(type);
        
        // Reconnect new synth to the existing effects chain
        newSynth.connect(channel.distortion);
        
        // Update channel object
        channel.synth = newSynth;
        channel.type = type;
        return channel;
    }

    if (channel) {
      return channel;
    }

    // Create new channel
    const synth = this.createSynth(type);
    const distortion = new Tone.Distortion(0).toDestination();
    const delay = new Tone.FeedbackDelay("8n", 0.5);
    delay.wet.value = 0;
    const reverb = new Tone.Reverb(1.5);
    reverb.wet.value = 0;
    const panner = new Tone.Panner(0);
    const volume = new Tone.Volume(0);

    // Chain: Synth -> Distortion -> Delay -> Reverb -> Volume -> Panner -> Recorder
    synth.chain(distortion, delay, reverb, volume, panner, this.recorder);
    panner.toDestination();
    panner.connect(this.recorder);

    const newChannel: ChannelStrip = { type, synth, distortion, delay, reverb, panner, volume };
    this.channels.set(trackId, newChannel);
    return newChannel;
  }

  public updateSequence(
    tracks: Track[], 
    onStep: (trackId: string, step: number) => void,
    onGlobalStep: (step: number) => void
  ) {
    // 1. Cleanup removed tracks
    const newTrackIds = new Set(tracks.map(t => t.id));
    for (const [id] of this.currentTracks) {
        if (!newTrackIds.has(id)) {
            this.cleanupTrack(id);
        }
    }

    // 2. Update currentTracks map (Source of Truth for Callbacks)
    tracks.forEach(t => this.currentTracks.set(t.id, t));

    // 3. Process Tracks
    tracks.forEach(track => {
        // --- A. Channel Strip Updates (Real-time, no glitches) ---
        const ch = this.getChannel(track.id, track.instrument);
        
        // Volume
        const volDb = track.volume <= 0.001 ? -100 : 20 * Math.log10(track.volume);
        ch.volume.volume.rampTo(volDb, 0.05); // Smooth ramp
        
        // Pan
        ch.panner.pan.rampTo(track.pan, 0.05);
        
        // Effects
        ch.distortion.distortion = 0.4 + (track.distortion / 200);
        ch.distortion.wet.value = track.distortion / 100;
        ch.delay.wet.value = track.delay / 100;
        ch.reverb.wet.value = track.reverb / 100;

        // --- B. Sequencer Part Management ---
        const stepCount = track.stepCount || 16;
        const existingPart = this.parts.get(track.id);
        const prevState = this.partStates.get(track.id);

        // Determine if we need to recreate the Tone.Part
        // We recreate ONLY if structural timing changes (stepCount)
        // Note/Velocity changes are handled dynamically by the callback reading 'currentTracks'
        const needsRecreate = !existingPart || !prevState || prevState.stepCount !== stepCount;

        // Handle Mute
        if (existingPart) {
            existingPart.mute = track.muted;
        }

        if (needsRecreate) {
            if (existingPart) existingPart.dispose();

            const PPQ = Tone.Transport.PPQ;
            const ticksPerMeasure = PPQ * 4;
            const ticksPerStep = ticksPerMeasure / stepCount;

            // Create events for every step index
            const events = Array.from({ length: stepCount }, (_, i) => ({
                time: Math.round(i * ticksPerStep) + "i",
                stepIdx: i
            }));

            const part = new Tone.Part((time, event) => {
                // DYNAMIC CALLBACK: Reads latest data from currentTracks
                const currentTrack = this.currentTracks.get(track.id);
                if (!currentTrack || currentTrack.muted) return;

                // UI Feedback
                Tone.Draw.schedule(() => {
                    onStep(track.id, event.stepIdx);
                }, time);

                // Audio Trigger
                const step = currentTrack.steps[event.stepIdx];
                if (step && step.active) {
                    const instDef = INSTRUMENTS.find(i => i.id === currentTrack.instrument);
                    // Get channel directly (it's already created/updated in the main loop)
                    const channel = this.channels.get(track.id);
                    
                    if (channel && instDef) {
                        const noteToPlay = step.note || instDef.defaultNote || 'C2';
                        const velocity = (step.velocity ?? 100) / 100;
                        const duration = (ticksPerStep / 2) + "i"; // Half step duration

                        // Trigger logic based on synth type
                        const synth = channel.synth;
                        if (synth instanceof Tone.MembraneSynth || synth instanceof Tone.Synth) {
                             synth.triggerAttackRelease(noteToPlay, '8n', time, velocity);
                        } else if (synth instanceof Tone.NoiseSynth) {
                             synth.triggerAttackRelease('8n', time, velocity);
                        } else if (synth instanceof Tone.MetalSynth) {
                             const dur = (instDef.id.includes('hat') || instDef.id === 'ride') ? '32n' : '8n';
                             synth.triggerAttackRelease(noteToPlay, dur, time, velocity);
                        } else if (synth instanceof Tone.PolySynth) {
                             synth.triggerAttackRelease(noteToPlay, duration, time, velocity);
                        }
                    }
                }
            }, events);

            part.loop = true;
            part.loopEnd = "1m";
            part.start(0);
            
            this.parts.set(track.id, part);
            this.partStates.set(track.id, { stepCount });
        }
    });

    // 4. Master Loop (Global Step) - Create once
    if (!this.masterLoop) {
        let globalStep = 0;
        this.masterLoop = new Tone.Loop((time) => {
            Tone.Draw.schedule(() => {
                onGlobalStep(globalStep);
                globalStep = (globalStep + 1) % 16;
            }, time);
        }, "16n").start(0);
    }
  }

  public cleanupTrack(trackId: string) {
    const ch = this.channels.get(trackId);
    if (ch) {
      ch.synth.dispose();
      ch.distortion.dispose();
      ch.delay.dispose();
      ch.reverb.dispose();
      ch.panner.dispose();
      ch.volume.dispose();
      this.channels.delete(trackId);
    }
    const part = this.parts.get(trackId);
    if (part) {
        part.dispose();
        this.parts.delete(trackId);
    }
    this.partStates.delete(trackId);
    this.currentTracks.delete(trackId);
  }
  
  public async startRecording() {
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

export const audioEngine = new AudioEngine();
