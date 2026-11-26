/**
 * Procedural Web Audio foley synthesizer for CHENHUI Studio.
 * Zero external audio files — generates tactile rope twangs, wooden clothespin
 * clicks, cotton paper rustles, and realistic 3D book page turns on the fly.
 */

export class StudioSound {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private vinylCrackBuffer: AudioBuffer | null = null;
  private vinylLoopSrc: AudioBufferSourceNode | null = null;
  private vinylLoopGain: GainNode | null = null;
  public enabled = true;

  constructor() {
    try {
      const saved = localStorage.getItem("studio-sound");
      if (saved === "off") this.enabled = false;
    } catch {
      // ignore storage errors
    }
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem("studio-sound", this.enabled ? "on" : "off");
    } catch {
      // ignore
    }
    if (this.enabled) {
      this.clipClick();
    }
    return this.enabled;
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (typeof window === "undefined") return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    if (!this.noiseBuffer && this.ctx) {
      const sr = this.ctx.sampleRate;
      const len = Math.floor(sr * 0.6);
      const buf = this.ctx.createBuffer(1, len, sr);
      const data = buf.getChannelData(0);
      // Warm pink-tinted noise
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.95 * b2 + white * 0.048;
        data[i] = (b0 + b1 + b2 + white * 0.18) * 0.6;
      }
      this.noiseBuffer = buf;
    }
    return this.ctx;
  }

  /** Soft wooden clothespin snap */
  public clipClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(165, now + 0.045);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  /** Gentle linen rope pluck; pitch varies with normalized horizontal position u in [0, 1] */
  public ropePluck(u = 0.5, intensity = 0.6): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const clamped = Math.max(0.15, Math.min(1, intensity));
    // Warm low-mid guitar-like string range (110Hz - 210Hz)
    const freq = 118 + Math.sin(u * Math.PI) * 58 + (Math.random() - 0.5) * 8;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq * 1.04, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.09);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(920, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + 0.36);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09 * clamped, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  /** Soft cotton paper page flip whoosh */
  public pageFlip(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.setValueAtTime(0.95, now);
    filter.frequency.setValueAtTime(460, now);
    filter.frequency.exponentialRampToValueAtTime(1480, now + 0.17);
    filter.frequency.exponentialRampToValueAtTime(380, now + 0.4);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.085);
    gain.gain.exponentialRampToValueAtTime(0.032, now + 0.24);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.44);
  }

  /** Soft paper sheet slide when opening/closing modals */
  public sheetSlide(opening = true): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(opening ? 900 : 1400, now);
    filter.frequency.exponentialRampToValueAtTime(opening ? 1700 : 520, now + 0.18);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.22);
  }

  /** Warm vinyl needle drop (subtle low thump + tiny lacquer crackle) */
  public vinylNeedleDrop(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Gentle stylus touchdown thump
    const osc = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.085);
    thumpGain.gain.setValueAtTime(0.09, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    osc.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);

    // Subtle analog vinyl surface crackle
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.setValueAtTime(1800, now);
      const crackGain = ctx.createGain();
      crackGain.gain.setValueAtTime(0.001, now);
      crackGain.gain.linearRampToValueAtTime(0.032, now + 0.03);
      crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      src.connect(hp);
      hp.connect(crackGain);
      crackGain.connect(ctx.destination);
      src.start(now);
      src.stop(now + 0.2);
    }
  }

  /** Cozy continuous analog vinyl surface crackle loop (toggleable Hi-Fi ambience) */
  public setVinylAmbience(active: boolean): void {
    if (!active) {
      if (this.vinylLoopGain && this.ctx) {
        const now = this.ctx.currentTime;
        this.vinylLoopGain.gain.cancelScheduledValues(now);
        this.vinylLoopGain.gain.setTargetAtTime(0.0001, now, 0.08);
      }
      const oldSrc = this.vinylLoopSrc;
      this.vinylLoopSrc = null;
      this.vinylLoopGain = null;
      if (oldSrc) {
        window.setTimeout(() => {
          try {
            oldSrc.stop();
            oldSrc.disconnect();
          } catch {
            // ignore
          }
        }, 280);
      }
      return;
    }

    if (this.vinylLoopSrc) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (!this.vinylCrackBuffer) {
      const sr = ctx.sampleRate;
      const len = sr * 3;
      const buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      let b0 = 0;
      for (let i = 0; i < len; i++) {
        // Ultra-soft warm vinyl dust hiss + occasional tiny micro-pops
        const w = Math.random() * 2 - 1;
        b0 = 0.98 * b0 + w * 0.025;
        let pop = 0;
        if (Math.random() < 0.00045) {
          pop = (Math.random() * 2 - 1) * 0.34;
        }
        d[i] = b0 * 0.45 + pop;
      }
      this.vinylCrackBuffer = buf;
    }

    const src = ctx.createBufferSource();
    src.buffer = this.vinylCrackBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2400;
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.055, now + 0.35);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);

    this.vinylLoopSrc = src;
    this.vinylLoopGain = gain;
  }
}
