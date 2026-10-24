'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { copy } from '@/content/copy';
import { destination, transferHeadline, transferTimeline, TRANSFERS, type TransferId } from '@/experience/destinations';
import { experienceStore, useExperience } from '@/experience/store';
import RevealText, { stagger, useShown } from './RevealText';
import styles from './transfer.module.css';

/** The choices show over this stretch of the chapter: once the plane has flown in and the camera has settled. */
const SHOWN = { from: 0.55, to: 0.97 };

/** Line icons drawn for this site on a 24 × 24 grid; every stroke measures 1 (`pathLength`) so it can draw itself in. */
const ICONS: Record<TransferId, ReactNode> = {
  home: (
    <>
      <path pathLength={1} d="M4 11.5 12 5l8 6.5V20H4z" />
      <path pathLength={1} d="M10 20v-5h4v5" />
    </>
  ),
  hotel: (
    <>
      <rect pathLength={1} x="5" y="3.5" width="14" height="16.5" rx="1" />
      <path pathLength={1} d="M9 8h2M13 8h2M9 12h2M13 12h2M10.5 20v-3.5h3V20" />
    </>
  ),
  express: (
    <>
      <rect pathLength={1} x="6" y="3.5" width="12" height="13" rx="3" />
      <path pathLength={1} d="M6 10.5h12M9 20l1.5-3.5M15 20l-1.5-3.5" />
      <circle pathLength={1} cx="9.5" cy="13.5" r="0.6" />
      <circle pathLength={1} cx="14.5" cy="13.5" r="0.6" />
    </>
  ),
  own: (
    <>
      <rect pathLength={1} x="4.5" y="8" width="15" height="11.5" rx="2" />
      <path pathLength={1} d="M9 8V5.5h6V8M4.5 13h15" />
    </>
  ),
};

const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

/**
 * How will you get to the airport (spec r4 §6): four cards in a row, as in speca's values — the chosen one open, the
 * others narrow strips with their number and their name on its side. A pointer opens the card it rests on; leaving,
 * the chosen one opens again. An open card shows the big time (pick-up, or check-in closing), the evening's timeline
 * and the price. Under the chosen card a terracotta plate shows "Selected"; under an open card not chosen yet,
 * "Choose" (after dapper-profiterole's reviews). A radio group: arrow keys move and choose, Space and Enter choose.
 * The plane waits beside them. On a narrow screen the cards stack, the open one taller.
 */
export default function Transfer() {
  const shown = useShown('transfer', SHOWN);
  const chosen = useExperience((s) => s.transferId);
  const departs = useExperience((s) => destination(s.destinationId)?.departs ?? '00:00');
  const [hovered, setHovered] = useState<TransferId | null>(null);
  const [focused, setFocused] = useState<TransferId | null>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const t = copy.transfer;
  const open = hovered ?? focused ?? chosen;

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
    <section className={`${styles.transfer} chapter-ui`} data-shown={shown} aria-hidden={!shown}>
      <div className={styles.side}>
        <RevealText as="h2" id="transfer-title" className={styles.title} data-heading="transfer" text={t.title} />
        <RevealText as="p" className={styles.lead} text={t.lead} base={220} />
        <div className={styles.options} role="radiogroup" aria-labelledby="transfer-title" onPointerLeave={() => setHovered(null)}>
          {TRANSFERS.map((o, i) => {
            const isChosen = o.id === chosen;
            const isOpen = o.id === open;
            const name = t.options[o.id];
            const headline = transferHeadline(departs, o.id);
            const timeline = transferTimeline(departs, o.id);
            const price = t.price(o.priceUsd);
            const card = stagger(i);
            return (
              <div key={o.id} className={`${styles.slot} ${card.className}`} style={card.style} data-stagger data-open={isOpen} data-chosen={isChosen}>
                <span className={styles.plate} aria-hidden="true">
                  {isChosen ? t.selected : t.choose}
                </span>
                <button
                  ref={(el) => {
                    options.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={isChosen}
                  aria-label={`${name}, ${t.timeline[timeline[0].kind === 'own' ? 'checkin' : 'pickup']} ${headline}, ${price}`}
                  tabIndex={isChosen ? 0 : -1}
                  className={styles.option}
                  onClick={() => choose(i, false)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  onPointerEnter={() => canHover() && setHovered(o.id)}
                  onFocus={() => setFocused(o.id)}
                  onBlur={() => setFocused(null)}
                >
                  <span className={styles.strip}>
                    <span className={styles.num}>{String(i + 1).padStart(2, '0')}</span>
                    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
                      {ICONS[o.id]}
                    </svg>
                    <span className={styles.stripName} data-part="strip-name">
                      {name}
                    </span>
                    <span className={styles.stripPrice}>{price}</span>
                  </span>
                  <span className={styles.body}>
                    <svg className={styles.art} viewBox="0 0 24 24" aria-hidden="true">
                      {ICONS[o.id]}
                    </svg>
                    <span className={styles.price}>{price}</span>
                    <span className={styles.name}>{name}</span>
                    <span className={styles.line}>{t.lines[o.id]}</span>
                    <span className={styles.big}>
                      <span className={styles.bigLabel}>{t.timeline[timeline[0].kind === 'own' ? 'checkin' : 'pickup']}</span>
                      {headline}
                    </span>
                    <span className={styles.timeline}>
                      {timeline.map((step) => (
                        <span key={step.kind} className={styles.step} data-kind={step.kind}>
                          <span className={styles.stepLabel}>{t.timeline[step.kind]}</span>
                          <span className={styles.stepTime}>{step.time ?? '—'}</span>
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
