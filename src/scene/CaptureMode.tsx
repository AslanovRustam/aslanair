'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useRef, type ReactNode } from 'react';
import { INTRO } from '@/experience/introState';
import Aircraft from './aircraft/Aircraft';
import SkyAndClouds from './sky/SkyAndClouds';

/** The picture's size: the hero shows it full height, so the live frame and the picture line up at any aspect. */
export const CAPTURE_SIZE = { width: 1600, height: 900 };

/** Flags the page ready once the cabin behind the windows has compiled and a few frames have settled. */
function Ready() {
  const frames = useRef(0);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    const seats = scene.getObjectByName('SeatFabric');
    if (!seats || !seats.layers.test(camera.layers)) return;
    frames.current += 1;
    if (frames.current === 30) (window as unknown as { __aslanCaptureReady?: boolean }).__aslanCaptureReady = true;
  });
  return null;
}

/**
 * `?capture=plane`: the aircraft alone at the intro's swap pose, in the showcase light, on transparency — the
 * picture tools/capture-plane.mjs takes for the hero.
 */
export default function CaptureMode({ cabin }: { cabin: ReactNode }) {
  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
  }, []);

  return (
    <div style={{ width: CAPTURE_SIZE.width, height: CAPTURE_SIZE.height }}>
      <Canvas
        dpr={1}
        shadows
        gl={{ alpha: true }}
        onCreated={({ gl, camera }) => {
          gl.setClearAlpha(0);
          camera.lookAt(INTRO.swapPose.target);
        }}
        camera={{ position: INTRO.swapPose.position.toArray(), fov: INTRO.swapPose.fov, near: 0.05, far: 60000 }}
      >
        <SkyAndClouds background={false} />
        <Suspense fallback={null}>
          <Aircraft>{cabin}</Aircraft>
          <Ready />
        </Suspense>
      </Canvas>
    </div>
  );
}
