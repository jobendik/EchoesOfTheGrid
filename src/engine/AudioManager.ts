import type { AssetKey } from "../core/Types.js";

/**
 * Tiny Web Audio manager. Placeholder sounds are synthesized tones — the
 * AssetManager can swap them for real audio files later by setting
 * `productionPath` in the asset manifest.
 */

type ToneShape = "sine" | "triangle" | "square" | "sawtooth";

interface TonePreset {
  freq: number;
  duration: number;
  shape: ToneShape;
  gain: number;
  /** Optional frequency ramp end target for simple blips. */
  rampTo?: number;
}

const PRESETS: Record<string, TonePreset> = {
  cardHover: { freq: 520, duration: 0.05, shape: "sine", gain: 0.05 },
  cardSelect: { freq: 680, duration: 0.06, shape: "triangle", gain: 0.08 },
  cardPlay: { freq: 440, duration: 0.15, shape: "triangle", gain: 0.12, rampTo: 220 },
  invalid: { freq: 120, duration: 0.12, shape: "square", gain: 0.08 },
  hit: { freq: 180, duration: 0.12, shape: "square", gain: 0.14, rampTo: 80 },
  shieldGain: { freq: 420, duration: 0.18, shape: "sine", gain: 0.1, rampTo: 640 },
  heal: { freq: 540, duration: 0.22, shape: "sine", gain: 0.1, rampTo: 740 },
  enemyAttack: { freq: 260, duration: 0.14, shape: "sawtooth", gain: 0.12, rampTo: 160 },
  enemyDeath: { freq: 120, duration: 0.3, shape: "sawtooth", gain: 0.16, rampTo: 60 },
  reward: { freq: 720, duration: 0.24, shape: "triangle", gain: 0.14, rampTo: 940 },
  mapNode: { freq: 600, duration: 0.08, shape: "triangle", gain: 0.08 },
  victory: { freq: 440, duration: 0.5, shape: "triangle", gain: 0.16, rampTo: 880 },
  defeat: { freq: 220, duration: 0.6, shape: "sawtooth", gain: 0.18, rampTo: 100 },
  turnStart: { freq: 340, duration: 0.06, shape: "sine", gain: 0.06 },
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private volume = 0.8;
  private sfxVolume = 1;
  private musicVolume = 0.6;
  private musicTimer: number | null = null;

  constructor() {
    // Defer creation until first user gesture (browser autoplay policy).
  }

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

  setSfxVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
  }

  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
  }

  startMusic(): void {
    if (typeof window === "undefined" || this.musicTimer !== null) return;
    this.musicTimer = window.setInterval(() => this.playMusicPulse(), 2200);
    this.playMusicPulse();
  }

  stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private playMusicPulse(): void {
    if (this.muted || this.musicVolume <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    const notes = [130.81, 196.0, 261.63];
    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(notes[i], t0 + i * 0.08);
      gain.gain.setValueAtTime(0.0001, t0 + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.035 * this.musicVolume), t0 + i * 0.08 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.08 + 1.2);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0 + i * 0.08);
      osc.stop(t0 + i * 0.08 + 1.25);
    }
  }

  /**
   * Play an audio asset by key. Key can be "audio.cardPlay" or just
   * "cardPlay". If the asset isn't mapped to a preset, nothing plays.
   */
  play(key: AssetKey | string): void {
    if (this.muted) return;
    const name = key.includes(".") ? key.split(".")[1] : key;
    const preset = PRESETS[name];
    if (!preset) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = preset.shape;
    osc.frequency.setValueAtTime(preset.freq, t0);
    if (preset.rampTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, preset.rampTo), t0 + preset.duration);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, preset.gain * this.sfxVolume), t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + preset.duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + preset.duration + 0.02);
  }
}

export const audio = new AudioManager();
