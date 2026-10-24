'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { TRACKS } from '@/experience/chapters';
import { experienceStore, trackOf, useExperience } from '@/experience/store';

gsap.registerPlugin(ScrollTrigger);
// ScrollTrigger re-applies the scrollRestoration it saw at registration on every refresh;
// pin it to 'manual' so a reload always starts at the sky.
ScrollTrigger.clearScrollMemory('manual');

let lenis: Lenis | null = null;
let trigger: ScrollTrigger | null = null;
/** True while a track swap scrolls to its own target; resize restoration stays out of the way. */
let swapping = false;

/** Scrolls the page so the current track sits at progress p (0..1). */
export function scrollToProgress(p: number, immediate: boolean): void {
  if (!lenis || !trigger) return;
  lenis.scrollTo(trigger.start + (trigger.end - trigger.start) * p, { immediate, force: true });
}

/** Holds the visitor's own scrolling still (while the curtain runs); scrollToProgress still moves the page. */
export function lockScroll(on: boolean): void {
  if (on) lenis?.stop();
  else lenis?.start();
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

    // A resize or rotation changes the pixel height of every vh section; keep the story position.
    let saved = 0;
    const onRefreshInit = () => {
      if (!swapping) saved = experienceStore.getState().progress;
    };
    const onRefresh = () => {
      if (swapping) return;
      instance.resize();
      scrollToProgress(saved, true);
      experienceStore.getState().setProgress(saved);
    };
    ScrollTrigger.addEventListener('refreshInit', onRefreshInit);
    ScrollTrigger.addEventListener('refresh', onRefresh);
    return () => {
      ScrollTrigger.removeEventListener('refreshInit', onRefreshInit);
      ScrollTrigger.removeEventListener('refresh', onRefresh);
      gsap.ticker.remove(tick);
      instance.destroy();
      lenis = null;
    };
  }, []);

  // Sitting down freezes the scroll at once; standing up returns to where the visitor was in the aisle.
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
    swapping = true;
    lenis?.resize();
    ScrollTrigger.refresh();
    if (phase !== 'seated') {
      scrollToProgress(target, true);
      setProgress(target);
      lenis?.start();
    }
    swapping = false;
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
