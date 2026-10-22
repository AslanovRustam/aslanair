'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  BufferAttribute,
  DoubleSide,
  MathUtils,
  Matrix4,
  Vector3,
  type Group,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import { doorOffset, doorOpenAmount } from '@/experience/aircraftAnimation';
import { withCabinLight } from '../cabin/cabinLight';
import { floorMaps } from '../cabin/materials';
import { aircraftFlyAway } from '@/experience/cameraPoses';
import { chapterAt } from '@/experience/chapters';
import { DOOR_1L } from '@/experience/geometry';
import { experienceStore, trackOf } from '@/experience/store';

const MODEL_URL = '/models/airliner.glb';
/** The cabin shell, floor and skirting: inside the hull, so they never cast sun shadows. */
const INTERIOR = /^Cabin/;
/** GLB floor materials and the pattern each one wears. */
const FLOOR_MAPS: Record<string, 'carpet' | 'runner'> = { Carpet: 'carpet', AisleCarpet: 'runner' };

/**
 * Texture coordinates for a floor mesh in metres of the aircraft frame (u = x along the cabin, v = z across it):
 * the GLB ships none, gltf-transform prunes coordinates that no texture of the material uses.
 */
function planarFloorUv(mesh: Mesh, root: Object3D) {
  if (mesh.geometry.attributes.uv) return;
  root.updateWorldMatrix(true, true);
  const toAircraft = new Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);
  const position = mesh.geometry.attributes.position;
  const uv = new Float32Array(position.count * 2);
  const p = new Vector3();
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i).applyMatrix4(toAircraft);
    uv[i * 2] = p.x;
    uv[i * 2 + 1] = p.z;
  }
  mesh.geometry.setAttribute('uv', new BufferAttribute(uv, 2));
}

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
    // closed is the hinge from geometry.ts — never read back from the shared, cached GLB scene
    const node = scene.getObjectByName('Door1L');
    return node ? { node, closed: new Vector3(...DOOR_1L.hinge) } : null;
  }, [scene]);

  useEffect(() => {
    scene.traverse((o) => {
      if ((o as Mesh).isMesh) {
        // three's shadow pass ignores opacity: see-through glass would write opaque depth and keep the sun out
        const material = (o as Mesh).material as Material;
        o.castShadow = !material.transparent && !INTERIOR.test(o.name);
        // both hull walls write shadow depth: with the default back-face shadow pass the depth is the far
        // wall's, and the sun would light the whole cabin through the near one
        if (o.castShadow) material.shadowSide = DoubleSide;
        if (INTERIOR.test(o.name)) {
          withCabinLight(material);
          const map = FLOOR_MAPS[material.name];
          if (map) {
            const m = material as MeshStandardMaterial;
            m.map = floorMaps()[map];
            m.color.set('#ffffff'); // the pattern carries the colour
            planarFloorUv(o as Mesh, scene);
          }
          material.needsUpdate = true;
        }
        o.receiveShadow = true;
        if (o.userData.decal) {
          // glazing, door window and lettering sit millimetres off the skin: bias them so they never z-fight at range
          const m = (o as Mesh).material as Material;
          m.polygonOffset = true;
          m.polygonOffsetFactor = -1;
          m.polygonOffsetUnits = -4;
        }
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
