'use client';

import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { useMemo, useRef } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import { applyLens, poseOnPostTrack, poseOnPreTrack, seatedPose, type CameraPose } from '@/experience/cameraPoses';
import { lockPulse } from '@/experience/passMotion';
import { reducedPose } from '@/experience/reducedMotion';
import { experienceStore, trackOf, type Phase } from '@/experience/store';
import { VEIL, veilStore } from '@/experience/veil';

const SMOOTH_TIME = 0.4;
/** Close enough to the pose to stop gliding and ride it (m; fov in degrees). */
const SETTLED = { distance: 0.01, fov: 0.05 };

function currentPose(aspect: number): CameraPose {
  const s = experienceStore.getState();
  const seat = s.seats.find((x) => x.id === s.selectedSeatId);
  if (seat && s.phase === 'seated') return seatedPose(seat);
  if (seat && trackOf(s.phase) === 'post') return poseOnPostTrack(s.progress, seat);
  return poseOnPreTrack(s.progress, aspect);
}

/** Under reduced motion: the key pose the store implies (sitting down is a key of its own, per seat). */
function currentKey(aspect: number): { pose: CameraPose; key: string } {
  const s = experienceStore.getState();
  const seat = s.seats.find((x) => x.id === s.selectedSeatId);
  if (seat && s.phase === 'seated') return { pose: seatedPose(seat), key: `seat ${seat.id}` };
  if (seat && trackOf(s.phase) === 'post') return reducedPose('post', s.progress, aspect, seat);
  return reducedPose('pre', s.progress, aspect);
}

/** Whether the camera last frame was on its pose (riding it), not gliding after a phase change. */
let onPose = true;

/** True while the camera rides its pose: the curtain lifts only once it has caught up after a jump. */
export function cameraSettled(): boolean {
  return onPose;
}

/**
 * Puts the camera on the pose the store implies. The scroll is already smoothed (Lenis), so on a track the camera
 * rides the pose exactly: the intro picture, the 3D plane and the night switch all follow the same scroll position,
 * however fast it moves. A phase change (sitting down, standing up, confirming, starting again) jumps the pose; the
 * camera glides there instead and rides it again once it has caught up. Runs first so the cloud pass sees this frame.
 *
 * Under reduced motion it never flies (spec §4.8): it holds a key pose (reducedMotion.ts) and, when the key changes,
 * waits for the Veil to cover the scene, cuts to the new pose and lets the Veil clear.
 */
export default function CameraRig() {
  const target = useMemo(() => new Vector3(), []);
  const ready = useRef(false);
  const riding = useRef(true);
  const phase = useRef<Phase | null>(null);
  const lens = useRef({ fov: 30, lift: 0 });
  // the seat lock's dip (passMotion): laid over the pose each frame and taken off again, never glided into
  const dipped = useRef(0);
  // under reduced motion: the key on screen, its pose, and since when the Veil has been asked to cover
  const cut = useRef<{ key: string | null; pose: CameraPose | null; covering: number | null }>({ key: null, pose: null, covering: null });

  useFrame((state, delta) => {
    const cam = state.camera as PerspectiveCamera;
    cam.position.y += dipped.current;
    target.setY(target.y + dipped.current);
    const { width, height } = state.size;
    const l = lens.current;
    const s = experienceStore.getState();
    const now = s.phase;
    if (phase.current !== null && now !== phase.current) riding.current = false;
    phase.current = now;
    const c = cut.current;
    if (s.reducedMotion) {
      const next = currentKey(width / height);
      const clock = state.clock.elapsedTime;
      if (c.key === null || next.key === c.key) {
        c.key = next.key;
        c.pose = next.pose;
        if (c.covering !== null) veilStore.setState({ covered: false });
        c.covering = null;
      } else if (c.covering === null) {
        c.covering = clock;
        veilStore.setState({ covered: true });
      } else if (clock - c.covering >= VEIL.seconds) {
        // the scene is dark: cut, and let the veil clear
        c.key = next.key;
        c.pose = next.pose;
        c.covering = null;
        veilStore.setState({ covered: false });
      }
      cam.position.copy(c.pose!.position);
      target.copy(c.pose!.target);
      l.fov = c.pose!.fov;
      l.lift = c.pose!.lift ?? 0;
      ready.current = riding.current = true;
      onPose = c.covering === null;
    } else {
      if (c.key !== null) {
        c.key = c.pose = c.covering = null;
        veilStore.setState({ covered: false });
      }
      const pose = currentPose(width / height);
      if (!ready.current || riding.current) {
        cam.position.copy(pose.position);
        target.copy(pose.target);
        l.fov = pose.fov;
        l.lift = pose.lift ?? 0;
        ready.current = true;
      } else {
        easing.damp3(cam.position, pose.position, SMOOTH_TIME, delta);
        easing.damp3(target, pose.target, SMOOTH_TIME, delta);
        easing.damp(l, 'fov', pose.fov, SMOOTH_TIME, delta);
        easing.damp(l, 'lift', pose.lift ?? 0, SMOOTH_TIME, delta);
        riding.current =
          cam.position.distanceTo(pose.position) < SETTLED.distance &&
          target.distanceTo(pose.target) < SETTLED.distance &&
          Math.abs(l.fov - pose.fov) < SETTLED.fov &&
          Math.abs(l.lift - (pose.lift ?? 0)) < 1e-3;
      }
      onPose = riding.current;
    }
    dipped.current = s.confirmedAt === null || trackOf(now) !== 'post' ? 0 : lockPulse(performance.now() - s.confirmedAt, s.reducedMotion).dip;
    cam.position.y -= dipped.current;
    target.setY(target.y - dipped.current);
    cam.lookAt(target);
    applyLens(cam, { position: cam.position, target, fov: l.fov, lift: l.lift }, width, height);
  }, -2);

  return null;
}
