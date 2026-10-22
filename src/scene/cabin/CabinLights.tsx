'use client';

import { CEILING_Y } from '@/experience/geometry';

// Ceiling lights inside the GLB cabin shell. Point lights only: the hull and shell keep them off the
// outside, so they stay on all the time and the light count (part of every shader key) never changes.
const LIGHT_X = [11, 5, -1, -7];

export default function CabinLights() {
  return (
    <>
      {LIGHT_X.map((x) => (
        <pointLight key={x} position={[x, CEILING_Y - 0.15, 0]} color="#fff1dc" intensity={4} distance={9} decay={2} />
      ))}
    </>
  );
}
