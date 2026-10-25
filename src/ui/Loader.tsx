'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';
import { copy } from '@/content/copy';
import { HERO_PICTURE, INTRO, LOADER } from '@/experience/introState';
import { useExperience } from '@/experience/store';
import styles from './loader.module.css';

const PICTURE_BOX = {
  '--picture-h': HERO_PICTURE.height,
  '--picture-per-w': HERO_PICTURE.perWidth,
  '--picture-lift': HERO_PICTURE.lift,
  '--picture-start': LOADER.start,
  '--picture-grow': `${LOADER.grow}s`,
  '--loader-fade': `${LOADER.fade}s`,
} as CSSProperties;


/**
 * Server-rendered, so it paints before any script: the emblem revealed from its horizon up and the plane picture
 * fading in at half its hero size on the hero's centre; once the scene is ready it grows into the hero's picture and
 * the loader fades, the live plane in its place (SmoothScroll holds the page still meanwhile, so the two meet). The
 * real loading progress is announced to assistive tech, not drawn.
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
        src={INTRO.picture.src}
        width={INTRO.picture.width}
        height={INTRO.picture.height}
        alt=""
        unoptimized
        loading="eager"
        fetchPriority="high"
      />
      <div className={styles.status}>
        {/* a window rising over the emblem while the emblem holds still: transforms only, so the compositor plays it
            even while the page's scripts keep the main thread busy */}
        <span className={styles.reveal} data-part="reveal" aria-hidden="true">
          <span className={styles.revealInner}>
            <svg className={styles.emblem} viewBox="0 0 24 24">
              <defs>
                <mask id="loader-emblem-bands">
                  <rect width="24" height="24" fill="#fff" />
                  <rect x="0" y="13.2" width="24" height="1.8" fill="#000" />
                  <rect x="0" y="16.8" width="24" height="1.8" fill="#000" />
                </mask>
              </defs>
              <circle className={styles.disc} cx="12" cy="12" r="10" mask="url(#loader-emblem-bands)" />
            </svg>
          </span>
        </span>
        <p className={styles.label}>{copy.loader.label}</p>
      </div>
    </div>
  );
}
