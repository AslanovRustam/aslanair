'use client';

import { useEffect, useRef } from 'react';
import { cellOf, GRID, gridOpacity, trailAlpha } from '@/experience/grid';
import { useExperience } from '@/experience/store';
import styles from './grid.module.css';

/** The trail's fill: the accent, faint (scaled by each cell's fade). */
const TRAIL_RGB = '212, 104, 58';
const TRAIL_ALPHA = 0.12;

/**
 * The grid backdrop (spec r4 §4): faint 64 px lines; near the cursor they light up in the accent and the cells it
 * crosses glow and fade. By default a fixed layer behind the hero title and the see-through canvas, shown on the dark
 * chapters before boarding; `surface` fills its parent instead (the outro's panel). A touch lights the lines only
 * while the finger is down and leaves no trail; reduced motion keeps the glow and drops the trail. Never takes a
 * pointer event.
 */
export default function GridBackdrop({ surface = false }: { surface?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const trail = useRef<HTMLCanvasElement>(null);
  const opacity = useExperience((s) => (surface ? 1 : Math.round(gridOpacity(s.phase, s.progress) * 100) / 100));

  useEffect(() => {
    const el = root.current!;
    const canvas = trail.current!;
    const ctx = canvas.getContext('2d')!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lit = new Map<string, { col: number; row: number; at: number }>();
    let frame = 0;

    const draw = () => {
      frame = 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const now = performance.now();
      for (const [key, cell] of lit) {
        const a = trailAlpha(now - cell.at);
        if (a <= 0) {
          lit.delete(key);
          continue;
        }
        ctx.fillStyle = `rgba(${TRAIL_RGB}, ${(a * TRAIL_ALPHA).toFixed(3)})`;
        ctx.fillRect(cell.col * GRID.cell + 1, cell.row * GRID.cell + 1, GRID.cell - 1, GRID.cell - 1);
      }
      if (lit.size) frame = requestAnimationFrame(draw);
    };

    const onPointer = (e: PointerEvent) => {
      const touch = e.pointerType === 'touch';
      if (touch && e.type === 'pointermove' && !e.buttons) return;
      const box = el.getBoundingClientRect();
      const [x, y] = [e.clientX - box.left, e.clientY - box.top];
      el.style.setProperty('--mx', `${x}px`);
      el.style.setProperty('--my', `${y}px`);
      el.dataset.glow = 'on';
      // no trail under reduced motion, nor while the backdrop is hidden (the cabin, the way out)
      if (touch || reduced || el.style.visibility === 'hidden') return;
      const [col, row] = cellOf(x, y);
      lit.set(`${col},${row}`, { col, row, at: performance.now() });
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const off = () => {
      el.dataset.glow = 'off';
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') off();
    };
    const onOut = (e: MouseEvent) => {
      if (!e.relatedTarget) off();
    };
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(el.clientWidth * dpr);
      canvas.height = Math.round(el.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerdown', onPointer, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('mouseout', onOut);
    window.addEventListener('blur', off);
    document.documentElement.addEventListener('pointerleave', off);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('mouseout', onOut);
      window.removeEventListener('blur', off);
      document.documentElement.removeEventListener('pointerleave', off);
    };
  }, []);

  return (
    <div
      ref={root}
      className={surface ? styles.surface : styles.backdrop}
      data-testid={surface ? 'grid-surface' : 'grid'}
      data-glow="off"
      aria-hidden="true"
      style={surface ? undefined : { opacity, visibility: opacity === 0 ? 'hidden' : 'visible' }}
    >
      <div className={styles.lines} />
      <canvas ref={trail} className={styles.trail} data-testid={surface ? undefined : 'grid-trail'} />
      <div className={styles.lit} />
    </div>
  );
}
