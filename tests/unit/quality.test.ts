import { describe, expect, test } from 'vitest';
import { PUFFS } from '@/experience/clouds';
import { pickTier, stepDown, TIER, type DeviceProbe } from '@/experience/quality';

const desktop: DeviceProbe = { renderer: 'ANGLE (NVIDIA GeForce RTX 5060 Laptop GPU)', maxTouchPoints: 0, minScreenSide: 1080, hardwareConcurrency: 16 };

describe('quality tiers', () => {
  test.each([
    [desktop, null, 'high'],
    [{ ...desktop, renderer: 'ANGLE (Intel(R) UHD Graphics)' }, null, 'medium'],
    [{ ...desktop, renderer: 'Google SwiftShader' }, null, 'medium'],
    [{ ...desktop, maxTouchPoints: 5, minScreenSide: 412, renderer: 'Adreno (TM) 740' }, null, 'low'],
    [{ ...desktop, deviceMemory: 4 }, null, 'low'],
    [desktop, 'low', 'low'],
    [{ ...desktop, deviceMemory: 2 }, 'high', 'high'],
    [desktop, 'ultra', 'high'],
  ] as const)('pickTier %#', (probe, override, tier) => expect(pickTier(probe, override)).toBe(tier));

  test('a touch laptop with a big screen is not a phone', () => {
    expect(pickTier({ ...desktop, maxTouchPoints: 10, minScreenSide: 1200 })).toBe('high');
  });

  test('stepDown bottoms out at low', () => {
    expect([stepDown('high'), stepDown('medium'), stepDown('low')]).toEqual(['medium', 'low', 'low']);
  });

  test('each tier draws less than the one above, never another light or shader', () => {
    expect(TIER.high).toEqual({ dpr: [1, 2], puffs: PUFFS.count, shadowMapSize: 2048, seatLod: 'full' });
    expect(TIER.medium).toEqual({ dpr: [1, 1.5], puffs: 0.75 * PUFFS.count, shadowMapSize: 2048, seatLod: 'full' });
    expect(TIER.low).toEqual({ dpr: [1, 1.25], puffs: 0.5 * PUFFS.count, shadowMapSize: 1024, seatLod: 'low' });
    for (const t of Object.values(TIER)) expect(Number.isInteger(t.puffs)).toBe(true);
  });
});
