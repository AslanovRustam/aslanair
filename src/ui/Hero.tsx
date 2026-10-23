'use client';

import type { CSSProperties } from 'react';
import { copy } from '@/content/copy';
import { chapterAt } from '@/experience/chapters';
import { useExperience } from '@/experience/store';
import styles from './hero.module.css';

/** The hero is gone by this fraction of the sky chapter: the first scroll starts the flight to the door. */
const FADE = 0.3;

type Leader = { length: string; angle: string };

function Note({ className, label, value, leader }: { className: string; label: string; value: string; leader: Leader }) {
  return (
    <li className={`${styles.note} ${className}`} data-testid="hero-note">
      <span className={styles.noteLabel}>{label}</span>
      <span className={styles.noteValue}>{value}</span>
      <span className={styles.leader} style={{ '--length': leader.length, '--angle': leader.angle } as CSSProperties} aria-hidden="true" />
    </li>
  );
}

/**
 * The showcase: a huge "Night flight" behind the plane, three facts pointing at it, a short lead and the scroll
 * hint. It hands over to the flight as soon as the visitor scrolls.
 */
export default function Hero() {
  const opacity = useExperience((s) => {
    if (s.phase !== 'browse') return 0;
    const { id, t } = chapterAt('pre', s.progress);
    return id === 'sky' ? Math.round(Math.max(0, 1 - t / FADE) * 100) / 100 : 0;
  });
  const from = useExperience((s) => Math.min(...s.seats.map((seat) => seat.priceUsd)));
  const t = copy.hero;

  return (
    <section
      className={styles.hero}
      data-testid="hero"
      aria-hidden={opacity === 0}
      style={{ opacity, visibility: opacity === 0 ? 'hidden' : 'visible' }}
    >
      <h1 className={styles.title}>{t.title}</h1>
      <ul className={styles.notes}>
        <Note className={styles.route} label={t.notes.route.label} value={t.notes.route.value} leader={{ length: '7.5rem', angle: '155deg' }} />
        <Note className={styles.cabin} label={t.notes.cabin.label} value={t.notes.cabin.value} leader={{ length: '6.5rem', angle: '-35deg' }} />
        <Note className={styles.price} label={t.notes.price.label} value={t.notes.price.value(from)} leader={{ length: '5.5rem', angle: '-150deg' }} />
      </ul>
      <p className={styles.lead}>
        <strong>{t.lead.title}</strong>
        {t.lead.body}
      </p>
      <p className={styles.scroll}>{t.scroll}</p>
    </section>
  );
}
