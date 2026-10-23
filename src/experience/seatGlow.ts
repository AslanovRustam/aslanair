/** How a seat answers the pointer: a free seat under it rises a few centimetres and lights up in teal; the chosen
 * seat glows terracotta. No outline — the seat itself is the highlight. */
export const SEAT_GLOW = {
  lift: 0.04,
  /** 1/s: the response settles in about a fifth of a second. */
  rate: 14,
  hover: { color: '#6fd3cc', strength: 0.45, pulse: 0.15, hz: 1.2 },
  selected: { color: '#d4683a', strength: 0.4 },
} as const;

/** Eases a seat's hover level towards its target, independent of the frame rate. */
export function easeLevel(level: number, target: number, dt: number, rate: number = SEAT_GLOW.rate): number {
  return target + (level - target) * Math.exp(-rate * dt);
}

/** How far a seat at hover level `level` (0…1) has risen. */
export function hoverLift(level: number): number {
  return SEAT_GLOW.lift * level * level * (3 - 2 * level);
}
