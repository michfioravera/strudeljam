import * as Tone from 'tone';
import { Track, INSTRUMENTS, TOTAL_STEPS } from './constants';

class AudioEngine {
  private synths: Map<string, Tone.Synth | Tone.MembraneSynth | Tone.MetalSynth | Tone.NoiseSynth | Tone.PolySynth> = new Map();
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

  private getSynth(trackId: string, type: string): any {
    if (this.synths.has(trackId)) {
      return this.synths.get(trackId);
    }

    let synth;
    switch (type) {
      case 'kick':
        synth = new Tone.MembraneSynth().toDestination();
        break;
      case 'bass':
        synth = new Tone.FMSynth().toDestination();
        break;
      case 'hat':
        synth = new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
          harmonicity: 5.1,
          modulationIndex: 32,
          resonance: 4000,
          octaves: 1.5
        }).toDestination();
        break;
      case 'clap':
      case 'snare':
        synth = new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
        }).toDestination();
        break;
      case 'lead':
      case 'perc':
        synth = new Tone.PolySynth(Tone.Synth).toDestination();
        break;
      default:
        synth = new Tone.Synth().toDestination();
    }

    synth.connect(this.recorder);
    this.synths.set(trackId, synth);
    return synth;
  }

  public updateSequence(tracks: Track[], currentStepCallback: (step: number) => void) {
    if (this.sequence) {
      this.sequence.dispose();
    }

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

          const synth = this.getSynth(track.id, track.instrument);
          
          const volDb = track.volume <= 0.01 ? -100 : 20 * Math.log10(track.volume);
          if (synth.volume && synth.volume.rampTo) {
             synth.volume.rampTo(volDb, 0.1);
          }

          // Use the specific note from the step, fallback to default
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
            // Noise synths (clap, snare) ignore note usually, but we pass duration
            synth.triggerAttackRelease('8n', time);
          }
        }
      });
    }, steps, "16n").start(0);
  }

  public cleanupTrack(trackId: string) {
    const synth = this.synths.get(trackId);
    if (synth) {
      synth.dispose();
      this.synths.delete(trackId);
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
