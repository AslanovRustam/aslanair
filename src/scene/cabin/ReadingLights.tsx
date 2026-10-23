'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type InstancedMesh,
} from 'three';
import { BIN } from '@/experience/cabinLayout';
import { FLOOR_Y, rowX, SEAT_Z, sideOf, type SeatLetter } from '@/experience/geometry';
import { readingLightSeats } from '@/experience/readingLights';
import { useExperience } from '@/experience/store';

/** Lamp positions under the bin (|z|), matching the kit's three reading-light discs: window, middle, aisle seat. */
const LAMP_Z: Record<'window' | 'middle' | 'aisle', number> = { window: 1.4, middle: 1.25, aisle: 1.1 };
const LAMP_Y = BIN.bottomY - 0.009;
/** Where a reader's light lands: over the lap. */
const LAP_Y = FLOOR_Y + 0.55;
const WARM = new Color('#ffd9a0');

const CONE_VERTEX = /* glsl */ `
  varying float vUp;
  void main() {
    vUp = uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }`;
const CONE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vUp;
  void main() { gl_FragColor = vec4(uColor, pow(vUp, 2.0) * 0.16); }`;

/**
 * Reading lights over a quarter of the occupied seats: a lit disc under the bin and a soft additive cone down to
 * the reader — no real lights, so the light count and every shader stay the same.
 */
export default function ReadingLights() {
  const seats = useExperience((s) => s.seats);
  const lit = useMemo(() => readingLightSeats(seats), [seats]);
  const lamps = useRef<InstancedMesh>(null);
  const cones = useRef<InstancedMesh>(null);
  const parts = useMemo(() => {
    const disc = new CircleGeometry(0.022, 16).rotateX(Math.PI / 2); // facing down
    const cone = new CylinderGeometry(0.03, 0.22, 1, 16, 1, true).translate(0, -0.5, 0); // apex at the lamp, 1 m long
    const lampMaterial = new MeshBasicMaterial({ color: '#fff0d0', toneMapped: false });
    const coneMaterial = new ShaderMaterial({
      uniforms: { uColor: { value: WARM } },
      vertexShader: CONE_VERTEX,
      fragmentShader: CONE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    return { disc, cone, lampMaterial, coneMaterial };
  }, []);

  useLayoutEffect(() => {
    const down = new Vector3(0, -1, 0);
    const m = new Matrix4();
    const q = new Quaternion();
    lit.forEach((id, i) => {
      const seat = seats.find((s) => s.id === id)!;
      const letter = seat.letter as SeatLetter;
      const lamp = new Vector3(rowX(seat.row), LAMP_Y, sideOf(letter) * LAMP_Z[seat.position]);
      const lap = new Vector3(rowX(seat.row), LAP_Y, SEAT_Z[letter]);
      const ray = lap.clone().sub(lamp);
      lamps.current!.setMatrixAt(i, m.makeTranslation(lamp.x, lamp.y, lamp.z));
      q.setFromUnitVectors(down, ray.clone().normalize());
      cones.current!.setMatrixAt(i, m.compose(lamp, q, new Vector3(1, ray.length(), 1)));
    });
    for (const mesh of [lamps.current!, cones.current!]) {
      mesh.count = lit.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [lit, seats]);

  return (
    <group>
      <instancedMesh name="ReadingLightLamps" ref={lamps} args={[parts.disc, parts.lampMaterial, lit.length]} raycast={() => null} />
      <instancedMesh name="ReadingLightCones" ref={cones} args={[parts.cone, parts.coneMaterial, lit.length]} raycast={() => null} renderOrder={3} />
    </group>
  );
}
