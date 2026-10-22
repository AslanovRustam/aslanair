'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  BufferAttribute,
  Color,
  type BufferGeometry,
  type InstancedMesh,
  type InterleavedBufferAttribute,
  type Material,
  type Mesh,
} from 'three';
import { armMatrices, SEAT_KIT, seatMatrices } from '@/experience/cabinLayout';
import { chapterAt } from '@/experience/chapters';
import { SEAT_COLORS, seatVisual } from '@/experience/seats';
import { experienceStore, useExperience } from '@/experience/store';
import { cabinMaterials } from './materials';

export const KIT_URL = '/models/cabin-kit.glb';
const OCCUPIED_DIM = 0.75;

const interactive = () => {
  const s = experienceStore.getState();
  return s.phase === 'browse' && chapterAt('pre', s.progress).id === 'aisle';
};

function setCursor(pointer: boolean) {
  document.body.style.cursor = pointer ? 'pointer' : '';
}

function toFloat(attr: BufferAttribute | InterleavedBufferAttribute): BufferAttribute {
  const out = new Float32Array(attr.count * attr.itemSize);
  const get = [attr.getX, attr.getY, attr.getZ, attr.getW];
  for (let i = 0; i < attr.count; i++) for (let k = 0; k < attr.itemSize; k++) out[i * attr.itemSize + k] = get[k].call(attr, i);
  return new BufferAttribute(out, attr.itemSize);
}

const baked = new Map<string, BufferGeometry>();

/**
 * The kit's geometry for a node name, ready to instance. gltf-transform quantizes positions and normals to
 * normalized integers and moves the dequantization scale/offset onto the node, which instancing ignores —
 * so the node's matrix is baked into a float copy once.
 */
export function useKitGeometry(): (name: string) => BufferGeometry {
  const { nodes } = useGLTF(KIT_URL) as unknown as { nodes: Record<string, Mesh> };
  return (name) => {
    let g = baked.get(name);
    if (!g) {
      const node = nodes[name];
      node.updateWorldMatrix(true, false);
      g = node.geometry.clone();
      for (const key of Object.keys(g.attributes)) g.setAttribute(key, toFloat(g.attributes[key]));
      g.applyMatrix4(node.matrixWorld);
      baked.set(name, g);
    }
    return g;
  };
}

/** Real seats from the cabin kit: one InstancedMesh per part; an invisible box per seat takes the pointer. */
export default function Seats() {
  const seats = useExperience((s) => s.seats);
  const hoveredId = useExperience((s) => s.hoveredSeatId);
  const selectedId = useExperience((s) => s.selectedSeatId);
  const kit = useKitGeometry();
  const m = cabinMaterials();
  const parts = useRef<Record<string, InstancedMesh | null>>({});
  const hit = useRef<InstancedMesh>(null);
  const lastProgress = useRef(-1);
  const hitBox = useMemo(() => new BoxGeometry(SEAT_KIT.depth, SEAT_KIT.height, SEAT_KIT.width).translate(0, SEAT_KIT.height / 2, 0), []);

  // R3F only raycasts on pointer events. When the camera walks, re-check what is under the
  // still pointer; outside the aisle chapter nothing may stay hovered.
  useFrame((state) => {
    const s = experienceStore.getState();
    if (!interactive()) {
      if (s.hoveredSeatId) {
        s.hover(null);
        setCursor(false);
      }
    } else if (s.progress !== lastProgress.current) {
      state.events.update?.();
    }
    lastProgress.current = s.progress;
  });

  useLayoutEffect(() => {
    const perSeat = seatMatrices(seats);
    const arms = armMatrices();
    for (const [name, mesh] of Object.entries({ ...parts.current, SeatHit: hit.current })) {
      if (!mesh) continue;
      (name === 'SeatArm' ? arms : perSeat).forEach((mat, i) => mesh.setMatrixAt(i, mat));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [seats]);

  useLayoutEffect(() => {
    const fabric = parts.current.SeatFabric!;
    const cover = parts.current.SeatCover!;
    const c = new Color();
    seats.forEach((seat, i) => {
      fabric.setColorAt(i, c.setScalar(seat.status === 'occupied' ? OCCUPIED_DIM : 1));
      cover.setColorAt(i, c.set(SEAT_COLORS[seatVisual(seat, hoveredId, selectedId)]));
    });
    fabric.instanceColor!.needsUpdate = true;
    cover.instanceColor!.needsUpdate = true;
  }, [seats, hoveredId, selectedId]);

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!interactive() || e.instanceId === undefined) return;
    const seat = seats[e.instanceId];
    const id = seat.status === 'free' ? seat.id : null;
    if (experienceStore.getState().hoveredSeatId !== id) experienceStore.getState().hover(id);
    setCursor(id !== null);
  };

  const onOut = () => {
    experienceStore.getState().hover(null);
    setCursor(false);
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!interactive() || e.instanceId === undefined) return;
    if (experienceStore.getState().sit(seats[e.instanceId].id)) setCursor(false);
  };

  const part = (name: string, material: Material, count = seats.length) => (
    <instancedMesh
      key={name}
      name={name}
      ref={(mesh) => {
        parts.current[name] = mesh;
      }}
      args={[kit(name), material, count]}
      raycast={() => null}
    />
  );

  return (
    <group>
      {part('SeatFabric', m.fabric)}
      {part('SeatShell', m.shell)}
      {part('SeatCover', m.cover)}
      {part('SeatArm', m.arm, armMatrices().length)}
      {part('SeatLegs', m.legs)}
      <instancedMesh
        name="SeatHit"
        ref={hit}
        args={[hitBox, undefined, seats.length]}
        onPointerMove={onMove}
        onPointerOut={onOut}
        onClick={onClick}
      >
        <meshBasicMaterial visible={false} />
      </instancedMesh>
    </group>
  );
}

useGLTF.preload(KIT_URL);
