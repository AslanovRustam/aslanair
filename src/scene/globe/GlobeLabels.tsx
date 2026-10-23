'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { chapterAt } from '@/experience/chapters';
import { DESTINATIONS, destination } from '@/experience/destinations';
import { GLOBE, globeTurnAt, latLonToVector } from '@/experience/globe';
import { experienceStore } from '@/experience/store';
import { globeLabels } from '@/ui/globeLabels';

type Box = { x0: number; y0: number; x1: number; y1: number };
type Side = 'left' | 'right' | 'above' | 'below';
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** A label's words beside its marker, in CSS pixels (the chosen one carries its fare too). */
const WORDS = { width: 30, chosenWidth: 96, height: 14, gap: 12 };
/** A marker's own dot, which no label's words may cover. */
const DOT = 8;
/** Words keep this far inside the screen (CSS pixels). */
const EDGE = 4;
/** Markers this near the rim lose their label: too foreshortened to aim at (in R² of the sight-line test). */
const RIM = 1.6;

/**
 * Keeps each destination's label on its marker: every frame it projects the markers through the camera and the
 * globe's turn, hides the labels of markers round the back, and sets each label's words beside its marker on the
 * side away from the globe's middle — or the other side, above, below, or none, so no words cover another label or a
 * marker or run off the screen.
 */
export default function GlobeLabels() {
  const size = useThree((s) => s.size);
  useFrame(({ camera }) => {
    const s = experienceStore.getState();
    if (!globeLabels.size || s.phase !== 'browse' || chapterAt('pre', s.progress).id !== 'destinations') return;
    const chosen = destination(s.destinationId)!;
    const turn = globeTurnAt(s.flight, chosen, performance.now() / 1000, s.globeSpin);
    const toEye = camera.position.clone().sub(GLOBE.center);
    const toScreen = (p: { x: number; y: number }) => ({ x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height });
    const middle = toScreen(GLOBE.center.clone().project(camera));
    const marks = DESTINATIONS.map((d) => {
      const p = latLonToVector(d.lat, d.lon, GLOBE.radius * 1.01).applyQuaternion(turn);
      const facing = p.dot(toEye) > GLOBE.radius * GLOBE.radius * RIM;
      return { d, facing, ...toScreen(p.add(GLOBE.center).project(camera)) };
    });
    const taken: Box[] = marks.filter((m) => m.facing).map((m) => ({ x0: m.x - DOT, y0: m.y - DOT, x1: m.x + DOT, y1: m.y + DOT }));
    // the chosen one first, then from the middle out: they keep their words when two would overlap
    const order = [...marks].sort((a, b) =>
      a.d === chosen ? -1 : b.d === chosen ? 1 : Math.hypot(a.x - middle.x, a.y - middle.y) - Math.hypot(b.x - middle.x, b.y - middle.y),
    );
    for (const m of order) {
      const el = globeLabels.get(m.d.code);
      if (!el) continue;
      el.style.transform = `translate3d(${m.x}px, ${m.y}px, 0)`;
      el.dataset.facing = String(m.facing);
      if (!m.facing) continue;
      const width = m.d === chosen ? WORDS.chosenWidth : WORDS.width;
      const words = (side: Side): Box => {
        const x0 = side === 'right' ? m.x + WORDS.gap : side === 'left' ? m.x - WORDS.gap - width : m.x - width / 2;
        const y0 = side === 'above' ? m.y - WORDS.gap - WORDS.height : side === 'below' ? m.y + WORDS.gap : m.y - WORDS.height / 2;
        return { x0, x1: x0 + width, y0, y1: y0 + WORDS.height };
      };
      const onScreen = (b: Box) => b.x0 > EDGE && b.y0 > EDGE && b.x1 < size.width - EDGE && b.y1 < size.height - EDGE;
      const sides: Side[] = m.x < middle.x ? ['left', 'right', 'above', 'below'] : ['right', 'left', 'above', 'below'];
      const side = sides.find((sd) => onScreen(words(sd)) && !taken.some((b) => overlaps(b, words(sd))));
      el.dataset.side = side ?? 'none';
      if (side) taken.push(words(side));
    }
  });
  return null;
}
