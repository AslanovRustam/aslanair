'use client';

import { createElement, Fragment, useEffect, useState, type CSSProperties, type HTMLAttributes } from 'react';
import { chapterAt, type ChapterId } from '@/experience/chapters';
import { nextShown } from '@/experience/reveal';
import { experienceStore, type ExperienceState } from '@/experience/store';
import styles from './reveal.module.css';

/** The chapter's own progress, or null outside it (or off the browsing track). */
function chapterT(s: ExperienceState, chapter: ChapterId): number | null {
  if (s.phase !== 'browse') return null;
  const at = chapterAt('pre', s.progress);
  return at.id === chapter ? at.t : null;
}

/**
 * Whether `chapter`'s words and cards show: inside `window` of the chapter, with slack at its edges once on
 * (reveal.ts), so a wobble of the scroll never restarts the entrance. The previous answer lives in the subscription.
 */
export function useShown(chapter: ChapterId, window: { from: number; to: number }): boolean {
  const { from, to } = window;
  const [shown, setShown] = useState(() => nextShown(false, chapterT(experienceStore.getState(), chapter), { from, to }));
  useEffect(() => {
    let prev = nextShown(false, chapterT(experienceStore.getState(), chapter), { from, to });
    return experienceStore.subscribe((s) => {
      const next = nextShown(prev, chapterT(s, chapter), { from, to });
      if (next !== prev) setShown((prev = next));
    });
  }, [chapter, from, to]);
  return shown;
}

/**
 * For a card that rises in after the words: its class, its marker and its place in the queue (`d`, 0 first). Merge
 * the class into the element's own.
 */
export function stagger(d: number): { className: string; 'data-stagger': true; style: CSSProperties } {
  return { className: styles.stagger, 'data-stagger': true, style: { '--d': d } as CSSProperties };
}

type RevealTextProps = HTMLAttributes<HTMLElement> & {
  /** The element to render (a heading, a paragraph). */
  as?: 'h1' | 'h2' | 'p' | 'span';
  text: string;
  /** Delay before the first word (ms). */
  base?: number;
};

/**
 * Text that comes in word by word (spec r4 §5) whenever an ancestor shows it — `[data-shown='true']` on a chapter, or
 * `[data-reveal='on']` on something that mounts with its chapter. The words stay ordinary inline text, so the element
 * reads and names as the whole sentence.
 */
export default function RevealText({ as = 'span', text, base = 0, className, ...rest }: RevealTextProps) {
  const words = text.split(' ');
  return createElement(
    as,
    { ...rest, className: className ? `${styles.text} ${className}` : styles.text },
    words.map((word, i) => (
      <Fragment key={i}>
        {i > 0 && ' '}
        <span className={styles.word} data-part="reveal" style={{ '--i': i, '--base': `${base}ms` } as CSSProperties}>
          {word}
        </span>
      </Fragment>
    )),
  );
}
