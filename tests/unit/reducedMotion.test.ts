import { describe, expect, test } from 'vitest';
import { poseOnPostTrack, poseOnPreTrack } from '@/experience/cameraPoses';
import { trackProgress } from '@/experience/chapters';
import { REDUCED_KEYS, reducedPose } from '@/experience/reducedMotion';

const pre = (id: Parameters<typeof trackProgress>[1], t: number) => trackProgress('pre', id, t);
const post = (id: Parameters<typeof trackProgress>[1], t: number) => trackProgress('post', id, t);
const SEAT = { row: 14, letter: 'F' as const };
const same = (a: { position: { distanceTo(b: unknown): number } }, b: { position: unknown }) => a.position.distanceTo(b.position) < 1e-9;

describe('reduced motion: key poses instead of flights (spec §4.8)', () => {
  test('flights collapse to key poses; the aisle stays a walk', () => {
    const a = reducedPose('pre', pre('door', 0.3));
    const b = reducedPose('pre', pre('door', 0.7));
    expect(a.key).not.toBe(b.key);
    expect(same(reducedPose('pre', pre('sky', 0.1)).pose, reducedPose('pre', pre('sky', 0.9)).pose)).toBe(true);
    const w1 = reducedPose('pre', pre('aisle', 0.2));
    const w2 = reducedPose('pre', pre('aisle', 0.25));
    expect(w1.key).toBe(w2.key);
    expect(w1.pose.position.distanceTo(w2.pose.position)).toBeGreaterThan(0.1);
    expect(w2.pose.position.distanceTo(poseOnPreTrack(pre('aisle', 0.25)).position)).toBeLessThan(1e-9);
  });

  test('within a key the camera holds still: only the walk moves without a veil', () => {
    for (const track of ['pre', 'post'] as const) {
      for (let i = 0; i < 400; i++) {
        const [p, q] = [i / 400, (i + 1) / 400];
        const a = reducedPose(track, p, 16 / 9, SEAT);
        const b = reducedPose(track, q, 16 / 9, SEAT);
        if (a.key !== b.key) continue;
        const walking = track === 'pre' && q > pre('aisle', 0);
        const moved = a.pose.position.distanceTo(b.pose.position) + a.pose.target.distanceTo(b.pose.target) + Math.abs(a.pose.fov - b.pose.fov);
        if (!walking) expect(moved, `${track} ${p.toFixed(4)}`).toBeLessThan(1e-9);
        else expect(b.pose.position.distanceTo(poseOnPreTrack(q).position), `${track} ${q.toFixed(4)}: the walk is the scroll's`).toBeLessThan(1e-9);
      }
    }
  });

  test('boarding reaches the aisle with no veil between the door key and the walk', () => {
    const inside = reducedPose('pre', pre('door', 0.9));
    const walk = reducedPose('pre', pre('aisle', 0));
    expect(inside.key).toBe(walk.key);
    expect(same(inside.pose, walk.pose)).toBe(true);
  });

  test('the keys come in order; the post track holds the seat, cuts to the way out, then the outro', () => {
    for (const keys of Object.values(REDUCED_KEYS)) for (let i = 1; i < keys.length; i++) expect(keys[i].from).toBeGreaterThan(keys[i - 1].from);
    expect(same(reducedPose('post', post('exit', 0.3), 16 / 9, SEAT).pose, poseOnPostTrack(post('pass', 0.5), SEAT))).toBe(true);
    expect(same(reducedPose('post', post('exit', 0.7), 16 / 9, SEAT).pose, poseOnPostTrack(post('exit', 1), SEAT))).toBe(true);
    expect(reducedPose('post', post('exit', 0.3), 16 / 9, SEAT).key).not.toBe(reducedPose('post', post('exit', 0.7), 16 / 9, SEAT).key);
  });
});
