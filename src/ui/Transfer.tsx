'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { copy } from '@/content/copy';
import { destination, pickupTime, TRANSFERS, type TransferId } from '@/experience/destinations';
import { experienceStore, useExperience } from '@/experience/store';
import RevealText, { useShown } from './RevealText';
import styles from './transfer.module.css';

/** The choices show over this stretch of the chapter: once the plane has flown in and the camera has settled. */
const SHOWN = { from: 0.55, to: 0.97 };

/** Line icons drawn for this site on a 24 × 24 grid. */
const ICONS: Record<TransferId, ReactNode> = {
  home: (
    <>
      <path d="M4 11.5 12 5l8 6.5V20H4z" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  hotel: (
    <>
      <rect x="5" y="3.5" width="14" height="16.5" rx="1" />
      <path d="M9 8h2M13 8h2M9 12h2M13 12h2M10.5 20v-3.5h3V20" />
    </>
  ),
  express: (
    <>
      <rect x="6" y="3.5" width="12" height="13" rx="3" />
      <path d="M6 10.5h12M9 20l1.5-3.5M15 20l-1.5-3.5" />
      <circle cx="9.5" cy="13.5" r="0.6" />
      <circle cx="14.5" cy="13.5" r="0.6" />
    </>
  ),
  own: (
    <>
      <rect x="4.5" y="8" width="15" height="11.5" rx="2" />
      <path d="M9 8V5.5h6V8M4.5 13h15" />
    </>
  ),
};

/**
 * How will you get to the airport: four choices as a radio group (arrow keys move and choose, Space and Enter
 * choose), each with its pick-up time counted back from the chosen flight's departure. The plane waits beside them.
 */
export default function Transfer() {
  const shown = useShown('transfer', SHOWN);
  const chosen = useExperience((s) => s.transferId);
  const departs = useExperience((s) => destination(s.destinationId)?.departs ?? '00:00');
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const t = copy.transfer;

  const choose = (i: number, focus: boolean) => {
    experienceStore.getState().chooseTransfer(TRANSFERS[i].id);
    if (focus) options.current[i]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (step) {
      e.preventDefault();
      choose((i + step + TRANSFERS.length) % TRANSFERS.length, true);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      choose(i, false);
    }
  };

  return (
    <section className={styles.transfer} data-shown={shown} aria-hidden={!shown}>
      <div className={styles.side}>
        <RevealText as="h2" id="transfer-title" className={styles.title} data-heading="transfer" text={t.title} />
        <RevealText as="p" className={styles.lead} text={t.lead} base={220} />
        <div className={styles.options} role="radiogroup" aria-labelledby="transfer-title">
          {TRANSFERS.map((o, i) => (
            <button
              key={o.id}
              ref={(el) => {
                options.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={o.id === chosen}
              tabIndex={o.id === chosen ? 0 : -1}
              className={styles.option}
              onClick={() => choose(i, false)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                {ICONS[o.id]}
              </svg>
              <span className={styles.name}>{t.options[o.id]}</span>
              <span className={styles.line}>{t.lines[o.id]}</span>
              <span className={styles.time}>{o.minutesBefore === null ? t.noPickup : t.pickup(pickupTime(departs, o.minutesBefore))}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
