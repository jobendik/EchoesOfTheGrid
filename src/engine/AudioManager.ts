import type { AssetKey } from "../core/Types.js";

type ToneShape = "sine" | "triangle" | "square" | "sawtooth";

interface TonePreset {
  freq: number;
  duration: number;
  shape: ToneShape;
  gain: number;
  rampTo?: number;
  /** Optional second oscillator freq for richer tones. */
  freq2?: number;
  /** Attack time in seconds. */
  attack?: number;
}

const PRESETS: Record<string, TonePreset> = {
  cardHover:    { freq: 520,  duration: 0.05, shape: "sine",     gain: 0.05 },
  cardSelect:   { freq: 680,  duration: 0.07, shape: "triangle", gain: 0.09, rampTo: 780 },
  cardPlay:     { freq: 440,  duration: 0.18, shape: "triangle", gain: 0.13, rampTo: 220, freq2: 660 },
  invalid:      { freq: 120,  duration: 0.14, shape: "square",   gain: 0.08 },
  hit:          { freq: 200,  duration: 0.14, shape: "square",   gain: 0.15, rampTo: 90,  freq2: 140 },
  shieldGain:   { freq: 420,  duration: 0.22, shape: "sine",     gain: 0.11, rampTo: 680, freq2: 840 },
  heal:         { freq: 540,  duration: 0.26, shape: "sine",     gain: 0.10, rampTo: 820, freq2: 1080, attack: 0.04 },
  enemyAttack:  { freq: 240,  duration: 0.16, shape: "sawtooth", gain: 0.13, rampTo: 140 },
  enemyDeath:   { freq: 140,  duration: 0.35, shape: "sawtooth", gain: 0.17, rampTo: 55 },
  reward:       { freq: 660,  duration: 0.28, shape: "triangle", gain: 0.15, rampTo: 990, freq2: 880, attack: 0.02 },
  mapNode:      { freq: 600,  duration: 0.09, shape: "triangle", gain: 0.08 },
  victory:      { freq: 440,  duration: 0.55, shape: "triangle", gain: 0.17, rampTo: 880, freq2: 550, attack: 0.03 },
  defeat:       { freq: 220,  duration: 0.65, shape: "sawtooth", gain: 0.18, rampTo: 80 },
  turnStart:    { freq: 360,  duration: 0.07, shape: "sine",     gain: 0.06, freq2: 480 },
  movement:     { freq: 480,  duration: 0.10, shape: "triangle", gain: 0.07, rampTo: 360 },
  statusApply:  { freq: 380,  duration: 0.12, shape: "sine",     gain: 0.07, rampTo: 560 },
  exhaust:      { freq: 320,  duration: 0.18, shape: "triangle", gain: 0.08, rampTo: 180 },
  relicTrigger: { freq: 720,  duration: 0.16, shape: "sine",     gain: 0.09, rampTo: 900, freq2: 1080 },
};

// Pentatonic-minor arpeggio notes (Hz) for the background music layers.
// Root: C minor pentatonic — C3, Eb3, F3, G3, Bb3
const MELODY_NOTES = [130.81, 155.56, 174.61, 196.00, 233.08];
// Bass pulses on root / fifth
const BASS_NOTES   = [65.41, 98.00, 65.41, 87.31];
// High shimmer on 5th / octave
const SHIMMER_NOTES = [392.00, 466.16, 523.25, 392.00];

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private volume = 0.8;
  private sfxVolume = 1;
  private musicVolume = 0.6;
  private musicTimer: number | null = null;
  private musicPhase = 0;

  constructor() {}

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.ctx) return this.ctx;
    const AC: typeof AudioContext | undefined =
      (window.AudioContext as typeof AudioContext | undefined) ??
      ((window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AC) return null;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      return this.ctx;
    } catch {
      return null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && !this.muted) this.master.gain.value = this.volume;
  }

  setSfxVolume(v: number): void { this.sfxVolume = Math.max(0, Math.min(1, v)); }
  setMusicVolume(v: number): void { this.musicVolume = Math.max(0, Math.min(1, v)); }

  startMusic(): void {
    if (typeof window === "undefined" || this.musicTimer !== null) return;
    // Beat interval: 1.8 s. 4 beats per measure.
    this.musicTimer = window.setInterval(() => this.tickMusic(), 1800);
    this.tickMusic();
  }

  stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  /** Four-beat music engine: bass / melody / shimmer alternate each tick. */
  private tickMusic(): void {
    if (this.muted || this.musicVolume <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    const mv = this.musicVolume;
    const beat = this.musicPhase % 4;

    // Bass on every beat
    this.mNote(ctx, t0, BASS_NOTES[beat], 1.4, "sine", 0.040 * mv);

    // Melody arpeggio: two notes per tick, offset slightly
    const mel1 = MELODY_NOTES[(this.musicPhase) % MELODY_NOTES.length];
    const mel2 = MELODY_NOTES[(this.musicPhase + 2) % MELODY_NOTES.length];
    this.mNote(ctx, t0 + 0.05, mel1, 1.1, "triangle", 0.022 * mv);
    this.mNote(ctx, t0 + 0.40, mel2, 0.9, "triangle", 0.018 * mv);

    // Shimmer accent on beat 0 and 2
    if (beat === 0 || beat === 2) {
      const sh = SHIMMER_NOTES[(this.musicPhase / 2) % SHIMMER_NOTES.length];
      this.mNote(ctx, t0 + 0.10, sh, 0.7, "sine", 0.012 * mv);
    }

    // Pad chord stab on beat 1 and 3 — minor triad (root, minor-third, fifth)
    if (beat === 1 || beat === 3) {
      const base = MELODY_NOTES[0] * 2; // C4
      this.mNote(ctx, t0,        base,          1.6, "sine", 0.015 * mv);
      this.mNote(ctx, t0 + 0.02, base * 1.1892, 1.6, "sine", 0.012 * mv); // minor third
      this.mNote(ctx, t0 + 0.04, base * 1.4983, 1.6, "sine", 0.010 * mv); // perfect fifth
    }

    this.musicPhase++;
  }

  private mNote(ctx: AudioContext, t: number, freq: number, dur: number, shape: OscillatorType, peakGain: number): void {
    if (!this.master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = shape;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peakGain), t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  play(key: AssetKey | string): void {
    if (this.muted) return;
    const name = key.includes(".") ? key.split(".").pop()! : key;
    const preset = PRESETS[name];
    if (!preset) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    const attack = preset.attack ?? 0.01;

    const playOsc = (freq: number): void => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = preset.shape;
      osc.frequency.setValueAtTime(freq, t0);
      if (preset.rampTo !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, preset.rampTo), t0 + preset.duration);
      }
      const peak = Math.max(0.0001, preset.gain * this.sfxVolume);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + preset.duration);
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start(t0);
      osc.stop(t0 + preset.duration + 0.05);
    };

    playOsc(preset.freq);
    if (preset.freq2) playOsc(preset.freq2 * 0.5); // sub-octave for richness
  }
}

export const audio = new AudioManager();
