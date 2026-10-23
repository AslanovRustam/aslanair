'use client';

import type { CSSProperties } from 'react';
import { MathUtils } from 'three';
import { copy } from '@/content/copy';
import { chapterAt } from '@/experience/chapters';
import { DESTINATIONS } from '@/experience/destinations';
import { INTRO } from '@/experience/introState';
import { useExperience } from '@/experience/store';
import styles from './hero.module.css';
import ScrollCue from './ScrollCue';

/** The facts, lead and cue are gone by this fraction of the sky chapter: the first scroll starts the departure. */
const FADE = 0.3;
/** The title flies apart over this stretch of the sky chapter, while the plane climbs away through it. */
const SCATTER = { from: 0.1, to: 0.7 };

type Point = readonly [number, number];
type NoteId = keyof typeof copy.hero.notes;

/**
 * Each note: where its text stands (`at`, the leader's outer end), which way the text runs from there, and the spot
 * on the plane its leader runs to — in fractions of the plane's box in the hero picture.
 */
const NOTES: Record<NoteId, { at: Point; to: Point; runs: 'left' | 'right' }> = {
  home: { at: [1.16, 0.84], to: [0.93, 0.68], runs: 'right' }, // to the wingtip light: under the title, over the rail
  network: { at: [0.04, 2.35], to: [0.3, 0.6], runs: 'left' }, // to the cabin windows
  fares: { at: [0.82, 2.8], to: [0.56, 0.84], runs: 'right' }, // to the belly
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
    <h1 className={styles.title} style={{ '--scatter': scatter } as CSSProperties}>
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

const LOWEST_FARE = Math.min(...DESTINATIONS.map((d) => d.fareUsd));

/**
 * The showcase: a huge "Night flight" behind the live plane (its layer sits under the canvas, which is see-through
 * in the showcase), three facts about AslanAir pointing at the plane, a short lead and the scroll hint. Its entrance
 * waits for the loader to hand over. On the first scroll the facts give way and, as the plane climbs away, the title
 * flies apart letter by letter; scrolling back gathers it again.
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
            <Note id="home" label={t.notes.home.label} value={t.notes.home.value} />
            <Note id="network" label={t.notes.network.label} value={t.notes.network.value(DESTINATIONS.length)} />
            <Note id="fares" label={t.notes.fares.label} value={t.notes.fares.value(LOWEST_FARE)} />
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
