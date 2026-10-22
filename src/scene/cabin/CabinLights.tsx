'use client';

import { CABIN_LIGHTS } from '@/experience/cabinLayout';

// Warm ceiling lights inside the cabin; always on, so the light count (part of every shader key) never changes.
export default function CabinLights() {
  return (
    <>
      {CABIN_LIGHTS.map((l) => (
        <pointLight key={l.position[0]} position={l.position} color="#fff1dc" intensity={l.intensity} distance={l.distance} decay={2} />
      ))}
    </>
  );
}
