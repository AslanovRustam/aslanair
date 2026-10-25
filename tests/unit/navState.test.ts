import { describe, expect, test } from 'vitest';
import { trackProgress } from '@/experience/chapters';
import { navItems, railItems, transitionLabel } from '@/experience/navState';

const item = <T extends { id: string }>(items: T[], id: string) => items.find((i) => i.id === id)!;

describe('header navigation', () => {
  test('the journey in order: Flight, Destinations, Transfer, Cabin, Your seat, Boarding pass — no How it is made (spec r5 §8)', () => {
    expect(navItems('browse', 'sky').map((i) => i.label)).toEqual(['Flight', 'Destinations', 'Transfer', 'Cabin', 'Your seat', 'Boarding pass']);
    for (const phase of ['browse', 'seated', 'confirmed', 'thanks'] as const) {
      expect(navItems(phase, 'aisle').map((i) => i.label)).not.toContain("How it's made");
    }
  });

  test('before confirmation Destinations and Transfer go to their chapters, where their choices show', () => {
    const items = navItems('browse', 'aisle');
    expect(item(items, 'destinations')).toMatchObject({ enabled: true, target: { track: 'pre', progress: trackProgress('pre', 'destinations', 0.4) } });
    expect(item(items, 'transfer')).toMatchObject({ enabled: true, target: { track: 'pre', progress: trackProgress('pre', 'transfer', 0.7) } });
    expect(item(navItems('browse', 'destinations'), 'destinations').active).toBe(true);
    expect(item(navItems('browse', 'transfer'), 'transfer').active).toBe(true);
    expect(item(navItems('seated', 'aisle'), 'destinations')).toMatchObject({ enabled: true, active: false });
  });

  test('after confirmation the choices are fixed: Destinations and Transfer are out of reach', () => {
    for (const phase of ['confirmed', 'thanks'] as const)
      for (const id of ['destinations', 'transfer']) expect(item(navItems(phase, 'exit'), id)).toMatchObject({ enabled: false, target: null });
  });

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

  test('while seated, Your seat keeps the visitor in the seat instead of standing them up', () => {
    expect(item(navItems('seated', 'aisle'), 'seat')).toMatchObject({ enabled: true, active: true, target: 'stay' });
    expect(railItems('seated', 'aisle').find((r) => r.id === 'seat')).toMatchObject({ enabled: true, active: true, target: 'stay' });
  });

  test('the current place is marked', () => {
    expect(item(navItems('browse', 'sky'), 'flight').active).toBe(true);
    expect(item(navItems('browse', 'door'), 'cabin').active).toBe(true);
    expect(item(navItems('seated', 'aisle'), 'seat').active).toBe(true);
    expect(item(navItems('seated', 'aisle'), 'cabin').active).toBe(false);
    expect(item(navItems('confirmed', 'pass'), 'pass').active).toBe(true);
  });
});

describe('chapter rail', () => {
  test('seven chapters in order, the current one marked', () => {
    const rail = railItems('browse', 'door');
    expect(rail.map((r) => r.number)).toEqual(['01', '02', '03', '04', '05', '06', '07']);
    expect(rail.map((r) => r.label)).toEqual(['Flight', 'Destinations', 'Transfer', 'Boarding', 'Cabin', 'Your seat', 'Take-off']);
    expect(rail.filter((r) => r.active).map((r) => r.id)).toEqual(['boarding']);
    expect(railItems('browse', 'ready').filter((r) => r.active).map((r) => r.id)).toEqual(['boarding']);
    expect(railItems('browse', 'transfer').filter((r) => r.active).map((r) => r.id)).toEqual(['transfer']);
    expect(item(railItems('browse', 'sky'), 'boarding').target).toEqual({ track: 'pre', progress: trackProgress('pre', 'ready', 0.2) });
  });

  test('follows the same seat gate as the header', () => {
    const before = railItems('browse', 'aisle');
    expect(item(before, 'takeoff')).toMatchObject({ enabled: false });
    expect(item(before, 'seat').target).toEqual({ track: 'pre', progress: trackProgress('pre', 'aisle', 0) });
    const after = railItems('confirmed', 'exit');
    for (const id of ['flight', 'destinations', 'transfer', 'boarding', 'cabin']) expect(item(after, id)).toMatchObject({ enabled: false });
    expect(item(after, 'takeoff')).toMatchObject({ enabled: true, active: true, target: { track: 'post', progress: trackProgress('post', 'exit', 0) } });
  });
});

describe('the label of a chapter jump', () => {
  test('a jump names its chapter with the rail number, and knows the heading to focus', () => {
    expect(transitionLabel('destinations', 'browse')).toEqual({ number: '02', name: 'Destinations', heading: 'destinations' });
    expect(transitionLabel('boarding', 'browse')).toMatchObject({ number: '04', heading: 'ready' });
    expect(transitionLabel('cta', 'browse')).toMatchObject({ number: '05', name: 'Cabin', heading: 'aisle' });
    expect(transitionLabel('change', 'confirmed')).toMatchObject({ number: '05', heading: 'aisle' });
    expect(transitionLabel('restart', 'thanks')).toMatchObject({ number: '01', name: 'Flight', heading: 'sky' });
  });

  test('your seat lands on the aisle before a seat is confirmed, on the pass after', () => {
    expect(transitionLabel('seat', 'browse')).toMatchObject({ number: '06', heading: 'aisle' });
    expect(transitionLabel('pass', 'confirmed')).toMatchObject({ number: '06', heading: 'pass' });
  });
});
