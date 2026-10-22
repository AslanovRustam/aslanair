'use client';

import { Canvas } from '@react-three/fiber';

export default function Experience() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas>
        <color attach="background" args={['#000']} />
      </Canvas>
    </div>
  );
}
