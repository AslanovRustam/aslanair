'use client';

import { copy } from '@/content/copy';
import { WINDOW_ON_EXIT } from '@/experience/cameraPoses';
import { chapterAt } from '@/experience/chapters';
import { seatLabel } from '@/experience/seats';
import { trackOf, useExperience } from '@/experience/store';
import { scrollToProgress } from '@/scroll/SmoothScroll';
import cue from './cue.module.css';
import styles from './ui.module.css';

/** How close to the window stop (post-track progress) the take-off call shows. */
const AT_WINDOW = 0.06;

export default function Overlay() {
  const phase = useExperience((s) => s.phase);
  const chapter = useExperience((s) => chapterAt(trackOf(s.phase), s.progress).id);
  const selected = useExperience((s) => s.seats.find((x) => x.id === s.selectedSeatId));
  const { autoPick, confirm, standUp, changeSeat } = useExperience((s) => s);

  const browsing = phase === 'browse';
  // the sky chapter belongs to the hero
  const caption = browsing && (chapter === 'door' || chapter === 'aisle') ? copy.chapters[chapter] : null;
  const onPass = phase === 'confirmed' && chapter === 'pass';
  const atWindow = useExperience((s) => s.phase === 'confirmed' && Math.abs(s.progress - WINDOW_ON_EXIT) < AT_WINDOW);

  return (
    <div className={styles.overlay}>
      {caption && (
        <div className={styles.caption} key={chapter}>
          <h1>{caption.title}</h1>
          <p>{caption.body}</p>
        </div>
      )}
      {onPass && (
        <div className={styles.caption} key="pass">
          <h1>{copy.pass.title}</h1>
          <p>{copy.pass.flipHint}</p>
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
        <div className={styles.bar}>
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
          <button type="button" className={styles.ghost} onClick={changeSeat}>
            {copy.pass.change}
          </button>
          <button type="button" className={styles.button} onClick={() => scrollToProgress(WINDOW_ON_EXIT, false)}>
            {copy.pass.takeOff}
          </button>
        </div>
      )}
      {atWindow && (
        <>
          <div className={styles.caption} key="take-off">
            <h1>{copy.takeOff.title}</h1>
          </div>
          <p className={cue.cue}>{copy.takeOff.cue}</p>
        </>
      )}
    </div>
  );
}
