/**
 * Web Audio API Procedural Sound Synthesizer
 * Generates authentic paper-tearing friction bursts, eye-ignition fire crackles,
 * and tactile remote control clicks without external audio files.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private fireGain: GainNode | null = null;
  private isInitialized: boolean = false;

  private ensureContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && !this.isInitialized) {
      this.setupAmbientFireNode(this.ctx);
      this.isInitialized = true;
    }
    return this.ctx;
  }

  private setupAmbientFireNode(ctx: AudioContext) {
    try {
      // Create a continuous pink/crackle noise buffer for eye fire ignition
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        // Add random high-frequency spark crackles
        const crackle = Math.random() > 0.996 ? (Math.random() * 2 - 1) * 1.8 : 0;
        data[i] = ((b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04) + crackle * 0.25;
        b6 = white * 0.115926;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 320;
      filter.Q.value = 0.9;

      const gain = ctx.createGain();
      gain.gain.value = 0.0;

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();

      this.fireGain = gain;
    } catch {
      // Ignore audio restrictions until user gesture
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.fireGain && this.ctx) {
      this.fireGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Modulates the continuous fire roar/crackle as the boy's eyes ignite on mouse movement
   */
  public updateEyeFireIntensity(intensity: number) {
    if (this.isMuted || !this.fireGain || !this.ctx || this.ctx.state !== 'running') return;
    const clamped = Math.max(0, Math.min(1, intensity));
    const targetGain = Math.pow(clamped, 1.8) * 0.14;
    this.fireGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
  }

  /**
   * Synthesizes a realistic fibrous paper tearing / ripping sound effect
   */
  public playPaperRipSound(durationSec: number = 0.75, pitchMultiplier: number = 1.0) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const sampleCount = Math.floor(ctx.sampleRate * durationSec);
      const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
      const output = buffer.getChannelData(0);

      // Fibrous paper tear has irregular micro-snaps of cellulose fibers
      for (let i = 0; i < sampleCount; i++) {
        const progress = i / sampleCount;
        // Jagged envelope mimicking uneven hand-ripping speed
        const tearBurst =
          Math.sin(progress * Math.PI) *
          (0.65 + 0.35 * Math.sin(progress * 42.0) * Math.cos(progress * 19.0));
        const fiberSnap = Math.random() > 0.85 ? (Math.random() * 2 - 1) * 1.4 : (Math.random() * 2 - 1) * 0.55;
        output[i] = fiberSnap * tearBurst;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      // Sweeping bandpass filter that rises in frequency like a tearing sheet
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(900 * pitchMultiplier, now);
      bandpass.frequency.exponentialRampToValueAtTime(2800 * pitchMultiplier, now + durationSec * 0.85);
      bandpass.Q.value = 1.6;

      // High-shelf crispness for paper edges
      const highshelf = ctx.createBiquadFilter();
      highshelf.type = 'highshelf';
      highshelf.frequency.value = 3600;
      highshelf.gain.value = 8;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.32, now + 0.06);
      gain.gain.setValueAtTime(0.28, now + durationSec * 0.75);
      gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

      source.connect(bandpass);
      bandpass.connect(highshelf);
      highshelf.connect(gain);
      gain.connect(ctx.destination);

      source.start(now);
      source.stop(now + durationSec);
    } catch {
      // Ignore if blocked
    }
  }

  /**
   * Short paper scratch sound when ripping with mouse drag
   */
  public playScratchTearGrain() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.playPaperRipSound(0.14, 1.35 + Math.random() * 0.3);
  }

  /**
   * Tactile remote button click sound
   */
  public playRemoteClick() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.045);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // Ignore
    }
  }
}

export const soundEngine = new SoundEngine();
