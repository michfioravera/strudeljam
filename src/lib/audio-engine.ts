import * as Tone from 'tone';
import { Track, INSTRUMENTS, TOTAL_STEPS } from './constants';

// Singleton to manage Tone.js resources
class AudioEngine {
  private synths: Map<string, Tone.Synth | Tone.MembraneSynth | Tone.MetalSynth | Tone.NoiseSynth | Tone.PolySynth> = new Map();
  private sequence: Tone.Sequence | null = null;
  private recorder: Tone.Recorder;

  constructor() {
    // Initialize Tone.Recorder
    // This handles the MediaStreamDestination and MediaRecorder logic internally
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

    // Connect to the recorder as well (fan-out)
    // synth.toDestination() connects to Master, we also connect to recorder
    synth.connect(this.recorder);
    
    this.synths.set(trackId, synth);
    return synth;
  }

  public updateSequence(tracks: Track[], currentStepCallback: (step: number) => void) {
    // Dispose old sequence
    if (this.sequence) {
      this.sequence.dispose();
    }

    // Create an array of indices [0, 1, ... 15]
    const steps = Array.from({ length: TOTAL_STEPS }, (_, i) => i);

    this.sequence = new Tone.Sequence((time, step) => {
      // Update UI current step
      Tone.Draw.schedule(() => {
        currentStepCallback(step);
      }, time);

      // Play tracks
      tracks.forEach(track => {
        if (track.muted) return;
        if (track.steps[step]) {
          const instDef = INSTRUMENTS.find(i => i.id === track.instrument);
          if (!instDef) return;

          const synth = this.getSynth(track.id, track.instrument);
          
          // Update Volume
          // Simple approximation: 20 * Math.log10(track.volume) (if volume > 0)
          const volDb = track.volume <= 0.01 ? -100 : 20 * Math.log10(track.volume);
          
          // Safety check for rampTo
          if (synth.volume && synth.volume.rampTo) {
             synth.volume.rampTo(volDb, 0.1);
          }

          // Trigger
          if (instDef.id === 'kick') {
            synth.triggerAttackRelease('C1', '8n', time);
          } else if (instDef.id === 'bass') {
            synth.triggerAttackRelease(instDef.defaultNote || 'C2', '8n', time);
          } else if (instDef.id === 'hat') {
            synth.triggerAttackRelease('32n', time, 0.7); // Velocity
          } else if (instDef.id === 'lead') {
             synth.triggerAttackRelease(instDef.defaultNote || 'C4', '16n', time);
          } else {
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
  
  // Recording
  public async startRecording() {
    // Tone.Recorder.start() is void, but we ensure context is running
    if (Tone.context.state !== 'running') {
        await Tone.start();
    }
    this.recorder.start();
  }

  public async stopRecording(): Promise<string> {
    // Tone.Recorder.stop() returns a Promise<Blob>
    const blob = await this.recorder.stop();
    const url = URL.createObjectURL(blob);
    return url;
  }
}

export const audioEngine = new AudioEngine();
