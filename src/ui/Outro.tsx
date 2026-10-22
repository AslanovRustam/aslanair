'use client';

import type { FormEvent } from 'react';
import { copy } from '@/content/copy';
import { chapterAt } from '@/experience/chapters';
import { trackOf, useExperience } from '@/experience/store';
import { scrollToProgress } from '@/scroll/SmoothScroll';
import styles from './ui.module.css';

/** Final chapter: a visual-only booking form. Nothing is ever sent. */
export default function Outro() {
  const phase = useExperience((s) => s.phase);
  const chapter = useExperience((s) => chapterAt(trackOf(s.phase), s.progress).id);
  const submitForm = useExperience((s) => s.submitForm);
  const restart = useExperience((s) => s.restart);

  if (!((phase === 'confirmed' || phase === 'thanks') && chapter === 'outro')) return null;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitForm();
  };

  const onRestart = () => {
    restart();
    scrollToProgress(0, true);
  };

  const t = copy.outro;
  return (
    // data-lenis-prevent: let the wheel scroll this panel natively when it overflows a short window.
    <section className={styles.outro} aria-label="Booking" data-lenis-prevent>
      <div className={styles.panel}>
        <h2>{t.title}</h2>
        {phase === 'thanks' ? (
          <>
            <p>{t.thanks}</p>
            <button type="button" className={styles.button} onClick={onRestart}>
              {t.restart}
            </button>
          </>
        ) : (
          <form className={styles.form} onSubmit={onSubmit}>
            <p>{t.lead}</p>
            <label>
              {t.name}
              <input name="name" autoComplete="off" />
            </label>
            <label>
              {t.email}
              <input name="email" type="email" autoComplete="off" />
            </label>
            <label>
              {t.comment}
              <textarea name="comment" rows={3} />
            </label>
            <button type="submit" className={styles.button}>
              {t.buy}
            </button>
          </form>
        )}
      </div>
      <aside className={styles.panel}>
        <h3>{t.howItsMade.title}</h3>
        <ul>
          {t.howItsMade.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className={styles.author}>{t.howItsMade.author}</p>
      </aside>
    </section>
  );
}
