'use client';

import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { useMemo, useRef } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import { applyLens, poseOnPostTrack, poseOnPreTrack, seatedPose, type CameraPose } from '@/experience/cameraPoses';
import { experienceStore, trackOf, type Phase } from '@/experience/store';

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
 */
export default function CameraRig() {
  const target = useMemo(() => new Vector3(), []);
  const ready = useRef(false);
  const riding = useRef(true);
  const phase = useRef<Phase | null>(null);
  const lens = useRef({ fov: 30, lift: 0 });

  useFrame((state, delta) => {
    const cam = state.camera as PerspectiveCamera;
    const { width, height } = state.size;
    const pose = currentPose(width / height);
    const l = lens.current;
    const now = experienceStore.getState().phase;
    if (phase.current !== null && now !== phase.current) riding.current = false;
    phase.current = now;
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
    cam.lookAt(target);
    applyLens(cam, { position: cam.position, target, fov: l.fov, lift: l.lift }, width, height);
  }, -2);

  return null;
}
