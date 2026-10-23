'use client';

import { copy } from '@/content/copy';
import { chapterAt } from '@/experience/chapters';
import { seatLabel } from '@/experience/seats';
import { trackOf, useExperience } from '@/experience/store';
import styles from './ui.module.css';

export default function Overlay() {
  const phase = useExperience((s) => s.phase);
  const chapter = useExperience((s) => chapterAt(trackOf(s.phase), s.progress).id);
  const selected = useExperience((s) => s.seats.find((x) => x.id === s.selectedSeatId));
  const { autoPick, confirm, standUp, changeSeat } = useExperience((s) => s);

  const browsing = phase === 'browse';
  // the sky chapter belongs to the hero
  const caption = browsing && (chapter === 'door' || chapter === 'aisle') ? copy.chapters[chapter] : null;
  const onPass = phase === 'confirmed' && chapter === 'pass';

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
        <div className={styles.bar}>
          <span>{copy.pass.scrollHint}</span>
          <button type="button" className={styles.ghost} onClick={changeSeat}>
            {copy.pass.change}
          </button>
        </div>
      )}
    </div>
  );
}
