'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CABIN_WALL_Z, CEILING_Y, DOOR_1L, FLOOR_Y, WINDOW, stationToX, windowStations } from '@/experience/geometry';
import { experienceStore } from '@/experience/store';
import { cabinVisible } from '@/experience/visibility';

// Placeholder cabin (Plan 3 replaces it). Geometry is built in aircraft space so the
// window cut-outs can test the vertex position directly.
const FRONT_STATION = 4.0; // ahead of door 1L, so the entry area has walls and floor
const AFT_STATION = 30.5; // just behind row 30; hides the stabiliser roots (station ≥ 31)
const X_FRONT = stationToX(FRONT_STATION);
const X_AFT = stationToX(AFT_STATION);
const LENGTH = X_FRONT - X_AFT;
const CENTER_X = (X_FRONT + X_AFT) / 2;
const HEIGHT = CEILING_Y - FLOOR_Y;
const CENTER_Y = (CEILING_Y + FLOOR_Y) / 2;
/** The painted door on the hull sits low; the opening runs from the floor to head height. */
const DOOR_TOP_Y = FLOOR_Y + 1.9;

const LIGHTS = { ambient: 0.35, hemisphere: 0.6, point: 4 };
const POINT_LIGHT_X = [11, 5, -1, -7];

const f = (n: number) => n.toFixed(4);

function cutoutGlsl(withDoor: boolean): string {
  const halfW = WINDOW.w / 2, halfH = WINDOW.h / 2, r = 0.09;
  return /* glsl */ `
    varying vec3 vCabin;
    bool cutout(vec3 p) {
      float s = ${f(stationToX(0))} - p.x;
      float k = clamp(floor((s - ${f(WINDOW.firstStation)}) / ${f(WINDOW.pitch)} + 0.5), 0., ${f(windowStations().length - 1)});
      float ds = s - (${f(WINDOW.firstStation)} + k * ${f(WINDOW.pitch)});
      vec2 q = abs(vec2(ds, p.y - ${f(WINDOW.y)})) - vec2(${f(halfW - r)}, ${f(halfH - r)});
      if (length(max(q, 0.)) + min(max(q.x, q.y), 0.) - ${f(r)} < 0.) return true;
      ${withDoor ? `if (abs(s - ${f(DOOR_1L.station)}) < ${f(DOOR_1L.width / 2)} && p.y < ${f(DOOR_TOP_Y)}) return true;` : ''}
      return false;
    }`;
}

function wallMaterial(withDoor: boolean): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: '#ebe7de', roughness: 0.85 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCabin;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCabin = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${cutoutGlsl(withDoor)}`)
      .replace('void main() {', 'void main() {\n  if (cutout(vCabin)) discard;');
  };
  m.customProgramCacheKey = () => (withDoor ? 'cabin-wall-door' : 'cabin-wall');
  return m;
}

function wall(side: -1 | 1): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(LENGTH, HEIGHT, 1, 1);
  if (side === 1) g.rotateY(Math.PI); // face inwards (−Z)
  return g.translate(CENTER_X, CENTER_Y, side * CABIN_WALL_Z);
}

export default function CabinShell() {
  const shell = useRef<THREE.Group>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const hemisphere = useRef<THREE.HemisphereLight>(null);
  const points = useRef<(THREE.PointLight | null)[]>([]);
  const parts = useMemo(
    () => ({
      floor: new THREE.PlaneGeometry(LENGTH, CABIN_WALL_Z * 2).rotateX(-Math.PI / 2).translate(CENTER_X, FLOOR_Y, 0),
      ceiling: new THREE.PlaneGeometry(LENGTH, CABIN_WALL_Z * 2).rotateX(Math.PI / 2).translate(CENTER_X, CEILING_Y, 0),
      front: new THREE.PlaneGeometry(CABIN_WALL_Z * 2, HEIGHT).rotateY(-Math.PI / 2).translate(X_FRONT, CENTER_Y, 0),
      aft: new THREE.PlaneGeometry(CABIN_WALL_Z * 2, HEIGHT).rotateY(Math.PI / 2).translate(X_AFT, CENTER_Y, 0),
      left: wall(-1),
      right: wall(1),
      leftMaterial: wallMaterial(true),
      rightMaterial: wallMaterial(false),
    }),
    [],
  );

  // The shell is hidden from outside; the lights stay in the scene and only dim, so the
  // number of lights (part of every material's shader key) never changes.
  useFrame(() => {
    const s = experienceStore.getState();
    const inside = cabinVisible(s.phase, s.progress);
    if (shell.current) shell.current.visible = inside;
    const k = inside ? 1 : 0;
    if (ambient.current) ambient.current.intensity = LIGHTS.ambient * k;
    if (hemisphere.current) hemisphere.current.intensity = LIGHTS.hemisphere * k;
    for (const p of points.current) if (p) p.intensity = LIGHTS.point * k;
  });

  return (
    <>
      <group ref={shell}>
        <mesh geometry={parts.floor}>
          <meshStandardMaterial color="#9c968c" roughness={0.95} />
        </mesh>
        <mesh geometry={parts.ceiling}>
          <meshStandardMaterial color="#f4f1ea" roughness={0.9} />
        </mesh>
        <mesh geometry={parts.front}>
          <meshStandardMaterial color="#e2ddd2" roughness={0.9} />
        </mesh>
        <mesh geometry={parts.aft}>
          <meshStandardMaterial color="#e2ddd2" roughness={0.9} />
        </mesh>
        <mesh geometry={parts.left} material={parts.leftMaterial} />
        <mesh geometry={parts.right} material={parts.rightMaterial} />
      </group>
      <ambientLight ref={ambient} color="#fff3e2" intensity={0} />
      <hemisphereLight ref={hemisphere} args={['#fff6ea', '#8a7f70', 0]} />
      {POINT_LIGHT_X.map((x, i) => (
        <pointLight
          key={x}
          ref={(l) => {
            points.current[i] = l;
          }}
          position={[x, CEILING_Y - 0.15, 0]}
          color="#fff1dc"
          intensity={0}
          distance={9}
          decay={2}
        />
      ))}
    </>
  );
}
