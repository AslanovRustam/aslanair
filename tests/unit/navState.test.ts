import { describe, expect, test } from 'vitest';
import { trackProgress } from '@/experience/chapters';
import { navItems, railItems } from '@/experience/navState';

const item = <T extends { id: string }>(items: T[], id: string) => items.find((i) => i.id === id)!;

describe('header navigation', () => {
  test('before confirmation the pass is out of reach', () => {
    const items = navItems('browse', 'aisle');
    expect(item(items, 'pass')).toMatchObject({ enabled: false });
    expect(item(items, 'seat').target).toEqual({ track: 'pre', progress: trackProgress('pre', 'aisle', 0) });
    expect(item(items, 'flight')).toMatchObject({ enabled: true, target: { track: 'pre', progress: 0 } });
    expect(item(items, 'cabin')).toMatchObject({ enabled: true, active: true });
  });

  test('after confirmation the cabin is out of reach and the seat goes to the pass', () => {
    const items = navItems('confirmed', 'exit');
    expect(item(items, 'flight')).toMatchObject({ enabled: false, target: null });
    expect(item(items, 'cabin')).toMatchObject({ enabled: false, target: null });
    expect(item(items, 'seat').target).toEqual({ track: 'post', progress: 0 });
    expect(item(items, 'pass')).toMatchObject({ enabled: true, target: { track: 'post', progress: 0 } });
  });

  test('How it is made is always a panel', () => {
    for (const [ph, ch] of [['browse', 'sky'], ['seated', 'aisle'], ['confirmed', 'outro']] as const)
      expect(item(navItems(ph, ch), 'made')).toMatchObject({ enabled: true, target: 'panel' });
  });

  test('the current place is marked', () => {
    expect(item(navItems('browse', 'door'), 'flight').active).toBe(true);
    expect(item(navItems('seated', 'aisle'), 'seat').active).toBe(true);
    expect(item(navItems('seated', 'aisle'), 'cabin').active).toBe(false);
    expect(item(navItems('confirmed', 'pass'), 'pass').active).toBe(true);
  });
});

describe('chapter rail', () => {
  test('five chapters in order, the current one marked', () => {
    const rail = railItems('browse', 'door');
    expect(rail.map((r) => r.number)).toEqual(['01', '02', '03', '04', '05']);
    expect(rail.map((r) => r.label)).toEqual(['Flight', 'Boarding', 'Cabin', 'Your seat', 'Take-off']);
    expect(rail.filter((r) => r.active).map((r) => r.id)).toEqual(['boarding']);
  });

  test('follows the same seat gate as the header', () => {
    const before = railItems('browse', 'aisle');
    expect(item(before, 'takeoff')).toMatchObject({ enabled: false });
    expect(item(before, 'seat').target).toEqual({ track: 'pre', progress: trackProgress('pre', 'aisle', 0) });
    const after = railItems('confirmed', 'exit');
    for (const id of ['flight', 'boarding', 'cabin']) expect(item(after, id)).toMatchObject({ enabled: false });
    expect(item(after, 'takeoff')).toMatchObject({ enabled: true, active: true, target: { track: 'post', progress: trackProgress('post', 'exit', 0) } });
  });
});
