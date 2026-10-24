'use client';

import type { CSSProperties } from 'react';
import { MathUtils } from 'three';
import { copy } from '@/content/copy';
import { chapterAt } from '@/experience/chapters';
import { useExperience } from '@/experience/store';
import styles from './hero.module.css';
import ScrollCue from './ScrollCue';

/** The cue is gone by this fraction of the sky chapter: the first scroll starts the departure. */
const FADE = 0.3;
/** The title flies apart over this stretch of the sky chapter, while the plane climbs away through it. */
const SCATTER = { from: 0.1, to: 0.7 };

/** A repeatable number in [0, 1) for letter `i`, draw `k`: the scatter looks the same on every visit. */
function seeded(i: number, k: number): number {
  const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Where each letter flies on the way out, in ems and degrees: away from the title's middle, up or down, turning.
 * `spread` (−1 … 1 from the first letter to the last) also sets how far apart the letters start their entrance.
 */
function letterVars(i: number, count: number): CSSProperties {
  const spread = (2 * i) / (count - 1) - 1;
  return {
    '--i': i,
    '--spread': spread,
    '--dx': `${(spread * 1.3 + (seeded(i, 0) - 0.5)).toFixed(3)}em`,
    '--dy': `${((seeded(i, 1) - 0.65) * 2.4).toFixed(3)}em`,
    '--turn': `${((seeded(i, 2) - 0.5) * 100).toFixed(1)}deg`,
  } as CSSProperties;
}

/** "Night flight", one span per letter so it can fly apart; assistive tech reads the words, not the letters. */
function Title({ text, scatter }: { text: string; scatter: number }) {
  const count = text.replace(/\s/g, '').length;
  let n = 0;
  return (
    <h1 className={styles.title} data-heading="sky" style={{ '--scatter': scatter } as CSSProperties}>
      <span className={styles.srOnly}>{text}</span>
      {text.split(' ').map((word, w) => (
        <span key={w}>
          {w > 0 && ' '}
          <span className={styles.word} aria-hidden="true">
            {[...word].map((letter) => {
              const i = n++;
              return (
                <span key={i} className={styles.letter} data-part="letter" style={letterVars(i, count)}>
                  <span className={styles.glyph}>{letter}</span>
                </span>
              );
            })}
          </span>
        </span>
      ))}
    </h1>
  );
}

/**
 * The showcase: a huge "Night flight" behind the live plane (its layer sits under the canvas, which is see-through
 * in the showcase) and the scroll hint. Its entrance waits for the loader to hand over. On the first scroll the hint
 * gives way and, as the plane flies off, the title flies apart letter by letter; scrolling back gathers it again.
 */
export default function Hero() {
  const opacity = useExperience((s) => {
    if (s.phase !== 'browse') return 0;
    const { id, t } = chapterAt('pre', s.progress);
    return id === 'sky' ? Math.round(Math.max(0, 1 - t / FADE) * 100) / 100 : 0;
  });
  const scatter = useExperience((s) => {
    if (s.phase !== 'browse') return 1;
    const { id, t } = chapterAt('pre', s.progress);
    return id === 'sky' ? Math.round(MathUtils.smoothstep(t, SCATTER.from, SCATTER.to) * 1000) / 1000 : 1;
  });
  const ready = useExperience((s) => s.ready);
  const t = copy.hero;
  const gone = scatter >= 1;

  return (
    <section
      className={styles.hero}
      data-testid="hero"
      data-ready={ready}
      aria-hidden={opacity === 0 && gone}
      style={{ opacity, visibility: opacity === 0 ? 'hidden' : 'visible' }}
    >
      {/* behind the canvas: the live plane flies in front of the title */}
      <div className={styles.back} style={{ visibility: gone ? 'hidden' : 'visible' }}>
        <Title text={t.title} scatter={scatter} />
      </div>
      <div className={`${styles.front} chapter-ui`}>
        <ScrollCue label={t.scroll} className={styles.scroll} />
      </div>
    </section>
  );
}
