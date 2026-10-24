'use client';

import { Fragment, type CSSProperties } from 'react';
import { copy } from '@/content/copy';
import { chapterAt } from '@/experience/chapters';
import { useExperience } from '@/experience/store';
import styles from './ready.module.css';
import RevealText, { useShown } from './RevealText';
import ScrollCue from './ScrollCue';

/** The words show over this stretch of the chapter; the promise lights up over the second. */
const SHOWN = { from: 0.04, to: 0.9 };
const LIGHTS = { from: 0.1, to: 0.85 };

const WORDS = copy.ready.promise.split(' ');

/**
 * Ready to choose your seat: the question, a promise that lights up word by word as the visitor scrolls (each word
 * from a faint outline to full ink over its own slice of the chapter; opacity only) and the scroll cue. The plane
 * turns to face the camera meanwhile and door 1L comes ajar, warm light at its seams (Aircraft).
 */
export default function Ready() {
  const t = useExperience((s) => {
    if (s.phase !== 'browse') return null;
    const at = chapterAt('pre', s.progress);
    return at.id === 'ready' ? Math.round(at.t * 1000) / 1000 : null;
  });
  const shown = useShown('ready', SHOWN);
  // 0 … 1 across the words: each word lights over the next two words' worth
  const lit = t === null ? 0 : (t - LIGHTS.from) / (LIGHTS.to - LIGHTS.from);

  return (
    <section className={styles.ready} data-testid="ready" data-shown={shown} aria-hidden={!shown}>
      <div className={styles.words}>
        <RevealText as="h2" className={styles.title} data-heading="ready" text={copy.ready.title} />
        <p className={styles.promise} style={{ '--lit': lit } as CSSProperties}>
          {WORDS.map((word, i) => (
            <Fragment key={i}>
              {i > 0 && ' '}
              <span
                className={styles.word}
                data-part="word"
                style={{ '--from': i / (WORDS.length + 1), '--span': 2 / (WORDS.length + 1) } as CSSProperties}
              >
                <span className={styles.outline} aria-hidden="true">
                  {word}
                </span>
                <span className={styles.ink}>{word}</span>
              </span>
            </Fragment>
          ))}
        </p>
      </div>
      <ScrollCue label={copy.ready.scroll} className={styles.cue} />
    </section>
  );
}
