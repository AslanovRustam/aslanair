'use client';

import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { useMemo, useRef } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import { poseOnPostTrack, poseOnPreTrack, seatedPose, type CameraPose } from '@/experience/cameraPoses';
import { experienceStore, trackOf } from '@/experience/store';

const SMOOTH_TIME = 0.4;

function currentPose(): CameraPose {
  const s = experienceStore.getState();
  const seat = s.seats.find((x) => x.id === s.selectedSeatId);
  if (seat && s.phase === 'seated') return seatedPose(seat);
  if (seat && trackOf(s.phase) === 'post') return poseOnPostTrack(s.progress, seat);
  return poseOnPreTrack(s.progress);
}

/** Damps the camera towards the pose the store implies. Runs first so the cloud pass sees this frame's camera. */
export default function CameraRig() {
  const target = useMemo(() => new Vector3(), []);
  const ready = useRef(false);

  useFrame((state, delta) => {
    const cam = state.camera as PerspectiveCamera;
    const pose = currentPose();
    if (!ready.current) {
      cam.position.copy(pose.position);
      target.copy(pose.target);
      cam.fov = pose.fov;
      ready.current = true;
    } else {
      easing.damp3(cam.position, pose.position, SMOOTH_TIME, delta);
      easing.damp3(target, pose.target, SMOOTH_TIME, delta);
      easing.damp(cam, 'fov', pose.fov, SMOOTH_TIME, delta);
    }
    cam.lookAt(target);
    cam.updateProjectionMatrix();
  }, -2);

  return null;
}
