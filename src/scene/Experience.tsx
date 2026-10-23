'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useState } from 'react';
import { copy } from '@/content/copy';
import { captureMode } from '@/experience/capture';
import { installTestHooks } from '@/dev/testHooks';
import { poseOnPreTrack } from '@/experience/cameraPoses';
import SmoothScroll from '@/scroll/SmoothScroll';
import Outro from '@/ui/Outro';
import Hero from '@/ui/Hero';
import IntroPlane from '@/ui/IntroPlane';
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
import CaptureMode from './CaptureMode';
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

/** Everything inside the cabin; compiled off the main thread before it shows. */
function CabinFurnishing() {
  return (
    <CompileAsync>
      <Seats />
      <FloorDetails />
      <Bins />
      <ReadingLights />
      <EntryZone />
      <TailZone />
    </CompileAsync>
  );
}

export default function Experience() {
  const [supported] = useState(hasWebGL2);
  const [capture] = useState(captureMode);

  useEffect(() => installTestHooks(), []);

  if (!supported) {
    return <p className="fallback">{copy.fallback.noWebgl}</p>;
  }
  if (capture) return <CaptureMode cabin={<CabinFurnishing />} />;

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
              <CabinFurnishing />
              <SeatCard />
            </Aircraft>
          </Suspense>
          <BoardingPass3D />
        </Canvas>
      </div>
      <SmoothScroll />
      <Hero />
      <IntroPlane />
      <Overlay />
      <Shell />
      <Outro />
    </>
  );
}
