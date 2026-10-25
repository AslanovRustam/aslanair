import type { Ambience, OneShot } from './mix';
import { ding, gust, hum, rustle } from './synth';

/** The recordings (public/sounds, Creative Commons 0 — its CREDITS.md), fetched only once sound has started. */
export const SOUND_FILES = {
  airport: '/sounds/airport-crowd.mp3',
  cabin: '/sounds/cabin-cruise.mp3',
  announcement: '/sounds/boarding-announcement.mp3',
  music: '/sounds/night-music.mp3',
} as const;
/** The light music under it all (the author, 2026-10-25), and how far it steps back while a boarding call speaks. */
const MUSIC = { level: 0.5, under: 0.2 };
/** The rate the synthesised sounds are rendered at: plenty for wind, a chime and paper, and quick to render. */
const RATE = 24000;
/** An MP3's encoder padding at either end (s), kept out of a loop. */
const PADDING = 0.06;
/** Seconds the beds take to follow the scroll (setTargetAtTime's time constant). */
const FOLLOW = 0.25;
/** Seconds a mute or unmute takes. */
const MUTE = 0.08;

type Bed = keyof Ambience;

/**
 * The Web Audio graph: three looping beds — the terminal's crowd and the cabin in flight (recordings), the night air
 * (synthesised) — the boarding calls, which play through the airport's bed and so leave with it, light music under it
 * all, and synthesised one-shots, all into a master gain. Made only inside a visitor's gesture (the browser's rule,
 * spec §4.7).
 */
export class SoundEngine {
  private readonly master: GainNode;
  private readonly beds: Record<Bed, GainNode>;
  private readonly music: GainNode;
  private readonly shots: Record<OneShot, AudioBuffer>;
  private announcement: AudioBuffer | null = null;
  private calling = false;
  private closed = false;

  constructor(private readonly ctx: AudioContext) {
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    const bed = () => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.master);
      return g;
    };
    this.beds = { airport: bed(), cabin: bed(), outside: bed() };
    this.music = bed();
    this.music.gain.value = MUSIC.level;
    const synth = (samples: Float32Array) => {
      const b = ctx.createBuffer(1, samples.length, RATE);
      b.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
      return b;
    };
    this.loop(synth(hum(8, RATE, 1)), this.beds.outside, 0);
    this.shots = { ding: synth(ding(RATE)), rustle: synth(rustle(RATE, 3)), gust: synth(gust(RATE, 4)) };
    void this.load();
  }

  /** Fetches the recordings, each on its own: one that fails to arrive leaves the others playing. */
  private async load() {
    const get = async (url: string): Promise<AudioBuffer | null> => {
      try {
        const response = await fetch(url);
        return response.ok ? await this.ctx.decodeAudioData(await response.arrayBuffer()) : null;
      } catch {
        return null;
      }
    };
    const [airport, cabin, announcement, music] = await Promise.all([
      get(SOUND_FILES.airport),
      get(SOUND_FILES.cabin),
      get(SOUND_FILES.announcement),
      get(SOUND_FILES.music),
    ]);
    if (this.closed) return;
    if (airport) this.loop(airport, this.beds.airport, PADDING);
    if (cabin) this.loop(cabin, this.beds.cabin, PADDING);
    if (music) this.loop(music, this.music, PADDING);
    this.announcement = announcement;
  }

  /** Plays `buffer` round and round into `into`, `trim` s of each end left out. */
  private loop(buffer: AudioBuffer, into: GainNode, trim: number) {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = trim;
    source.loopEnd = buffer.duration - trim;
    source.connect(into);
    source.start(0, trim);
  }

  /** Follows the beds to `a` over a quarter of a second. */
  setAmbience(a: Ambience) {
    const now = this.ctx.currentTime;
    for (const name of Object.keys(this.beds) as Bed[]) this.beds[name].gain.setTargetAtTime(a[name], now, FOLLOW);
  }

  /** A boarding call over the terminal, unless one is still playing or the recording has not arrived: false then. */
  announce(): boolean {
    if (!this.announcement || this.calling) return false;
    const source = this.ctx.createBufferSource();
    source.buffer = this.announcement;
    source.connect(this.beds.airport);
    // the music steps back while the call speaks
    const now = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(MUSIC.under, now, 0.3);
    this.music.gain.setTargetAtTime(MUSIC.level, now + this.announcement.duration, 0.6);
    source.onended = () => (this.calling = false);
    this.calling = true;
    source.start();
    return true;
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
    this.closed = true;
    void this.ctx.close();
  }

  /** Lets the audio device rest while the tab is hidden. */
  setAwake(awake: boolean) {
    void (awake ? this.ctx.resume() : this.ctx.suspend());
  }
}
