import * as Tone from 'tone';
import { Track, INSTRUMENTS, TOTAL_STEPS } from './constants';

interface ChannelStrip {
  synth: Tone.Instrument<any>;
  distortion: Tone.Distortion;
  delay: Tone.FeedbackDelay;
  reverb: Tone.Reverb;
  panner: Tone.Panner;
  volume: Tone.Volume;
}

class AudioEngine {
  private channels: Map<string, ChannelStrip> = new Map();
  private sequence: Tone.Sequence | null = null;
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
  }

  public setBpm(bpm: number) {
    Tone.Transport.bpm.value = bpm;
  }

  private getChannel(trackId: string, type: string): ChannelStrip {
    if (this.channels.has(trackId)) {
      return this.channels.get(trackId)!;
    }

    // 1. Create Synth
    let synth;
    switch (type) {
      case 'kick':
        synth = new Tone.MembraneSynth();
        break;
      case 'bass':
        synth = new Tone.FMSynth();
        break;
      case 'hat':
        synth = new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
          harmonicity: 5.1,
          modulationIndex: 32,
          resonance: 4000,
          octaves: 1.5
        });
        break;
      case 'clap':
      case 'snare':
        synth = new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
        });
        break;
      case 'lead':
      case 'perc':
        synth = new Tone.PolySynth(Tone.Synth);
        break;
      default:
        synth = new Tone.Synth();
    }

    // 2. Create Effects
    const distortion = new Tone.Distortion(0).toDestination();
    const delay = new Tone.FeedbackDelay("8n", 0.5);
    delay.wet.value = 0;
    const reverb = new Tone.Reverb(1.5);
    reverb.wet.value = 0;
    const panner = new Tone.Panner(0);
    const volume = new Tone.Volume(0);

    // 3. Chain: Synth -> Distortion -> Delay -> Reverb -> Volume -> Panner -> Recorder
    synth.chain(distortion, delay, reverb, volume, panner, this.recorder);
    panner.toDestination();
    panner.connect(this.recorder);

    const channel: ChannelStrip = { synth, distortion, delay, reverb, panner, volume };
    this.channels.set(trackId, channel);
    return channel;
  }

  public updateSequence(tracks: Track[], currentStepCallback: (step: number) => void) {
    if (this.sequence) {
      this.sequence.dispose();
    }

    // Update effects/volume for all tracks immediately
    tracks.forEach(track => {
        if (this.channels.has(track.id)) {
            const ch = this.channels.get(track.id)!;
            
            // Update Master Track Volume
            const volDb = track.volume <= 0.01 ? -100 : 20 * Math.log10(track.volume);
            ch.volume.volume.rampTo(volDb, 0.1);
            
            // Update Pan
            ch.panner.pan.rampTo(track.pan, 0.1);

            // Update Effects
            ch.distortion.distortion = 0.4 + (track.distortion / 200);
            ch.distortion.wet.value = track.distortion / 100;
            ch.delay.wet.value = track.delay / 100;
            ch.reverb.wet.value = track.reverb / 100;
        }
    });

    const steps = Array.from({ length: TOTAL_STEPS }, (_, i) => i);

    this.sequence = new Tone.Sequence((time, step) => {
      Tone.Draw.schedule(() => {
        currentStepCallback(step);
      }, time);

      tracks.forEach(track => {
        if (track.muted) return;
        
        const trackStep = track.steps[step];
        if (trackStep && trackStep.active) {
          const instDef = INSTRUMENTS.find(i => i.id === track.instrument);
          if (!instDef) return;

          const ch = this.getChannel(track.id, track.instrument);
          const synth = ch.synth;
          
          const noteToPlay = trackStep.note || instDef.defaultNote || 'C2';
          const velocity = (trackStep.velocity ?? 100) / 100; // Normalize 1-100 to 0-1

          if (instDef.id === 'kick') {
            (synth as Tone.MembraneSynth).triggerAttackRelease(noteToPlay, '8n', time, velocity);
          } else if (instDef.id === 'bass') {
            (synth as Tone.FMSynth).triggerAttackRelease(noteToPlay, '8n', time, velocity);
          } else if (instDef.id === 'hat') {
             // MetalSynth needs note/freq. '32n' is duration.
            (synth as Tone.MetalSynth).triggerAttackRelease(noteToPlay, '32n', time, velocity);
          } else if (instDef.id === 'clap' || instDef.id === 'snare') {
             // NoiseSynth takes (duration, time, velocity)
            (synth as Tone.NoiseSynth).triggerAttackRelease('8n', time, velocity);
          } else if (instDef.id === 'lead' || instDef.id === 'perc') {
             (synth as Tone.PolySynth).triggerAttackRelease(noteToPlay, '16n', time, velocity);
          } else {
            (synth as Tone.Synth).triggerAttackRelease(noteToPlay, '8n', time, velocity);
          }
        }
      });
    }, steps, "16n").start(0);
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
