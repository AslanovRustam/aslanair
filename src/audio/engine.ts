import type { Ambience, OneShot } from './mix';
import { ding, gust, hum, rustle } from './synth';

/** The rate the sounds are rendered at: plenty for a hum, a chime and noise, and quick to render. */
const RATE = 24000;
/** Seconds the beds take to follow the scroll (setTargetAtTime's time constant). */
const FOLLOW = 0.25;
/** Seconds a mute or unmute takes. */
const MUTE = 0.08;

/**
 * The Web Audio graph: two looping hum beds — outside dry, the cabin's through a low-pass — and one-shot buffers,
 * all into a master gain. Made only inside a visitor's gesture (the browser's rule, spec §4.7); everything is
 * rendered once then (synth.ts) and only played after.
 */
export class SoundEngine {
  private readonly master: GainNode;
  private readonly outside: GainNode;
  private readonly cabin: GainNode;
  private readonly muffle: BiquadFilterNode;
  private readonly shots: Record<OneShot, AudioBuffer>;

  constructor(private readonly ctx: AudioContext) {
    const buffer = (samples: Float32Array) => {
      const b = ctx.createBuffer(1, samples.length, RATE);
      b.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
      return b;
    };
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.outside = ctx.createGain();
    this.cabin = ctx.createGain();
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.outside.gain.value = this.cabin.gain.value = 0;
    this.outside.connect(this.master);
    this.cabin.connect(this.muffle).connect(this.master);
    // two seeds, so the cabin's hum is not the outside's played muffled in step
    for (const [seed, bed] of [[1, this.outside], [2, this.cabin]] as const) {
      const loop = ctx.createBufferSource();
      loop.buffer = buffer(hum(8, RATE, seed));
      loop.loop = true;
      loop.connect(bed);
      loop.start();
    }
    this.shots = { ding: buffer(ding(RATE)), rustle: buffer(rustle(RATE, 3)), gust: buffer(gust(RATE, 4)) };
  }

  /** Follows the beds to `a` over a quarter of a second. */
  setAmbience(a: Ambience) {
    const now = this.ctx.currentTime;
    this.outside.gain.setTargetAtTime(a.outside, now, FOLLOW);
    this.cabin.gain.setTargetAtTime(a.cabin, now, FOLLOW);
    this.muffle.frequency.setTargetAtTime(a.cabinCutoffHz, now, FOLLOW);
  }

  play(shot: OneShot) {
    const source = this.ctx.createBufferSource();
    source.buffer = this.shots[shot];
    source.connect(this.master);
    source.start();
  }

  /** Mutes at once (a short ramp, no click) or brings the sound back. */
  setMuted(muted: boolean) {
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(muted ? 0 : 1, now + MUTE);
  }

  close() {
    void this.ctx.close();
  }

  /** Lets the audio device rest while the tab is hidden. */
  setAwake(awake: boolean) {
    void (awake ? this.ctx.resume() : this.ctx.suspend());
  }
}
