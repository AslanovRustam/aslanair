import { beforeEach, describe, expect, test } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { DESTINATIONS, HOME } from '@/experience/destinations';
import { flightAt, globeTurnFor } from '@/experience/globe';
import { pickRecommendedSeat } from '@/experience/seats';
import { experienceStore, trackOf } from '@/experience/store';

const s = () => experienceStore.getState();

beforeEach(() => s().restart());

describe('experience store', () => {
  test('starts browsing at the top', () => {
    expect(s().phase).toBe('browse');
    expect(s().progress).toBe(0);
    expect(s().selectedSeatId).toBeNull();
  });

  test('only free seats can be taken, and only while browsing', () => {
    const occupied = s().seats.find((x) => x.status === 'occupied')!;
    const free = s().seats.find((x) => x.status === 'free')!;
    expect(s().sit(occupied.id)).toBe(false);
    expect(s().phase).toBe('browse');
    expect(s().sit(free.id)).toBe(true);
    expect(s().phase).toBe('seated');
    expect(s().selectedSeatId).toBe(free.id);
    expect(s().sit(free.id)).toBe(false);
  });

  test('standing up returns to where the visitor was in the aisle (spec 4.1)', () => {
    const free = s().seats.find((x) => x.status === 'free')!;
    s().setProgress(0.55);
    s().sit(free.id);
    s().standUp();
    expect(s().phase).toBe('browse');
    expect(s().selectedSeatId).toBeNull();
    expect(s().progress).toBeCloseTo(0.55);
  });

  test('pick-for-me, confirm, change seat returns to where the visitor was', () => {
    s().setProgress(0.6);
    s().autoPick();
    const picked = pickRecommendedSeat(s().seats);
    expect(s().selectedSeatId).toBe(picked.id);
    s().confirm();
    expect(s().phase).toBe('confirmed');
    expect(s().progress).toBe(0);
    expect(trackOf(s().phase)).toBe('post');
    s().changeSeat();
    expect(s().phase).toBe('browse');
    expect(s().selectedSeatId).toBeNull();
    expect(s().progress).toBeCloseTo(0.6);
  });

  test('the form ends in thanks; restart goes back to the top', () => {
    s().autoPick();
    s().confirm();
    s().submitForm();
    expect(s().phase).toBe('thanks');
    s().restart();
    expect(s().phase).toBe('browse');
    expect(s().progress).toBe(0);
  });

  test('loading only moves forward, and once ready the experience stays ready', () => {
    experienceStore.setState({ loadProgress: 0, ready: false });
    s().setLoad(40);
    expect(s().loadProgress).toBe(40);
    s().setLoad(25); // a late asset joining the queue must not pull the bar back
    expect(s().loadProgress).toBe(40);
    s().setLoad(140);
    expect(s().loadProgress).toBe(100);
    expect(s().ready).toBe(false);
    s().setLoad(100, true);
    expect(s().ready).toBe(true);
    s().setLoad(60);
    s().restart();
    expect(s().ready).toBe(true);
    expect(s().loadProgress).toBe(100);
  });

  test('destination and transfer change until the seat is confirmed, then lock; Start again resets them', () => {
    expect([s().destinationId, s().transferId]).toEqual(['LIS', 'own']);
    expect(s().chooseDestination('HND')).toBe(true);
    expect(s().chooseDestination('XXX')).toBe(false);
    expect(s().destinationId).toBe('HND');
    const free = s().seats.find((x) => x.status === 'free')!;
    s().sit(free.id);
    expect(s().chooseTransfer('home')).toBe(true); // seated: still open
    expect(s().transferId).toBe('home');
    s().confirm();
    expect(s().chooseDestination('JFK')).toBe(false);
    expect(s().chooseTransfer('own')).toBe(false);
    expect([s().destinationId, s().transferId]).toEqual(['HND', 'home']);
    s().restart();
    expect([s().destinationId, s().transferId]).toEqual(['LIS', 'own']);
  });

  test('a pick flies the plane there from where it is; a refused pick flies nowhere; Start again grounds it', () => {
    expect(s().flight).toBeNull();
    expect(s().pickDestination('HND', 10)).toBe(true);
    const first = s().flight!;
    expect(first).toMatchObject({ to: { code: 'HND' }, startedAt: 10 });
    expect(s().pickDestination('JFK', 10.5)).toBe(true);
    expect(s().flight!.from.distanceTo(flightAt(first, 10.5).position)).toBeLessThan(1e-9);
    expect(s().pickDestination('XXX', 11)).toBe(false);
    expect(s().flight!.to).toMatchObject({ code: 'JFK' });
    // picking it again changes nothing: no new flight, the arc stays drawn
    const flying = s().flight;
    expect(s().pickDestination('JFK', 20)).toBe(true);
    expect(s().flight).toBe(flying);
    s().hoverDestination('FCO');
    expect(s().hoveredDestinationId).toBe('FCO');
    s().restart();
    expect(s().flight).toBeNull();
    expect(s().hoveredDestinationId).toBeNull();
  });

  test('the visitor spins the globe; a pick carries on from that turn; Start again squares it', () => {
    expect(s().globeSpin.angleTo(new Quaternion())).toBe(0);
    const spin = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.8);
    s().spinGlobe(spin);
    expect(s().globeSpin.angleTo(spin)).toBeLessThan(1e-12);
    expect(s().pickDestination('HND', 3)).toBe(true);
    const lis = DESTINATIONS.find((d) => d.code === 'LIS')!;
    expect(s().flight!.turnFrom.angleTo(spin.clone().multiply(globeTurnFor(HOME, lis)))).toBeLessThan(1e-6);
    expect(s().globeSpin.angleTo(new Quaternion())).toBeLessThan(1e-12);
    s().spinGlobe(spin);
    s().restart();
    expect(s().globeSpin.angleTo(new Quaternion())).toBeLessThan(1e-12);
  });

  test('progress is clamped and hover is ignored while seated', () => {
    s().setProgress(2);
    expect(s().progress).toBe(1);
    const free = s().seats.find((x) => x.status === 'free')!;
    s().autoPick();
    s().hover(free.id);
    expect(s().hoveredSeatId).toBeNull();
  });

  test('actions in the wrong phase are no-ops', () => {
    s().confirm();
    s().submitForm();
    s().changeSeat();
    expect(s().phase).toBe('browse');
  });
});
