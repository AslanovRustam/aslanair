'use client';

import type { CSSProperties } from 'react';
import { copy } from '@/content/copy';
import { chapterAt } from '@/experience/chapters';
import { INTRO } from '@/experience/introState';
import { useExperience } from '@/experience/store';
import styles from './hero.module.css';
import ScrollCue from './ScrollCue';

/** The hero is gone by this fraction of the sky chapter: the first scroll starts the flight to the door. */
const FADE = 0.3;

type Point = readonly [number, number];
type NoteId = keyof typeof copy.hero.notes;

/**
 * Each note: where its text stands (`at`, the leader's outer end), which way the text runs from there, and the spot
 * on the plane its leader runs to — in fractions of the plane's box in the hero picture.
 */
const NOTES: Record<NoteId, { at: Point; to: Point; runs: 'left' | 'right' }> = {
  route: { at: [1.16, 0.84], to: [0.93, 0.68], runs: 'right' }, // to the wingtip light: under the title, over the rail
  cabin: { at: [0.04, 2.35], to: [0.3, 0.6], runs: 'left' }, // to the cabin windows
  price: { at: [0.82, 2.8], to: [0.56, 0.84], runs: 'right' }, // to the belly
};

/** The plane's box in the hero picture, in frame heights (x from the frame's centre line), for the CSS. */
function planeBoxVars(): CSSProperties {
  const { plane, width, height } = INTRO.picture;
  const h = INTRO.heroScale;
  const w = h * (width / height);
  return {
    '--box-x': (plane.left - 0.5) * w,
    '--box-y': 0.5 - INTRO.heroLift + (plane.top - 0.5) * h,
    '--box-w': (plane.right - plane.left) * w,
    '--box-h': (plane.bottom - plane.top) * h,
  } as CSSProperties;
}

function Note({ id, label, value }: { id: NoteId; label: string; value: string }) {
  const { at, runs } = NOTES[id];
  return (
    <li
      className={`${styles.note} ${styles[id]}`}
      data-runs={runs}
      data-testid="hero-note"
      style={{ '--x': at[0], '--y': at[1] } as CSSProperties}
    >
      <span className={styles.noteLabel}>{label}</span>
      <span className={styles.noteValue}>{value}</span>
    </li>
  );
}

/**
 * The showcase: a huge "Night flight" behind the live plane (its layer sits under the canvas, which is see-through
 * in the showcase), three facts pointing at the plane, a short lead and the scroll hint. Its entrance waits for the loader to hand over; it gives way to the flight as soon as the visitor
 * scrolls.
 */
export default function Hero() {
  const opacity = useExperience((s) => {
    if (s.phase !== 'browse') return 0;
    const { id, t } = chapterAt('pre', s.progress);
    return id === 'sky' ? Math.round(Math.max(0, 1 - t / FADE) * 100) / 100 : 0;
  });
  const from = useExperience((s) => Math.min(...s.seats.map((seat) => seat.priceUsd)));
  const ready = useExperience((s) => s.ready);
  const t = copy.hero;

  return (
    <section
      className={styles.hero}
      data-testid="hero"
      data-ready={ready}
      aria-hidden={opacity === 0}
      style={{ opacity, visibility: opacity === 0 ? 'hidden' : 'visible' }}
    >
      {/* behind the canvas: the live plane flies in front of the title */}
      <div className={styles.back}>
        <h1 className={styles.title}>{t.title}</h1>
      </div>
      <div className={styles.front} style={planeBoxVars()}>
        <div className={styles.planeBox}>
          <svg className={styles.leaders} viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
            {(Object.keys(NOTES) as NoteId[]).map((id) => (
              <line
                key={id}
                className={styles[id]}
                data-testid="hero-leader"
                x1={NOTES[id].at[0]}
                y1={NOTES[id].at[1]}
                x2={NOTES[id].to[0]}
                y2={NOTES[id].to[1]}
              />
            ))}
          </svg>
          <ul className={styles.notes}>
            <Note id="route" label={t.notes.route.label} value={t.notes.route.value} />
            <Note id="cabin" label={t.notes.cabin.label} value={t.notes.cabin.value} />
            <Note id="price" label={t.notes.price.label} value={t.notes.price.value(from)} />
          </ul>
        </div>
        <p className={styles.lead}>
          <strong>{t.lead.title}</strong>
          {t.lead.body}
        </p>
        <ScrollCue label={t.scroll} className={styles.scroll} />
      </div>
    </section>
  );
}
