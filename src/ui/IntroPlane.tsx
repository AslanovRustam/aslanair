'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { INTRO, introState } from '@/experience/introState';
import { experienceStore } from '@/experience/store';
import styles from './introPlane.module.css';

/**
 * The hero's plane: the picture captured at the swap pose, full height and centred like the 3D frame, so when it
 * lands it lies exactly over the live model. Driven straight from the store, a frame at a time, without renders.
 */
export default function IntroPlane() {
  const frame = useRef<HTMLDivElement>(null);
  const picture = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = frame.current!;
    const img = picture.current!;
    const apply = () => {
      const s = experienceStore.getState();
      const intro = s.phase === 'browse' ? introState(s.progress, el.clientWidth / el.clientHeight) : null;
      const opacity = intro?.imageOpacity ?? 0;
      el.style.opacity = String(opacity);
      el.style.visibility = opacity === 0 ? 'hidden' : 'visible';
      if (intro) img.style.transform = `translate(-50%, ${-intro.imageY * 100}%) scale(${intro.imageScale})`;
    };
    apply();
    const unsubscribe = experienceStore.subscribe(apply);
    window.addEventListener('resize', apply);
    return () => {
      unsubscribe();
      window.removeEventListener('resize', apply);
    };
  }, []);

  return (
    <div ref={frame} className={styles.frame} data-testid="intro-plane" aria-hidden="true">
      {/* unoptimized: the swap needs the captured pixels exactly, not a re-encoded copy */}
      <Image
        ref={picture}
        className={styles.picture}
        src="/images/plane-hero.png"
        width={INTRO.picture.width}
        height={INTRO.picture.height}
        alt=""
        unoptimized
        preload
      />
    </div>
  );
}
