'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { MathUtils, type Group, type Material, type Mesh } from 'three';
import { doorOffset, doorOpenAmount } from '@/experience/aircraftAnimation';
import { aircraftFlyAway } from '@/experience/cameraPoses';
import { chapterAt } from '@/experience/chapters';
import { experienceStore, trackOf } from '@/experience/store';

const MODEL_URL = '/models/airliner.glb';

/** How much idle bob to apply: full in the sky shot, none once the camera is inside. */
function bobWeight(): number {
  const s = experienceStore.getState();
  if (trackOf(s.phase) === 'post' || s.phase === 'seated') return 0;
  const { id, t } = chapterAt('pre', s.progress);
  if (id === 'sky') return 1;
  if (id === 'door') return 1 - MathUtils.smoothstep(t, 0, 0.5);
  return 0;
}

/** The airliner; children (the cabin) ride along with its idle motion and fly-away. */
export default function Aircraft({ children }: { children?: ReactNode }) {
  const { scene } = useGLTF(MODEL_URL);
  const group = useRef<Group>(null);
  const door = useMemo(() => {
    const node = scene.getObjectByName('Door1L');
    return node ? { node, closed: node.position.clone() } : null;
  }, [scene]);

  useEffect(() => {
    scene.traverse((o) => {
      if ((o as Mesh).isMesh) {
        // three's shadow pass ignores opacity: see-through glass would write opaque depth and keep the sun out
        o.castShadow = !((o as Mesh).material as Material).transparent;
        o.receiveShadow = true;
      }
    });
  }, [scene]);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const s = experienceStore.getState();
    const t = clock.elapsedTime;
    const w = bobWeight();
    const fly = trackOf(s.phase) === 'post' ? aircraftFlyAway(s.progress) : { offsetX: 0, climb: 0, bank: 0 };
    g.position.set(fly.offsetX, w * 0.4 * Math.sin(0.37 * t) + fly.climb, 0);
    g.rotation.set(w * 0.025 * Math.sin(0.5 * t) + fly.bank, 0, 0);
    if (door) {
      const [dx, dy, dz] = doorOffset(doorOpenAmount(s.phase, s.progress));
      door.node.position.set(door.closed.x + dx, door.closed.y + dy, door.closed.z + dz);
    }
  }, -3);

  return (
    <group ref={group}>
      <primitive object={scene} />
      {children}
    </group>
  );
}

useGLTF.preload(MODEL_URL);
