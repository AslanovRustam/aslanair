'use client';

import { copy } from '@/content/copy';
import { chapterAt } from '@/experience/chapters';
import { DESTINATIONS, destination } from '@/experience/destinations';
import { experienceStore, useExperience } from '@/experience/store';
import styles from './destinations.module.css';
import { globeLabels } from './globeLabels';

/** The chapter's words and controls show over this stretch of it: once the plane has come over the horizon, until
 * it sets off over it again. */
const SHOWN = { from: 0.28, to: 0.6 };

const pick = (code: string) => experienceStore.getState().pickDestination(code, performance.now() / 1000);
const hover = (code: string | null) => experienceStore.getState().hoverDestination(code);

/**
 * Where to tonight: the departures board (every destination, keyboard and screen reader included), labels on the
 * globe's markers that face the camera (pointer only — the board is their accessible twin), and the chosen flight's
 * card. A pick flies the plane there (Globe, Aircraft).
 */
export default function Destinations() {
  const shown = useExperience((s) => {
    if (s.phase !== 'browse') return false;
    const { id, t } = chapterAt('pre', s.progress);
    return id === 'destinations' && t >= SHOWN.from && t <= SHOWN.to;
  });
  const chosenId = useExperience((s) => s.destinationId);
  const chosen = destination(chosenId)!;
  const t = copy.destinations;

  return (
    <section className={styles.destinations} data-shown={shown} aria-hidden={!shown} aria-labelledby="destinations-title">
      <div className={styles.side}>
        <h2 id="destinations-title" className={styles.title}>
          {t.title}
        </h2>
        <p className={styles.lead}>{t.lead}</p>
        <div className={styles.board} data-testid="departures" role="group" aria-label={t.board}>
          <p className={styles.boardHead} aria-hidden="true">
            <span>{t.columns.code}</span>
            <span>{t.columns.city}</span>
            <span>{t.columns.departs}</span>
            <span>{t.columns.fare}</span>
          </p>
          <ul className={styles.rows}>
            {DESTINATIONS.map((d) => (
              <li key={d.code}>
                <button
                  type="button"
                  className={styles.row}
                  data-code={d.code}
                  aria-pressed={d.code === chosenId}
                  onClick={() => pick(d.code)}
                  onPointerEnter={() => hover(d.code)}
                  onPointerLeave={() => hover(null)}
                  onFocus={() => hover(d.code)}
                  onBlur={() => hover(null)}
                >
                  <span className={styles.code}>{d.code}</span>
                  <span className={styles.city}>{d.city}</span>
                  <span className={styles.time}>{d.departs}</span>
                  <span className={styles.fare}>${d.fareUsd}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.labels} aria-hidden="true">
        {DESTINATIONS.map((d, i) => (
          <button
            key={d.code}
            type="button"
            tabIndex={-1}
            className={styles.label}
            data-testid="globe-label"
            data-code={d.code}
            data-marker={i + 1}
            data-facing="false"
            data-side="right"
            data-chosen={d.code === chosenId}
            ref={(el) => {
              if (el) globeLabels.set(d.code, el);
              else globeLabels.delete(d.code);
            }}
            onClick={() => pick(d.code)}
            onPointerEnter={() => hover(d.code)}
            onPointerLeave={() => hover(null)}
          >
            <span className={styles.labelText}>
              {d.code}
              <span className={styles.labelFare}>{t.from(d.fareUsd)}</span>
            </span>
          </button>
        ))}
      </div>

      <aside className={styles.card} data-testid="flight-card" aria-live="polite">
        <p className={styles.cardLabel}>{t.card}</p>
        {/* the flight number never breaks across lines */}
        <p className={styles.cardRoute}>{`${chosen.city} · ${chosen.code} · ${chosen.flight.replace(' ', ' ')}`}</p>
        <p className={styles.cardMeta}>{t.departs(chosen.departs)}</p>
        <p className={styles.cardFare}>
          {t.from(chosen.fareUsd)} <span>{t.oneWay}</span>
        </p>
      </aside>
    </section>
  );
}
