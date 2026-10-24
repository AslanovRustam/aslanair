'use client';

import type { FormEvent } from 'react';
import { copy } from '@/content/copy';
import { chapterAt } from '@/experience/chapters';
import { trackOf, useExperience } from '@/experience/store';
import { scrollToProgress } from '@/scroll/SmoothScroll';
import GridBackdrop from './GridBackdrop';
import { openHowItsMade } from './HowItsMade';
import styles from './ui.module.css';

/**
 * Final chapter, a dark editorial page over the night sky: the farewell, a visual-only booking form (nothing is ever
 * sent), a short word on how it's made that opens the full panel, and the way back to the start.
 */
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
    // data-lenis-prevent: let the wheel scroll this page natively when it overflows a short window.
    <section className={styles.outro} aria-label="Booking" data-lenis-prevent>
      <GridBackdrop surface />
      <div className={styles.outroColumn}>
        <h2 className={styles.outroTitle}>{t.title}</h2>
        {phase === 'thanks' ? (
          <div className={styles.thanks}>
            <p className={styles.outroLead}>{t.thanks}</p>
            <button type="button" className={styles.button} onClick={onRestart}>
              {t.restart}
            </button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={onSubmit}>
            <p className={styles.outroLead}>{t.lead}</p>
            <label>
              {t.name}
              <input name="name" autoComplete="off" />
            </label>
            <label>
              {t.email}
              <input name="email" type="email" autoComplete="off" />
            </label>
            <label className={styles.wide}>
              {t.comment}
              <textarea name="comment" rows={2} />
            </label>
            <div className={styles.formActions}>
              <button type="submit" className={styles.button}>
                {t.buy}
              </button>
              <button type="button" className={styles.textButton} onClick={onRestart}>
                {t.restart}
              </button>
            </div>
          </form>
        )}
        <aside className={styles.made}>
          <p>{t.made.lead}</p>
          <button type="button" className={styles.ghost} onClick={(e) => openHowItsMade(e.currentTarget)}>
            {t.made.open}
          </button>
        </aside>
      </div>
    </section>
  );
}
