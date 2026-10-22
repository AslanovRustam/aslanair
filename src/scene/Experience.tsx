'use client';

import { Canvas } from '@react-three/fiber';
import SkyAndClouds from './sky/SkyAndClouds';

export default function Experience() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas
        shadows
        camera={{ position: [42, 6.5, -36], fov: 30, near: 0.05, far: 60000 }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      >
        <SkyAndClouds />
      </Canvas>
    </div>
  );
}
