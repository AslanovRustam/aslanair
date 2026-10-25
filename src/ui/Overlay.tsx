'use client';

import { copy } from '@/content/copy';
import { WINDOW_ON_EXIT } from '@/experience/cameraPoses';
import { transitionLabel } from '@/experience/navState';
import { chapterAt } from '@/experience/chapters';
import { seatLabel } from '@/experience/seats';
import { trackOf, useExperience } from '@/experience/store';
import { usePointerKind } from '@/scene/cabin/pointerKind';
import { scrollToProgress } from '@/scroll/SmoothScroll';
import RevealText from './RevealText';
import ScrollCue from './ScrollCue';
import { transitionTo } from './transition';
import styles from './ui.module.css';

/** How close to the window stop (post-track progress) the take-off call shows. */
const AT_WINDOW = 0.06;

export default function Overlay() {
  const phase = useExperience((s) => s.phase);
  const chapter = useExperience((s) => chapterAt(trackOf(s.phase), s.progress).id);
  const selected = useExperience((s) => s.seats.find((x) => x.id === s.selectedSeatId));
  const { autoPick, confirm, standUp, changeSeat } = useExperience((s) => s);
  // on a phone the aisle speaks of taps
  const pointer = usePointerKind();

  const browsing = phase === 'browse';
  // the sky chapter belongs to the hero
  const caption = browsing && (chapter === 'door' || chapter === 'aisle') ? copy.chapters[chapter] : null;
  const onPass = phase === 'confirmed' && chapter === 'pass';
  const atWindow = useExperience((s) => s.phase === 'confirmed' && Math.abs(s.progress - WINDOW_ON_EXIT) < AT_WINDOW);

  return (
    <div className={`${styles.overlay} chapter-ui`}>
      {caption && (
        <div className={styles.caption} key={chapter} data-reveal="on">
          <RevealText as="h1" data-heading={chapter} text={caption.title} />
          <RevealText as="p" text={pointer === 'touch' && 'bodyTouch' in caption ? caption.bodyTouch : caption.body} base={250} />
        </div>
      )}
      {onPass && (
        <div className={styles.caption} key="pass" data-reveal="on">
          <RevealText as="h1" data-heading="pass" text={copy.pass.title} />
          <RevealText as="p" text={copy.pass.flipHint} base={250} />
        </div>
      )}
      {browsing && chapter === 'aisle' && (
        <div className={styles.bar}>
          <span>{copy.aisle.hint}</span>
          <button type="button" className={styles.button} onClick={autoPick}>
            {copy.aisle.pickForMe}
          </button>
        </div>
      )}
      {phase === 'seated' && selected && (
        <div className={`${styles.bar} ${styles.barSeated}`}>
          <span className={styles.barSeat}>{seatLabel(selected)}</span>
          <button type="button" className={styles.ghost} onClick={standUp}>
            {copy.seated.another}
          </button>
          <button type="button" className={styles.button} onClick={confirm}>
            {copy.seated.choose}
          </button>
        </div>
      )}
      {onPass && (
        <div className={`${styles.bar} ${styles.barButtons}`}>
          <button type="button" className={styles.ghost} onClick={() => transitionTo(transitionLabel('change', phase), changeSeat)}>
            {copy.pass.change}
          </button>
          <button type="button" className={styles.button} onClick={() => scrollToProgress(WINDOW_ON_EXIT, false)}>
            {copy.pass.takeOff}
          </button>
        </div>
      )}
      {atWindow && (
        <>
          <div className={styles.caption} key="take-off" data-reveal="on">
            <RevealText as="h1" text={copy.takeOff.title} />
          </div>
          <ScrollCue label={copy.takeOff.cue} />
        </>
      )}
    </div>
  );
}
