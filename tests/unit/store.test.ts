import { beforeEach, describe, expect, test } from 'vitest';
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
