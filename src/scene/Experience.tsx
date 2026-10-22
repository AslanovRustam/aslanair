'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useState } from 'react';
import { copy } from '@/content/copy';
import { installTestHooks } from '@/dev/testHooks';
import { poseOnPreTrack } from '@/experience/cameraPoses';
import SmoothScroll from '@/scroll/SmoothScroll';
import Aircraft from './aircraft/Aircraft';
import CameraRig from './CameraRig';
import SkyAndClouds from './sky/SkyAndClouds';

const start = poseOnPreTrack(0);

function hasWebGL2(): boolean {
  return !!document.createElement('canvas').getContext('webgl2');
}

export default function Experience() {
  const [supported] = useState(hasWebGL2);

  useEffect(installTestHooks, []);

  if (!supported) {
    return <p className="fallback">{copy.fallback.noWebgl}</p>;
  }

  return (
    <>
      <div className="stage">
        <Canvas
          dpr={[1, 2]}
          shadows
          camera={{ position: start.position.toArray(), fov: start.fov, near: 0.05, far: 60000 }}
        >
          <CameraRig />
          <SkyAndClouds />
          <Suspense fallback={null}>
            <Aircraft />
          </Suspense>
        </Canvas>
      </div>
      <SmoothScroll />
    </>
  );
}
