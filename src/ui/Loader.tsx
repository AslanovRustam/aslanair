'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';
import { copy } from '@/content/copy';
import { HERO_PICTURE, INTRO } from '@/experience/introState';
import { useExperience } from '@/experience/store';
import styles from './loader.module.css';

const PICTURE_BOX = {
  '--picture-h': HERO_PICTURE.height,
  '--picture-per-w': HERO_PICTURE.perWidth,
  '--picture-lift': HERO_PICTURE.lift,
} as CSSProperties;

/**
 * Server-rendered, so it paints before any script: the emblem drawn as a line, the real loading progress under it,
 * and the plane picture fading in exactly where the hero shows it — the hero takes it over without a jump.
 */
export default function Loader() {
  const progress = useExperience((s) => Math.round(s.loadProgress));
  const ready = useExperience((s) => s.ready);

  return (
    <div
      id="loader"
      className={styles.loader}
      data-ready={ready}
      role="progressbar"
      aria-label={copy.loader.label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      aria-hidden={ready}
      style={PICTURE_BOX}
    >
      <Image
        className={styles.picture}
        src="/images/plane-hero.png"
        width={INTRO.picture.width}
        height={INTRO.picture.height}
        alt=""
        unoptimized
        loading="eager"
        fetchPriority="high"
      />
      <div className={styles.status}>
        <svg className={styles.emblem} viewBox="0 0 24 24" aria-hidden="true">
          <defs>
            <mask id="loader-emblem-bands">
              <rect width="24" height="24" fill="#fff" />
              <rect x="0" y="13.2" width="24" height="1.8" fill="#000" />
              <rect x="0" y="16.8" width="24" height="1.8" fill="#000" />
            </mask>
          </defs>
          <circle className={styles.disc} cx="12" cy="12" r="10" mask="url(#loader-emblem-bands)" />
          <circle className={styles.ring} cx="12" cy="12" r="10" pathLength={1} />
        </svg>
        <span className={styles.bar} aria-hidden="true">
          <span className={styles.fill} style={{ transform: `scaleX(${progress / 100})` }} />
        </span>
        <p className={styles.label}>{copy.loader.label}</p>
      </div>
    </div>
  );
}
