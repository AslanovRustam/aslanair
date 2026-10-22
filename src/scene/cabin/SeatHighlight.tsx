'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BackSide, Box3, MeshBasicMaterial, NormalBlending, Vector3, type Mesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { isInsideSeat } from '@/experience/cabinLayout';
import { chapterAt } from '@/experience/chapters';
import { seatWorldPosition, type SeatLetter } from '@/experience/geometry';
import { experienceStore, trackOf } from '@/experience/store';
import { useKitGeometry } from './Seats';

const GROW = 1.08;
const HOVER = { color: '#6fd3cc', opacity: 0.7, pulse: 0.15, hz: 1.2 };
const SELECTED = { color: '#d4683a', opacity: 0.85 };
/** The grown outline shell reaches further than the seat: hide it from this far out. */
const OUTLINE_INSIDE = 0.9;

/** Which seat to mark and how, from the store; null hides the highlight. */
function target(): { id: string; kind: 'hover' | 'selected' } | null {
  const s = experienceStore.getState();
  if (s.phase === 'browse') {
    return s.hoveredSeatId && chapterAt('pre', s.progress).id === 'aisle' ? { id: s.hoveredSeatId, kind: 'hover' } : null;
  }
  if (!s.selectedSeatId) return null;
  // the camera has left the cabin from the exit chapter on
  if (trackOf(s.phase) === 'post' && chapterAt('post', s.progress).id !== 'pass') return null;
  return { id: s.selectedSeatId, kind: 'selected' };
}

/** Inverted-hull rim around one seat: the seat's fabric + cover, grown about its centre, back faces only. Normal
 * blending keeps the colour (additive washed out to white over the light cabin). */
export default function SeatHighlight() {
  const kit = useKitGeometry();
  const mesh = useRef<Mesh>(null);
  const geometry = useMemo(() => {
    const g = mergeGeometries([kit('SeatFabric').clone(), kit('SeatCover').clone()])!;
    const c = new Box3().setFromBufferAttribute(g.getAttribute('position') as never).getCenter(new Vector3());
    return g.translate(-c.x, -c.y, -c.z).scale(GROW, GROW, GROW).translate(c.x, c.y, c.z);
  }, [kit]);
  const material = useMemo(
    () => new MeshBasicMaterial({ side: BackSide, transparent: true, blending: NormalBlending, depthWrite: false, toneMapped: false }),
    [],
  );

  useFrame(({ clock, camera }) => {
    const m = mesh.current;
    if (!m) return;
    const t = target();
    m.visible = !!t;
    if (!t) return;
    const [x, y, z] = seatWorldPosition(Number(t.id.slice(0, -1)), t.id.at(-1) as SeatLetter);
    m.position.set(x, y, z);
    // seated in it: the camera is inside the shell and would see a wedge of outline
    if (isInsideSeat(camera.position, t.id, OUTLINE_INSIDE)) {
      m.visible = false;
      return;
    }
    if (t.kind === 'hover') {
      material.color.set(HOVER.color);
      material.opacity = HOVER.opacity + HOVER.pulse * Math.sin(2 * Math.PI * HOVER.hz * clock.elapsedTime);
    } else {
      material.color.set(SELECTED.color);
      material.opacity = SELECTED.opacity;
    }
  });

  return <mesh ref={mesh} name="SeatHighlight" geometry={geometry} material={material} renderOrder={2} raycast={() => null} visible={false} />;
}
