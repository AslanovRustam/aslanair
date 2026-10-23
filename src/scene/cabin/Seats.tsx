'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  Color,
  InstancedBufferAttribute,
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
import { tapAction } from '@/experience/seatCard';
import { easeLevel, hoverLift, SEAT_GLOW } from '@/experience/seatGlow';
import { SEAT_COLORS, seatVisual } from '@/experience/seats';
import { experienceStore, useExperience } from '@/experience/store';
import { cabinMaterials } from './materials';
import { lastPointerKind } from './pointerKind';

export const KIT_URL = '/models/cabin-kit.glb';
const OCCUPIED_DIM = 0.75;
/** Per-seat parts: they rise with a hovered seat and leave the view while the camera sits in it (arms are shared
 * between neighbours, so they stay). */
const OWN_SEAT_PARTS = ['SeatFabric', 'SeatShell', 'SeatCover', 'SeatLegs', 'SeatBelt', 'SeatBuckle'];
/** Parts that light up: they carry the instanced `seatGlow` attribute (see withSeatGlow). */
const GLOW_PARTS = ['SeatFabric', 'SeatShell', 'SeatCover'];
const GLOW_COLORS = { hover: new Color(SEAT_GLOW.hover.color), selected: new Color(SEAT_GLOW.selected.color) };
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
 * so the node's matrix is baked into a float copy once. The getter is stable: geometry memoised on it (the pick
 * shape) must not be rebuilt on every render, or R3F reconstructs the meshes made from it.
 */
export function useKitGeometry(): (name: string) => BufferGeometry {
  const { nodes } = useGLTF(KIT_URL) as unknown as { nodes: Record<string, Mesh> };
  return useCallback((name) => {
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
  }, [nodes]);
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
  const pickShape = useMemo(
    () => mergeGeometries(['SeatFabric', 'SeatShell', 'SeatCover'].map((n) => kit(n).clone().deleteAttribute('seatGlow')))!,
    [kit],
  );
  // one glow per seat, shared by the parts that light up; the pick shape never moves, so hovering stays steady
  const glow = useRef<InstancedBufferAttribute | null>(null);
  const levels = useRef(new Map<number, number>());
  const chosenSeat = useRef(-1);
  const scratch = useRef({ matrix: new Matrix4(), tint: new Color() });
  const lastProgress = useRef(-1);
  const perSeat = useRef<Matrix4[]>([]);
  const ownSeat = useRef(-1);

  // R3F only raycasts on pointer events. When the camera walks, re-check what is under the
  // still pointer; outside the aisle chapter nothing may stay hovered.
  /** Puts seat `i` back in its place, `lift` metres up; the seat the camera sits in stays out of the view. */
  const placeSeat = (i: number, lift: number) => {
    if (i === ownSeat.current) return;
    const at = scratch.current.matrix.copy(perSeat.current[i]);
    at.elements[13] += lift;
    for (const name of OWN_SEAT_PARTS) {
      const mesh = parts.current[name];
      if (!mesh) continue;
      mesh.setMatrixAt(i, at);
      mesh.instanceMatrix.needsUpdate = true;
    }
  };

  useFrame((state, delta) => {
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

    // the seat under the pointer rises and lights up; the one it leaves settles back down
    const index = (id: string | null) => (id ? s.seats.findIndex((x) => x.id === id) : -1);
    const hovered = index(s.hoveredSeatId);
    if (hovered >= 0 && !levels.current.has(hovered)) levels.current.set(hovered, 0);
    const attribute = glow.current;
    if (!attribute) return;
    const g = attribute.array as Float32Array;
    const tint = scratch.current.tint;
    const pulse = 1 + SEAT_GLOW.hover.pulse * Math.sin(2 * Math.PI * SEAT_GLOW.hover.hz * state.clock.elapsedTime);
    for (const [i, level] of levels.current) {
      const next = easeLevel(level, i === hovered ? 1 : 0, delta);
      const settled = i !== hovered && next < 1e-3;
      if (settled) levels.current.delete(i);
      else levels.current.set(i, next);
      placeSeat(i, settled ? 0 : hoverLift(next));
      tint.copy(GLOW_COLORS.hover).multiplyScalar(settled ? 0 : next * SEAT_GLOW.hover.strength * pulse).toArray(g, i * 3);
    }
    // the chosen seat keeps a warm glow while it is yours
    const chosen = s.phase !== 'browse' ? index(s.selectedSeatId) : -1;
    if (chosen !== chosenSeat.current && chosenSeat.current >= 0 && !levels.current.has(chosenSeat.current)) {
      g.fill(0, chosenSeat.current * 3, chosenSeat.current * 3 + 3);
    }
    chosenSeat.current = chosen;
    if (chosen >= 0) tint.copy(GLOW_COLORS.selected).multiplyScalar(SEAT_GLOW.selected.strength).toArray(g, chosen * 3);
    attribute.needsUpdate = true;
  });

  useLayoutEffect(() => {
    const attribute = new InstancedBufferAttribute(new Float32Array(seats.length * 3), 3);
    for (const name of GLOW_PARTS) kit(name).setAttribute('seatGlow', attribute);
    glow.current = attribute;
  }, [kit, seats.length]);

  useLayoutEffect(() => {
    perSeat.current = seatMatrices(seats);
    ownSeat.current = -1;
    levels.current.clear();
    if (glow.current) {
      (glow.current.array as Float32Array).fill(0);
      glow.current.needsUpdate = true;
    }
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

  // on touch there is no hover: a first tap focuses a seat (its card shows), a second tap sits
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!interactive() || e.instanceId === undefined || lastPointerKind() === 'touch') return;
    const seat = seats[e.instanceId];
    const id = seat.status === 'free' ? seat.id : null;
    if (experienceStore.getState().hoveredSeatId !== id) experienceStore.getState().hover(id);
    setCursor(id !== null);
  };

  const onOut = () => {
    if (lastPointerKind() === 'touch') return;
    experienceStore.getState().hover(null);
    setCursor(false);
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!interactive() || e.instanceId === undefined) return;
    const seat = seats[e.instanceId];
    const s = experienceStore.getState();
    if (tapAction(lastPointerKind(), s.hoveredSeatId, seat.id) === 'focus') {
      s.hover(seat.status === 'free' ? seat.id : null);
      return;
    }
    if (s.sit(seat.id)) setCursor(false);
  };

  // on touch, a tap anywhere off the seats lets go of the focused one
  const onMissed = () => {
    if (interactive() && lastPointerKind() === 'touch') experienceStore.getState().hover(null);
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
        onPointerMissed={onMissed}
      >
        <meshBasicMaterial visible={false} />
      </instancedMesh>
    </group>
  );
}

useGLTF.preload(KIT_URL);
