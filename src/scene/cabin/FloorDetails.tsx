'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { BoxGeometry, Matrix4, type InstancedMesh } from 'three';
import { SEAT_KIT, SEAT_TRACK_Z } from '@/experience/cabinLayout';
import { FLOOR_Y, ROWS, rowX } from '@/experience/geometry';
import { cabinMaterials } from './materials';

const TRACK = { width: 0.02, height: 0.006, slot: 0.006, overrun: 0.06 };

/** Aluminium seat tracks along the rows, each with its dark slot, from row 1's front feet to row 30's rear feet. */
export default function FloorDetails() {
  const m = cabinMaterials();
  const tracks = useRef<InstancedMesh>(null);
  const slots = useRef<InstancedMesh>(null);
  const front = rowX(1) + SEAT_KIT.depth / 2 + TRACK.overrun;
  const back = rowX(ROWS) - SEAT_KIT.depth / 2 - TRACK.overrun;
  const length = front - back;
  const geometry = useMemo(
    () => ({
      track: new BoxGeometry(length, TRACK.height, TRACK.width),
      slot: new BoxGeometry(length, 0.001, TRACK.slot),
    }),
    [length],
  );

  useLayoutEffect(() => {
    const x = (front + back) / 2;
    SEAT_TRACK_Z.forEach((z, i) => {
      tracks.current!.setMatrixAt(i, new Matrix4().makeTranslation(x, FLOOR_Y + TRACK.height / 2, z));
      slots.current!.setMatrixAt(i, new Matrix4().makeTranslation(x, FLOOR_Y + TRACK.height + 0.0005, z));
    });
    for (const mesh of [tracks.current!, slots.current!]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [front, back]);

  return (
    <group>
      <instancedMesh name="SeatTracks" ref={tracks} args={[geometry.track, m.track, SEAT_TRACK_Z.length]} raycast={() => null} />
      <instancedMesh name="SeatTrackSlots" ref={slots} args={[geometry.slot, m.trackSlot, SEAT_TRACK_Z.length]} raycast={() => null} />
    </group>
  );
}
