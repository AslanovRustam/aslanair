'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useState } from 'react';
import { copy } from '@/content/copy';
import { installTestHooks } from '@/dev/testHooks';
import { poseOnPreTrack } from '@/experience/cameraPoses';
import SmoothScroll from '@/scroll/SmoothScroll';
import Outro from '@/ui/Outro';
import Overlay from '@/ui/Overlay';
import Aircraft from './aircraft/Aircraft';
import BoardingPass3D from './BoardingPass3D';
import CabinShell from './cabin/CabinShell';
import Seats from './cabin/Seats';
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
            <Aircraft>
              <CabinShell />
              <Seats />
            </Aircraft>
          </Suspense>
          <BoardingPass3D />
        </Canvas>
      </div>
      <SmoothScroll />
      <Overlay />
      <Outro />
    </>
  );
}
