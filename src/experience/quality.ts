import { PUFFS } from './clouds';

/** How much the device draws (spec §4.8): `high` a discrete desktop GPU, `medium` an integrated one, `low` phones,
 * tablets and small-memory devices. */
export type Tier = 'high' | 'medium' | 'low';

/** What the page can learn about the device before drawing. */
export interface DeviceProbe {
  /** The GPU's name (WEBGL_debug_renderer_info), or '' when the browser hides it. */
  renderer: string;
  maxTouchPoints: number;
  /** The screen's shorter side, CSS pixels. */
  minScreenSide: number;
  /** navigator.deviceMemory (GB), where the browser tells. */
  deviceMemory?: number;
  hardwareConcurrency: number;
}

/**
 * Per tier: the pixel ratio range, the sprite clouds drawn (the instanced draw's count — never a shader define), the
 * moon's shadow map size and the seat model. No tier changes the lights or a shader's defines, so a switch never
 * recompiles anything.
 */
export const TIER: Record<Tier, { dpr: [number, number]; puffs: number; shadowMapSize: number; seatLod: 'full' | 'low' }> = {
  high: { dpr: [1, 2], puffs: PUFFS.count, shadowMapSize: 2048, seatLod: 'full' },
  medium: { dpr: [1, 1.5], puffs: 0.75 * PUFFS.count, shadowMapSize: 2048, seatLod: 'full' },
  low: { dpr: [1, 1.25], puffs: 0.5 * PUFFS.count, shadowMapSize: 1024, seatLod: 'low' },
};

/** A phone- or tablet-sized touch screen: shorter side under this (CSS px). */
const PHONE_SIDE = 900;
const INTEGRATED = /Intel|UHD|Iris|Mali|Adreno|PowerVR|Apple GPU|SwiftShader|llvmpipe/i;

const isTier = (v: string | null | undefined): v is Tier => v === 'high' || v === 'medium' || v === 'low';

/** The tier for a device: a valid `?quality=` override wins; then touch screens under 900 px and ≤ 4 GB devices are
 * low, integrated or software GPUs medium, the rest high. */
export function pickTier(probe: DeviceProbe, override?: string | null): Tier {
  if (isTier(override)) return override;
  if (probe.maxTouchPoints > 0 && probe.minScreenSide < PHONE_SIDE) return 'low';
  if (probe.deviceMemory !== undefined && probe.deviceMemory <= 4) return 'low';
  if (INTEGRATED.test(probe.renderer)) return 'medium';
  return 'high';
}

/** One tier down, for a device that turns out slower than its probe said. */
export function stepDown(tier: Tier): Tier {
  return tier === 'high' ? 'medium' : 'low';
}

/** Whether the tier came from the address (`?quality=`): an explicit choice the runtime fallback leaves alone. */
export function qualityOverride(search: string): Tier | null {
  const v = new URLSearchParams(search).get('quality');
  return isTier(v) ? v : null;
}
