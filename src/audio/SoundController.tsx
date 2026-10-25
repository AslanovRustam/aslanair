'use client';

import { useEffect } from 'react';
import { chapterAt } from '@/experience/chapters';
import { experienceStore, trackOf, type ExperienceState } from '@/experience/store';
import { SoundEngine } from './engine';
import { ambience, announcementDue, oneShots, type SoundSnapshot } from './mix';

/** Where the visitor's choice is kept between visits ('on' | 'off'). */
export const SOUND_KEY = 'aslanair:sound';
/** The gestures that let a page make sound (scrolling is not one). */
const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;

function snapshot(s: ExperienceState): SoundSnapshot & { t: number } {
  const { id, t } = chapterAt(trackOf(s.phase), s.progress);
  return { phase: s.phase, chapter: id, passFlips: s.passFlips, t };
}

/**
 * Sound (spec §4.7): nothing exists until the visitor's first gesture — then the Web Audio graph is made (and its
 * recordings fetched), and from there it follows the store: the beds with the chapter, a one-shot on each event, a
 * boarding call now and then while the airport is heard, the mute at once. The choice to mute is kept in localStorage
 * and read before anything plays.
 */
export default function SoundController() {
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(SOUND_KEY);
    } catch {}
    experienceStore.getState().setSoundOn(stored !== 'off');

    let engine: SoundEngine | null = null;
    const unlock = () => {
      for (const g of GESTURES) window.removeEventListener(g, unlock, true);
      engine = new SoundEngine(new AudioContext());
      const s = snapshot(experienceStore.getState());
      engine.setAmbience(ambience(s.phase, s.chapter, s.t));
      engine.setMuted(!experienceStore.getState().soundOn);
    };
    for (const g of GESTURES) window.addEventListener(g, unlock, { capture: true });

    const unsubscribe = experienceStore.subscribe((now, before) => {
      if (now.soundOn !== before.soundOn) {
        try {
          localStorage.setItem(SOUND_KEY, now.soundOn ? 'on' : 'off');
        } catch {}
        engine?.setMuted(!now.soundOn);
      }
      if (!engine) return;
      const [a, b] = [snapshot(before), snapshot(now)];
      engine.setAmbience(ambience(b.phase, b.chapter, b.t));
      for (const shot of oneShots(a, b)) engine.play(shot);
    });
    const onVisibility = () => engine?.setAwake(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    // the boarding calls: due by the clock, not by the scroll
    const calls = { airportSince: null as number | null, lastAt: null as number | null };
    const clock = window.setInterval(() => {
      if (!engine || document.hidden) return;
      const now = performance.now() / 1000;
      const s = snapshot(experienceStore.getState());
      if (ambience(s.phase, s.chapter, s.t).airport < 0.5) calls.airportSince = null;
      else calls.airportSince ??= now;
      if (announcementDue(now, calls) && engine.announce()) calls.lastAt = now;
    }, 1000);

    return () => {
      for (const g of GESTURES) window.removeEventListener(g, unlock, true);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(clock);
      unsubscribe();
      engine?.close();
    };
  }, []);

  return null;
}
