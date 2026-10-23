'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, CanvasTexture, Color, Vector3, type Group, type Mesh, type MeshBasicMaterial, type Sprite } from 'three';
import { beacon, strobe } from '@/experience/blink';
import { NIGHT_LIGHTS } from '@/experience/geometry';
import { pointInsideCabin } from '@/experience/worldState';

type LightName = keyof typeof NIGHT_LIGHTS;

/** Lights on the fuselage itself: a halo always faces the camera, so seen from inside the cabin its square would
 * hang down through the ceiling. They go dark while the camera is aboard (the wing and tail lights stay). */
const ON_FUSELAGE = new Set<LightName>(['beaconTop', 'beaconBottom']);

/** Each light: what colour it reads as, its tint, the size of its glow (m) and how it blinks, if it does. */
const LOOK: Record<LightName, { color: 'red' | 'green' | 'white'; hex: string; glow: number; blink?: (t: number) => number }> = {
  navPort: { color: 'red', hex: '#ff3b30', glow: 1.4 },
  navStarboard: { color: 'green', hex: '#3be07f', glow: 1.4 },
  tail: { color: 'white', hex: '#fff6e8', glow: 1.2 },
  beaconTop: { color: 'red', hex: '#ff2a1a', glow: 2.4, blink: beacon },
  beaconBottom: { color: 'red', hex: '#ff2a1a', glow: 2.4, blink: beacon },
  strobePort: { color: 'white', hex: '#ffffff', glow: 3.2, blink: strobe },
  strobeStarboard: { color: 'white', hex: '#ffffff', glow: 3.2, blink: strobe },
};

function glowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}

/**
 * The aircraft's night lights: a small lamp and an additive glow each — no real lights, so the scene's light
 * count (and every shader) stays the same. Beacons and strobes follow the deterministic schedules in blink.ts.
 */
export default function NightLights() {
  const glow = useMemo(() => glowTexture(), []);
  const lamps = useRef<Partial<Record<LightName, { lamp: Mesh; halo: Sprite }>>>({});
  const tint = useRef(new Color());
  const root = useRef<Group>(null);
  const eye = useRef(new Vector3());

  useFrame(({ clock, camera }) => {
    const t = clock.elapsedTime;
    const e = root.current ? root.current.worldToLocal(eye.current.copy(camera.position)) : null;
    const aboard = !!e && pointInsideCabin(e.x, e.y, e.z);
    for (const name of Object.keys(LOOK) as LightName[]) {
      const look = LOOK[name];
      const parts = lamps.current[name];
      if (!look.blink || !parts) continue;
      const level = aboard && ON_FUSELAGE.has(name) ? 0 : look.blink(t);
      parts.halo.visible = level > 0;
      (parts.halo.material as unknown as { opacity: number }).opacity = level;
      (parts.lamp.material as MeshBasicMaterial).color.copy(tint.current.set(look.hex)).multiplyScalar(0.25 + 0.75 * level);
    }
  });

  return (
    <group ref={root} name="NightLights">
      {(Object.keys(NIGHT_LIGHTS) as LightName[]).map((name) => {
        const look = LOOK[name];
        return (
          <group key={name} name={name} position={NIGHT_LIGHTS[name] as unknown as [number, number, number]} userData={{ color: look.color }}>
            <mesh
              ref={(lamp: Mesh | null) => {
                if (lamp) lamps.current[name] = { ...(lamps.current[name] as { halo: Sprite }), lamp };
              }}
              raycast={() => null}
            >
              <sphereGeometry args={[0.07, 12, 8]} />
              <meshBasicMaterial color={look.hex} toneMapped={false} />
            </mesh>
            <sprite
              ref={(halo: Sprite | null) => {
                if (halo) lamps.current[name] = { ...(lamps.current[name] as { lamp: Mesh }), halo };
              }}
              scale={[look.glow, look.glow, 1]}
              raycast={() => null}
            >
              <spriteMaterial map={glow} color={look.hex} blending={AdditiveBlending} depthWrite={false} transparent toneMapped={false} />
            </sprite>
          </group>
        );
      })}
    </group>
  );
}

