'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  BufferAttribute,
  DoubleSide,
  Matrix4,
  Vector3,
  type Group,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type Texture,
} from 'three';
import { doorOffset, doorOpenAmount } from '@/experience/aircraftAnimation';
import { withCabinLight } from '../cabin/cabinLight';
import { floorMaps } from '../cabin/materials';
import { aircraftFlyAway } from '@/experience/cameraPoses';
import { chapterAt } from '@/experience/chapters';
import { destination } from '@/experience/destinations';
import { DOOR_1L } from '@/experience/geometry';
import { planeOverGlobe } from '@/experience/globe';
import { aircraftStage } from '@/experience/stage';
import { experienceStore, trackOf } from '@/experience/store';
import { pointInsideFuselage } from '@/experience/worldState';
import NightLights from './NightLights';

const MODEL_URL = '/models/airliner.glb';
/** The cabin shell, floor and skirting: inside the hull, so they never cast sun shadows. */
const INTERIOR = /^Cabin/;
/** Night look: the fin's livery lit by its floodlight, and the cabin's warm light seen through the windows. */
const FIN_FLOODLIGHT = 0.35;
const WINDOW_GLOW = { color: '#ffcf8a', intensity: 0.6 };
/** Waiting for the transfer it sways on its own, this far either way over this long (s): slow, still at the ends. */
const SWAY = { angle: (3 * Math.PI) / 180, period: 12 };
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

/**
 * The airliner; children (the cabin) ride along wherever it stands — its stage through the journey (stage.ts), its
 * fly-away after the seat is confirmed. Under the loader it is drawn from the moment its shaders have compiled
 * (`onCompiled`) until the scene is ready: those frames upload its geometry and textures and compile the shadow pass,
 * so the hand-over finds nothing left to do.
 */
export default function Aircraft({ children, onCompiled }: { children?: ReactNode; onCompiled?: () => void }) {
  const { scene } = useGLTF(MODEL_URL);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const root = useThree((s) => s.scene);
  const group = useRef<Group>(null);
  const windowGlass = useRef<MeshStandardMaterial | null>(null);
  const eyeLocal = useRef(new Vector3());
  const compiled = useRef(false);
  /** What the shadow map was last drawn for: the only caster is this aircraft, so it redraws only when that moves. */
  const shadowFor = useRef('');
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
        if (material.name === 'FinLivery') {
          const fin = material as MeshStandardMaterial;
          fin.emissiveMap = fin.map;
          fin.emissive.set('#ffffff');
          fin.emissiveIntensity = FIN_FLOODLIGHT;
          fin.needsUpdate = true;
        }
        if (material.name === 'WindowGlass') {
          const glass = material as MeshStandardMaterial;
          glass.emissive.set(WINDOW_GLOW.color);
          glass.emissiveIntensity = WINDOW_GLOW.intensity;
          windowGlass.current = glass;
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

  useEffect(() => {
    // compile its shaders in parallel while the loader is up
    const g = group.current!;
    let alive = true;
    const done = () => {
      if (!alive) return;
      compiled.current = true;
      onCompiled?.();
    };
    gl.compileAsync(g, camera, root).then(done, done);
    g.traverse((o) => {
      const material = (o as Mesh).material as Material | undefined;
      if (!material) return;
      for (const value of Object.values(material)) if ((value as Texture | null)?.isTexture) gl.initTexture(value as Texture);
    });
    return () => {
      alive = false;
    };
  }, [gl, camera, root, scene, onCompiled]);

  useFrame(({ camera, gl: renderer }) => {
    const g = group.current;
    if (!g) return;
    const s = experienceStore.getState();
    // the windows glow seen from outside; from inside — and from within the wall, passing through a window on the
    // way out — the glass must not tint the night view
    if (windowGlass.current) {
      const eye = g.worldToLocal(eyeLocal.current.copy(camera.position));
      windowGlass.current.emissiveIntensity = pointInsideFuselage(eye.x, eye.y, eye.z) ? 0 : WINDOW_GLOW.intensity;
    }
    // the stage stands it through the journey and the fly-away moves it in flight; one of the two is always at rest
    const now = performance.now() / 1000;
    const chosen = destination(s.destinationId);
    const onGlobe = chosen && planeOverGlobe(s.phase, s.progress, s.flight, chosen, now);
    const stage = aircraftStage(s.phase, s.progress, onGlobe);
    const chapter = chapterAt('pre', s.progress);
    if (s.phase === 'browse' && chapter.id === 'transfer') {
      stage.rotation.y += SWAY.angle * Math.sin((2 * Math.PI * now) / SWAY.period) * Math.sin(Math.PI * chapter.t);
    }
    const fly = trackOf(s.phase) === 'post' ? aircraftFlyAway(s.progress) : { offsetX: 0, climb: 0, bank: 0 };
    g.position.set(stage.position.x + fly.offsetX, stage.position.y + fly.climb, stage.position.z);
    g.rotation.copy(stage.rotation);
    g.rotation.x += fly.bank;
    g.scale.setScalar(stage.scale);
    const open = doorOpenAmount(s.phase, s.progress);
    if (door) {
      const [dx, dy, dz] = doorOffset(open);
      door.node.position.set(door.closed.x + dx, door.closed.y + dy, door.closed.z + dz);
    }
    const pose = `${+g.visible} ${g.position.toArray()} ${g.rotation.toArray()} ${g.scale.x} ${open}`;
    renderer.shadowMap.autoUpdate = false;
    if (pose !== shadowFor.current) {
      shadowFor.current = pose;
      renderer.shadowMap.needsUpdate = true;
    }
  }, -3);

  return (
    <group ref={group} name="Aircraft">
      <primitive object={scene} />
      <NightLights />
      {children}
    </group>
  );
}

useGLTF.preload(MODEL_URL);
