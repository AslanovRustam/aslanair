'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { TRACKS } from '@/experience/chapters';
import { experienceStore, trackOf, useExperience } from '@/experience/store';

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;
let trigger: ScrollTrigger | null = null;

/** Scrolls the page so the current track sits at progress p (0..1). */
export function scrollToProgress(p: number, immediate: boolean): void {
  if (!lenis || !trigger) return;
  lenis.scrollTo(trigger.start + (trigger.end - trigger.start) * p, { immediate, force: true });
}

export default function SmoothScroll() {
  const track = useExperience((s) => trackOf(s.phase));
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    const instance = new Lenis();
    lenis = instance;
    instance.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      instance.destroy();
      lenis = null;
    };
  }, []);

  // Sitting down freezes the scroll at once; standing up returns to the aisle at that row.
  useEffect(
    () =>
      experienceStore.subscribe((s, prev) => {
        if (s.phase === prev.phase) return;
        if (s.phase === 'seated') lenis?.stop();
        else if (prev.phase === 'seated' && s.phase === 'browse') {
          lenis?.start();
          scrollToProgress(s.progress, true);
        }
      }),
    [],
  );

  // A new track (confirm / change seat) swaps the sections; the layout effect runs before the
  // browser can clamp the scroll, so the store's progress (0, or the aisle row) is still intact.
  useLayoutEffect(() => {
    // Read the target first: refresh() below reports the *old* scroll position to onUpdate.
    const { progress: target, phase, setProgress } = experienceStore.getState();
    const st = ScrollTrigger.create({
      trigger: wrapper.current,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => experienceStore.getState().setProgress(self.progress),
    });
    trigger = st;
    lenis?.resize();
    ScrollTrigger.refresh();
    if (phase !== 'seated') {
      scrollToProgress(target, true);
      setProgress(target);
      lenis?.start();
    }
    return () => {
      st.kill();
      trigger = null;
    };
  }, [track]);

  return (
    <div ref={wrapper} className="scroll-track" aria-hidden>
      {TRACKS[track].map((r) => (
        <section key={r.id} data-chapter={r.id} style={{ height: `${r.heightVh}vh` }} />
      ))}
    </div>
  );
}
