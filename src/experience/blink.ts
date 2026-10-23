// Anti-collision light schedules, as functions of the clock (seconds): deterministic, so every frame and every
// test agrees on what is lit.

const BEACON = { period: 1.0, flash: 0.12 };
const STROBE = { period: 1.2, flash: 0.05, gap: 0.15 };

/** Red beacon: one soft flash, 0 → 1 → 0 over 0.12 s, once a second. */
export function beacon(t: number): number {
  const phase = ((t % BEACON.period) + BEACON.period) % BEACON.period;
  return phase < BEACON.flash ? Math.sin((Math.PI * phase) / BEACON.flash) : 0;
}

/** White strobes: two hard 0.05 s flashes 0.15 s apart, every 1.2 s. */
export function strobe(t: number): number {
  const phase = ((t % STROBE.period) + STROBE.period) % STROBE.period;
  return phase < STROBE.flash || (phase >= STROBE.gap && phase < STROBE.gap + STROBE.flash) ? 1 : 0;
}
