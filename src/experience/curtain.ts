import { MathUtils } from 'three';

/**
 * The chapter transition (spec r4 §7, after demo.promo's Liquid): a curtain with a bulging "liquid" edge rises over
 * the screen — a terracotta layer leading, the night's dark following — our plane flies down across it while the
 * page jumps underneath, and once the chapter is ready the curtain leaves upward. Seconds.
 */
export const CURTAIN = { cover: 0.45, accentLead: 0.08, flight: 0.75, reveal: 0.5, fade: 0.15 } as const;

/** The camera layer that holds only the curtain's plane (and the lights) while the screen is covered. */
export const CURTAIN_LAYER = 7;

export type CurtainStage = 'idle' | 'cover' | 'covered' | 'reveal';

/** A layer covers the screen between its bottom and top edges: fractions of the screen height from its foot. */
export interface CurtainEdge {
  top: number;
  bottom: number;
}

export interface CurtainFrame {
  stage: CurtainStage;
  accent: CurtainEdge;
  dark: CurtainEdge;
  /** How far the moving edge bows (its middle leads a rising edge and trails a leaving one), 0 … 0.35. */
  bulge: number;
  /** 0 → 1 across the plane's flight, while it flies; null otherwise. */
  plane: number | null;
  /** The loading bar, 0 … 1. */
  bar: number;
  /** The whole curtain's opacity (the reduced-motion fade). */
  opacity: number;
  done: boolean;
}

const { clamp, smoothstep } = MathUtils;
const BULGE = 0.35;
const easeInOut = (u: number) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2);
/** 0 → 1 over [from, to]. */
const along = (t: number, from: number, to: number) => clamp((t - from) / (to - from), 0, 1);

/**
 * The curtain `elapsed` seconds in. `readyAt` is when the chapter underneath reported ready (same clock), or null
 * while it is not: the curtain holds covered until then, and at least until the plane has flown across.
 */
export function curtainFrame(elapsed: number, readyAt: number | null): CurtainFrame {
  const { cover, accentLead, flight, reveal } = CURTAIN;
  const revealAt = readyAt === null ? Infinity : Math.max(cover + flight, readyAt);
  const full = { top: 1, bottom: 0 };
  if (elapsed < cover) {
    return {
      stage: 'cover',
      accent: { top: easeInOut(along(elapsed, 0, cover - accentLead)), bottom: 0 },
      dark: { top: easeInOut(along(elapsed, accentLead, cover)), bottom: 0 },
      bulge: BULGE * Math.sin(Math.PI * along(elapsed, 0, cover)),
      plane: null,
      bar: 0.6 * smoothstep(elapsed, 0, cover),
      opacity: 1,
      done: false,
    };
  }
  if (elapsed < revealAt) {
    const flown = (elapsed - cover) / flight;
    const bar = readyAt === null || readyAt >= revealAt ? 0.6 : 0.6 + 0.4 * along(elapsed, readyAt, revealAt);
    return { stage: 'covered', accent: full, dark: { ...full }, bulge: 0, plane: flown <= 1 ? flown : null, bar, opacity: 1, done: false };
  }
  const t = elapsed - revealAt;
  return {
    stage: 'reveal',
    accent: { top: 1, bottom: easeInOut(along(t, accentLead, reveal)) },
    dark: { top: 1, bottom: easeInOut(along(t, 0, reveal - accentLead)) },
    bulge: BULGE * Math.sin(Math.PI * along(t, 0, reveal)),
    plane: null,
    bar: 1,
    opacity: 1,
    done: t >= reveal,
  };
}

/** Under reduced motion: no edge, no plane — the dark fades in, holds until the chapter is ready and fades out. */
export function reducedCurtainFrame(elapsed: number, readyAt: number | null): CurtainFrame {
  const { fade } = CURTAIN;
  const revealAt = readyAt === null ? Infinity : Math.max(fade, readyAt);
  const full = { top: 1, bottom: 0 };
  const stage: CurtainStage = elapsed < fade ? 'cover' : elapsed < revealAt ? 'covered' : 'reveal';
  const opacity = stage === 'cover' ? elapsed / fade : stage === 'covered' ? 1 : 1 - along(elapsed - revealAt, 0, fade);
  return {
    stage,
    accent: full,
    dark: { ...full },
    bulge: 0,
    plane: null,
    bar: stage === 'reveal' ? 1 : 0.6,
    opacity,
    done: stage === 'reveal' && elapsed - revealAt >= fade,
  };
}
