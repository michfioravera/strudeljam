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
    const distortion = new Tone.Distortion(0).toDestination(); // Wet 0 initially
    const delay = new Tone.FeedbackDelay("8n", 0.5);
    delay.wet.value = 0;
    const reverb = new Tone.Reverb(1.5);
    reverb.wet.value = 0;
    const panner = new Tone.Panner(0);
    const volume = new Tone.Volume(0);

    // 3. Chain: Synth -> Distortion -> Delay -> Reverb -> Volume -> Panner -> Recorder
    // Note: Tone.js chaining. 
    // We need to be careful with connections.
    
    synth.chain(distortion, delay, reverb, volume, panner, this.recorder);
    // Also connect to destination (speakers) via recorder? 
    // Recorder is usually an endpoint, but we want to hear it too.
    // Tone.Recorder doesn't pass audio through by default in some versions, but usually it's a tap.
    // Let's connect Panner to Destination AND Recorder.
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

    // Update effects for all tracks immediately
    tracks.forEach(track => {
        if (this.channels.has(track.id)) {
            const ch = this.channels.get(track.id)!;
            
            // Update Volume
            const volDb = track.volume <= 0.01 ? -100 : 20 * Math.log10(track.volume);
            ch.volume.volume.rampTo(volDb, 0.1);
            
            // Update Pan
            ch.panner.pan.rampTo(track.pan, 0.1);

            // Update Effects (0-100 -> 0-1)
            ch.distortion.distortion = track.distortion / 100;
            ch.distortion.wet.value = track.distortion > 0 ? 1 : 0; // Simple wet/dry logic for distortion often implies amount
            // Actually Tone.Distortion 'distortion' param is amount, wet is mix. 
            // Let's map 0-100 to wetness mostly, but distortion amount is also key.
            // Let's keep distortion amount fixed at 0.8 and control wet, or map both.
            ch.distortion.distortion = 0.4 + (track.distortion / 200); // 0.4 to 0.9
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

          // Ensure channel exists
          const ch = this.getChannel(track.id, track.instrument);
          const synth = ch.synth;
          
          // Note: Volume/Effects are updated outside the loop or could be updated here if we supported per-step automation
          // For now, they are per-track.

          const noteToPlay = trackStep.note || instDef.defaultNote || 'C2';

          if (instDef.id === 'kick') {
            synth.triggerAttackRelease(noteToPlay, '8n', time);
          } else if (instDef.id === 'bass') {
            synth.triggerAttackRelease(noteToPlay, '8n', time);
          } else if (instDef.id === 'hat') {
            synth.triggerAttackRelease('32n', time, 0.7);
          } else if (instDef.id === 'lead') {
             synth.triggerAttackRelease(noteToPlay, '16n', time);
          } else {
            synth.triggerAttackRelease('8n', time);
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
