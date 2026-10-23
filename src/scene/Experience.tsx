'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useState } from 'react';
import { copy } from '@/content/copy';
import { installTestHooks } from '@/dev/testHooks';
import { poseOnPreTrack } from '@/experience/cameraPoses';
import SmoothScroll from '@/scroll/SmoothScroll';
import Outro from '@/ui/Outro';
import Overlay from '@/ui/Overlay';
import Shell from '@/ui/Shell';
import Aircraft from './aircraft/Aircraft';
import BoardingPass3D from './BoardingPass3D';
import Bins from './cabin/Bins';
import EntryZone from './cabin/EntryZone';
import FloorDetails from './cabin/FloorDetails';
import ReadingLights from './cabin/ReadingLights';
import SeatCard from './cabin/SeatCard';
import TailZone from './cabin/TailZone';
import Seats from './cabin/Seats';
import CameraRig from './CameraRig';
import CompileAsync from './CompileAsync';
import SkyAndClouds from './sky/SkyAndClouds';

const start = poseOnPreTrack(0);

/** Hands the scene to the test hooks once the canvas exists. */
function SceneTestHook() {
  const scene = useThree((s) => s.scene);
  useEffect(() => installTestHooks({ scene }), [scene]);
  return null;
}

function hasWebGL2(): boolean {
  return !!document.createElement('canvas').getContext('webgl2');
}

export default function Experience() {
  const [supported] = useState(hasWebGL2);

  useEffect(() => installTestHooks(), []);

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
          <SceneTestHook />
          <CameraRig />
          <SkyAndClouds />
          <Suspense fallback={null}>
            <Aircraft>
              <CompileAsync>
                <Seats />
                <FloorDetails />
                <Bins />
                <ReadingLights />
                <EntryZone />
                <TailZone />
              </CompileAsync>
              <SeatCard />
            </Aircraft>
          </Suspense>
          <BoardingPass3D />
        </Canvas>
      </div>
      <SmoothScroll />
      <Overlay />
      <Shell />
      <Outro />
    </>
  );
}
