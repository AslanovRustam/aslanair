'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  Color,
  Matrix4,
  type BufferGeometry,
  type InstancedMesh,
  type InterleavedBufferAttribute,
  type Material,
  type Mesh,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { armMatrices, isInsideSeat, seatMatrices } from '@/experience/cabinLayout';
import { chapterAt } from '@/experience/chapters';
import { SEAT_COLORS, seatVisual } from '@/experience/seats';
import { experienceStore, useExperience } from '@/experience/store';
import { cabinMaterials } from './materials';

export const KIT_URL = '/models/cabin-kit.glb';
const OCCUPIED_DIM = 0.75;
/** Per-seat parts that leave the view while the camera sits in their seat (arms are shared between neighbours). */
const OWN_SEAT_PARTS = ['SeatFabric', 'SeatShell', 'SeatCover', 'SeatLegs', 'SeatBelt', 'SeatBuckle'];
const GONE = new Matrix4().makeScale(0, 0, 0);

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

/** Real seats from the cabin kit: one InstancedMesh per part; an invisible copy of the seat's shape takes the pointer. */
export default function Seats() {
  const seats = useExperience((s) => s.seats);
  const hoveredId = useExperience((s) => s.hoveredSeatId);
  const selectedId = useExperience((s) => s.selectedSeatId);
  const kit = useKitGeometry();
  const m = cabinMaterials();
  const parts = useRef<Record<string, InstancedMesh | null>>({});
  const hit = useRef<InstancedMesh>(null);
  // picking runs on the seat's own visible shape (cushions, shell, cover): any box proxy either swallows the air
  // above the cushion or overhangs the row behind, and the pointer lands on a neighbour
  const pickShape = useMemo(() => mergeGeometries(['SeatFabric', 'SeatShell', 'SeatCover'].map((n) => kit(n).clone()))!, [kit]);
  const lastProgress = useRef(-1);
  const perSeat = useRef<Matrix4[]>([]);
  const ownSeat = useRef(-1);

  // R3F only raycasts on pointer events. When the camera walks, re-check what is under the
  // still pointer; outside the aisle chapter nothing may stay hovered.
  useFrame((state) => {
    const s = experienceStore.getState();
    // the seat the camera sits in would fill the edge of the view with its own headrest: take it out meanwhile
    const own = s.selectedSeatId && isInsideSeat(state.camera.position, s.selectedSeatId) ? s.seats.findIndex((x) => x.id === s.selectedSeatId) : -1;
    if (own !== ownSeat.current) {
      for (const name of OWN_SEAT_PARTS) {
        const mesh = parts.current[name];
        if (!mesh) continue;
        if (ownSeat.current >= 0) mesh.setMatrixAt(ownSeat.current, perSeat.current[ownSeat.current]);
        if (own >= 0) mesh.setMatrixAt(own, GONE);
        mesh.instanceMatrix.needsUpdate = true;
      }
      ownSeat.current = own;
    }
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
    perSeat.current = seatMatrices(seats);
    ownSeat.current = -1;
    const arms = armMatrices();
    for (const [name, mesh] of Object.entries({ ...parts.current, SeatHit: hit.current })) {
      if (!mesh) continue;
      (name === 'SeatArm' ? arms : perSeat.current).forEach((mat, i) => mesh.setMatrixAt(i, mat));
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
      {part('SeatBelt', m.belt)}
      {part('SeatBuckle', m.buckle)}
      <instancedMesh
        name="SeatHit"
        ref={hit}
        args={[pickShape, undefined, seats.length]}
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
