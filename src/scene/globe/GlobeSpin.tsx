'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Raycaster, Sphere, Vector2, Vector3, type Camera } from 'three';
import { chapterAt } from '@/experience/chapters';
import { GLOBE, globeFade, spinBy } from '@/experience/globe';
import { experienceStore } from '@/experience/store';

/**
 * After a fling the spin runs down at this rate (per second) from at most `top` and stops below `rest` (CSS px/s); the
 * fling's speed is the drag's, smoothed over about `smooth` s (pointer events come in bursts). A drag held still this
 * long (ms) before letting go is not a fling.
 */
const COAST = { decay: 4, top: 1500, rest: 8, smooth: 0.05, still: 90 };

/** Whether the globe is there to be turned: the destinations chapter, browsing, the globe in view. */
function spinnable(): boolean {
  const s = experienceStore.getState();
  return s.phase === 'browse' && chapterAt('pre', s.progress).id === 'destinations' && globeFade(s.phase, s.progress) > 0.5;
}

/** Turns the globe by a drag of `dx`, `dy` CSS pixels, about the camera's own axes. */
function spin(camera: Camera, dx: number, dy: number, height: number) {
  const s = experienceStore.getState();
  const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  s.spinGlobe(spinBy(s.globeSpin, dx, dy, right, up, height));
}

/**
 * Lets the visitor turn the globe with the pointer: a drag that starts on the globe turns it (on a touch screen only
 * sideways — an up or down swipe still scrolls the page), and a fling coasts to a stop. The plane and the labels
 * turn with it (the spin is in the store); picking a city turns the globe on from there.
 */
export default function GlobeSpin() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const drag = useRef<{ id: number; x: number; y: number; t: number; touch: boolean } | null>(null);
  const coast = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = gl.domElement;
    // up/down swipes stay the page's; sideways ones reach us
    el.style.setProperty('touch-action', 'pan-y pinch-zoom');
    const ray = new Raycaster();
    const sphere = new Sphere(GLOBE.center, GLOBE.radius);
    const pointer = new Vector2();
    const overGlobe = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(pointer, camera);
      return ray.ray.intersectsSphere(sphere);
    };
    const cursor = (e: PointerEvent) => {
      el.style.setProperty('cursor', drag.current ? 'grabbing' : spinnable() && overGlobe(e) ? 'grab' : '');
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || !spinnable() || !overGlobe(e)) return;
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, touch: e.pointerType === 'touch' };
      coast.current = { x: 0, y: 0 };
      el.setPointerCapture(e.pointerId);
      cursor(e);
    };
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.id) return cursor(e);
      const dx = e.clientX - d.x;
      const dy = d.touch ? 0 : e.clientY - d.y;
      spin(camera, dx, dy, el.clientHeight);
      const dt = Math.max(8, e.timeStamp - d.t) / 1000;
      const k = 1 - Math.exp(-dt / COAST.smooth);
      const v = coast.current;
      const [vx, vy] = [v.x + (dx / dt - v.x) * k, v.y + (dy / dt - v.y) * k];
      const over = Math.max(1, Math.hypot(vx, vy) / COAST.top);
      coast.current = { x: vx / over, y: vy / over };
      Object.assign(d, { x: e.clientX, y: e.clientY, t: e.timeStamp });
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.id) return;
      // held still before letting go, or taken over by the page's scroll: no fling
      if (e.type === 'pointercancel' || e.timeStamp - d.t > COAST.still) coast.current = { x: 0, y: 0 };
      drag.current = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      cursor(e);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.style.removeProperty('cursor');
    };
  }, [gl, camera]);

  // a fling coasts to a stop (and stops at once if the chapter is left)
  useFrame((_, delta) => {
    const v = coast.current;
    if (drag.current || (!v.x && !v.y)) return;
    if (!spinnable() || Math.hypot(v.x, v.y) < COAST.rest) {
      coast.current = { x: 0, y: 0 };
      return;
    }
    spin(camera, v.x * delta, v.y * delta, gl.domElement.clientHeight);
    const keep = Math.exp(-COAST.decay * delta);
    coast.current = { x: v.x * keep, y: v.y * keep };
  });

  return null;
}
