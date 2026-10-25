import { mulberry32 } from '@/experience/random';

/**
 * The night's sounds, synthesised (spec §4.7; no audio files): mono samples at `sr` Hz, deterministic for a seed,
 * peaking at PEAK at most. Rendered once when sound first starts, then played from buffers (engine.ts).
 */
const PEAK = 0.85;

/** Scales `x` so its loudest sample is PEAK. */
function normalise(x: Float32Array): Float32Array {
  let m = 0;
  for (const v of x) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < x.length; i++) x[i] *= PEAK / m;
  return x;
}

/** A band-pass biquad (RBJ cookbook, constant 0 dB peak gain) run over `x` in place. */
function bandPass(x: Float32Array, sr: number, hz: number, q: number): Float32Array {
  const w = (2 * Math.PI * hz) / sr;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const [b0, b2, a1, a2] = [alpha / a0, -alpha / a0, (-2 * Math.cos(w)) / a0, (1 - alpha) / a0];
  let [x1, x2, y1, y2] = [0, 0, 0, 0];
  for (let i = 0; i < x.length; i++) {
    const y = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2;
    [x2, x1, y2, y1] = [x1, x[i], y1, y];
    x[i] = y;
  }
  return x;
}

/** White noise in [-1, 1). */
function noise(n: number, seed: number): Float32Array {
  const rnd = mulberry32(seed);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = rnd() * 2 - 1;
  return x;
}

/**
 * The cruise: brown noise (white, integrated with a leak — the low roar of air and engines) under a slow 0.13 Hz
 * swell. It loops: its last 50 ms are cross-faded into its start, so the loop's seam is two neighbouring samples.
 */
export function hum(seconds: number, sr: number, seed: number): Float32Array {
  const n = Math.round(seconds * sr);
  const fade = Math.round(0.05 * sr);
  const white = noise(n + fade, seed);
  const raw = new Float32Array(n + fade);
  let level = 0;
  for (let i = 0; i < raw.length; i++) {
    level = level * 0.996 + white[i] * 0.04;
    raw[i] = level * (0.8 + 0.2 * Math.sin((2 * Math.PI * 0.13 * i) / sr));
  }
  const out = raw.slice(0, n);
  // the start becomes the run-on of the end: the sample before it is raw[n − 1], after the seam raw[n]
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    out[i] = raw[n + i] * (1 - k) + raw[i] * k;
  }
  return normalise(out);
}

/** The seat-belt chime: two tones, E6 then B5 as one strike, ringing out over 1.4 s. */
export function ding(sr: number): Float32Array {
  const n = Math.round(1.4 * sr);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const attack = Math.min(1, t / 0.004);
    out[i] = attack * Math.exp(-t * 3.6) * (0.6 * Math.sin(2 * Math.PI * 1318.5 * t) + 0.4 * Math.sin(2 * Math.PI * 987.8 * t));
  }
  return normalise(out);
}

/** Paper: 0.35 s of short bursts of band-passed noise, the card turning over. */
export function rustle(sr: number, seed: number): Float32Array {
  const n = Math.round(0.35 * sr);
  const out = bandPass(noise(n, seed), sr, 3200, 0.9);
  const rnd = mulberry32(seed + 1);
  // a few crackles, each a quick swell, over a soft bed
  const bursts = Array.from({ length: 6 }, () => ({ at: rnd() * 0.3, width: 0.015 + rnd() * 0.03 }));
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let env = 0.12;
    for (const b of bursts) env += Math.exp(-(((t - b.at) / b.width) ** 2));
    out[i] *= env * Math.min(1, (0.35 - t) / 0.05);
  }
  return normalise(out);
}

/** The wind as the window opens onto the night: 2.2 s of noise in a 300–1800 Hz band, swelling and dying away. */
export function gust(sr: number, seed: number): Float32Array {
  const n = Math.round(2.2 * sr);
  const out = bandPass(noise(n, seed), sr, Math.sqrt(300 * 1800), Math.sqrt(300 * 1800) / (1800 - 300));
  for (let i = 0; i < n; i++) {
    const u = i / n;
    out[i] *= Math.sin(Math.PI * u) ** 2;
  }
  return normalise(out);
}
