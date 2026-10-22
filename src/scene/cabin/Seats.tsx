'use client';

import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { Color, Matrix4, type Group, type InstancedMesh } from 'three';
import { chapterAt } from '@/experience/chapters';
import { seatWorldPosition } from '@/experience/geometry';
import { SEAT_COLORS, seatVisual } from '@/experience/seats';
import { experienceStore, useExperience } from '@/experience/store';
import { cabinVisible } from '@/experience/visibility';

// Placeholder seat blocks (Plan 3 brings real seats). Seats face +X; covers sit on the
// front of the backrest top, so they face a camera walking aft.
const BODY = { depth: 0.5, height: 0.9, width: 0.44, color: '#d9d6cf' };
const COVER = { depth: 0.06, height: 0.16, width: 0.4 };
const OCCUPIED_DIM = 0.75;

const interactive = () => {
  const s = experienceStore.getState();
  return s.phase === 'browse' && chapterAt('pre', s.progress).id === 'aisle';
};

function setCursor(pointer: boolean) {
  document.body.style.cursor = pointer ? 'pointer' : '';
}

export default function Seats() {
  const seats = useExperience((s) => s.seats);
  const hoveredId = useExperience((s) => s.hoveredSeatId);
  const selectedId = useExperience((s) => s.selectedSeatId);
  const group = useRef<Group>(null);
  const body = useRef<InstancedMesh>(null);
  const cover = useRef<InstancedMesh>(null);
  const lastProgress = useRef(-1);

  // R3F only raycasts on pointer events. When the camera walks, re-check what is under the
  // still pointer; outside the aisle chapter nothing may stay hovered.
  useFrame((state) => {
    const s = experienceStore.getState();
    if (group.current) group.current.visible = cabinVisible(s.phase, s.progress);
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
    const m = new Matrix4();
    seats.forEach((seat, i) => {
      const [x, y, z] = seatWorldPosition(seat.row, seat.letter);
      body.current!.setMatrixAt(i, m.makeTranslation(x, y + BODY.height / 2, z));
      cover.current!.setMatrixAt(i, m.makeTranslation(x + BODY.depth / 2 + COVER.depth / 2, y + BODY.height - 0.1, z));
    });
    for (const mesh of [body.current!, cover.current!]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [seats]);

  useLayoutEffect(() => {
    const c = new Color();
    seats.forEach((seat, i) => {
      c.set(BODY.color);
      if (seat.status === 'occupied') c.multiplyScalar(OCCUPIED_DIM);
      body.current!.setColorAt(i, c);
      cover.current!.setColorAt(i, c.set(SEAT_COLORS[seatVisual(seat, hoveredId, selectedId)]));
    });
    body.current!.instanceColor!.needsUpdate = true;
    cover.current!.instanceColor!.needsUpdate = true;
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

  return (
    <group ref={group}>
      <instancedMesh ref={body} args={[undefined, undefined, seats.length]} onPointerMove={onMove} onPointerOut={onOut} onClick={onClick}>
        <boxGeometry args={[BODY.depth, BODY.height, BODY.width]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={cover} args={[undefined, undefined, seats.length]} raycast={() => null}>
        <boxGeometry args={[COVER.depth, COVER.height, COVER.width]} />
        <meshStandardMaterial color="#ffffff" roughness={0.8} />
      </instancedMesh>
    </group>
  );
}
