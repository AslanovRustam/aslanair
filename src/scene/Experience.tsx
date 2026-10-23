'use client';

import { useProgress } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { copy } from '@/content/copy';
import { captureMode } from '@/experience/capture';
import { installTestHooks } from '@/dev/testHooks';
import { poseOnPreTrack } from '@/experience/cameraPoses';
import { experienceStore } from '@/experience/store';
import SmoothScroll from '@/scroll/SmoothScroll';
import Outro from '@/ui/Outro';
import Hero from '@/ui/Hero';
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
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  useEffect(() => installTestHooks({ scene, gl, camera }), [scene, gl, camera]);
  return null;
}

function hasWebGL2(): boolean {
  return !!document.createElement('canvas').getContext('webgl2');
}

/**
 * Feeds the loader: drei's loading progress, then `ready` once the cabin has compiled and shown, the aircraft has
 * compiled, and two frames have drawn them both (under the loader) — by then nothing is left to stall the hero or
 * the swap.
 */
function LoadTracker({ cabinShown, aircraftCompiled }: { cabinShown: RefObject<boolean>; aircraftCompiled: RefObject<boolean> }) {
  const { progress, active } = useProgress();
  const framesSinceShown = useRef(0);
  useEffect(() => experienceStore.getState().setLoad(progress), [progress]);
  useFrame(() => {
    if (experienceStore.getState().ready || active || !cabinShown.current || !aircraftCompiled.current) return;
    framesSinceShown.current += 1;
    if (framesSinceShown.current >= 2) experienceStore.getState().setLoad(100, true);
  });
  return null;
}

/** Everything inside the cabin; compiled off the main thread before it shows. */
function CabinFurnishing({ onShown }: { onShown?: () => void }) {
  return (
    <CompileAsync onShown={onShown}>
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
  const cabinShown = useRef(false);
  const onCabinShown = useCallback(() => {
    cabinShown.current = true;
  }, []);
  const aircraftCompiled = useRef(false);
  const onAircraftCompiled = useCallback(() => {
    aircraftCompiled.current = true;
  }, []);

  useEffect(() => installTestHooks(), []);
  useEffect(() => {
    // no scene will ever be ready: the loader steps aside for the message
    if (!supported) experienceStore.getState().setLoad(100, true);
  }, [supported]);

  if (!supported) {
    return <p className="fallback">{copy.fallback.noWebgl}</p>;
  }
  if (capture) return <CaptureMode cabin={<CabinFurnishing />} />;

  return (
    <>
      <div className="stage">
        <Canvas
          dpr={[1, 2]}
          // PCF, not R3F's default PCFSoft: three r18x swaps PCFSoft for PCF at the first shadow render, so programs
          // precompiled before then would carry the wrong shadow type and all compile again on first sight
          shadows="percentage"
          camera={{ position: start.position.toArray(), fov: start.fov, near: 0.05, far: 60000 }}
        >
          <SceneTestHook />
          <LoadTracker cabinShown={cabinShown} aircraftCompiled={aircraftCompiled} />
          <CameraRig />
          <SkyAndClouds />
          <Suspense fallback={null}>
            <Aircraft onCompiled={onAircraftCompiled}>
              <CabinFurnishing onShown={onCabinShown} />
              <SeatCard />
            </Aircraft>
          </Suspense>
          <BoardingPass3D />
        </Canvas>
      </div>
      <SmoothScroll />
      <Hero />
      <Overlay />
      <Shell />
      <Outro />
    </>
  );
}
