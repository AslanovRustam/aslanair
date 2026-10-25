'use client';

import { useRef, useState, type FormEvent } from 'react';
import { copy } from '@/content/copy';
import { validateBooking } from '@/experience/bookingForm';
import { chapterAt } from '@/experience/chapters';
import { transitionLabel } from '@/experience/navState';
import { trackOf, useExperience } from '@/experience/store';
import { scrollToProgress } from '@/scroll/SmoothScroll';
import GridBackdrop from './GridBackdrop';
import RevealText from './RevealText';
import { transitionTo } from './transition';
import styles from './ui.module.css';

type Field = 'name' | 'email';

/** Grows the comment box with its words where the browser cannot (no CSS field-sizing); the CSS caps its height. */
function fitToWords(box: HTMLTextAreaElement) {
  if (CSS.supports('field-sizing', 'content')) return;
  box.style.height = 'auto';
  box.style.height = `${box.scrollHeight + box.offsetHeight - box.clientHeight}px`;
}

/**
 * The booking form (nothing is ever sent): Buy goes through once the name and the e-mail are right (validateBooking).
 * What is wrong shows under its field after Buy, or as soon as the visitor leaves a field filled in wrong, and follows
 * the typing from then on; Buy takes the visitor to the first field to put right.
 */
function BookingForm({ onBuy, onRestart }: { onBuy: () => void; onRestart: () => void }) {
  const t = copy.outro;
  const [values, setValues] = useState({ name: '', email: '' });
  const [shown, setShown] = useState<Record<Field, boolean>>({ name: false, email: false });
  const inputs = useRef<Record<Field, HTMLInputElement | null>>({ name: null, email: null });
  const errors = validateBooking(values);
  const message: Record<Field, string | undefined> = {
    name: errors.name && (errors.name === 'required' ? t.errors.nameRequired : t.errors.nameShort),
    email: errors.email && (errors.email === 'required' ? t.errors.emailRequired : t.errors.emailInvalid),
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const wrong = (['name', 'email'] as const).find((f) => errors[f]);
    if (!wrong) return onBuy();
    setShown({ name: true, email: true });
    inputs.current[wrong]?.focus();
  };

  const field = (id: Field, label: string, type: string) => {
    const error = shown[id] ? message[id] : undefined;
    return (
      <div className={styles.field}>
        <label>
          {label}
          <input
            ref={(el) => {
              inputs.current[id] = el;
            }}
            name={id}
            type={type}
            autoComplete="off"
            required
            value={values[id]}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `booking-${id}-error` : undefined}
            onChange={(e) => setValues((v) => ({ ...v, [id]: e.target.value }))}
            // left filled in wrong: say so now; left empty: wait for Buy
            onBlur={() => values[id].trim() && setShown((s) => ({ ...s, [id]: true }))}
          />
        </label>
        {/* always there, its line kept: a note appearing as the field loses focus never moves Buy from under a
            click, and a screen reader hears it */}
        <p id={`booking-${id}-error`} className={styles.fieldError} aria-live="polite">
          {error}
        </p>
      </div>
    );
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <p className={styles.outroLead}>{t.lead}</p>
      {field('name', t.name, 'text')}
      {field('email', t.email, 'email')}
      <label className={styles.wide}>
        {t.comment}
        <textarea name="comment" rows={1} maxLength={500} onInput={(e) => fitToWords(e.currentTarget)} />
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
  );
}

/**
 * Final chapter, a dark editorial page over the night sky: the farewell, a visual-only booking form (nothing is ever
 * sent), a short word on how it's made, and the way back to the start.
 */
export default function Outro() {
  const phase = useExperience((s) => s.phase);
  const chapter = useExperience((s) => chapterAt(trackOf(s.phase), s.progress).id);
  const submitForm = useExperience((s) => s.submitForm);
  const restart = useExperience((s) => s.restart);

  if (!((phase === 'confirmed' || phase === 'thanks') && chapter === 'outro')) return null;

  // back to the top under the curtain
  const onRestart = () =>
    transitionTo(transitionLabel('restart', phase), () => {
      restart();
      scrollToProgress(0, true);
    });

  const t = copy.outro;
  return (
    // data-lenis-prevent: let the wheel scroll this page natively when it overflows a short window.
    <section className={`${styles.outro} chapter-ui`} aria-label="Booking" data-lenis-prevent>
      <GridBackdrop surface />
      <div className={styles.outroColumn}>
        <RevealText as="h2" className={styles.outroTitle} data-reveal="on" text={t.title} />
        {phase === 'thanks' ? (
          <div className={styles.thanks}>
            <p className={styles.outroLead}>{t.thanks}</p>
            <button type="button" className={styles.button} onClick={onRestart}>
              {t.restart}
            </button>
          </div>
        ) : (
          <BookingForm onBuy={submitForm} onRestart={onRestart} />
        )}
        <aside className={styles.made}>
          <p>{t.made.lead}</p>
        </aside>
      </div>
    </section>
  );
}
