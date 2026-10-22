'use client';

import { useEffect, useState } from 'react';
import { copy } from '@/content/copy';
import { chapterAt } from '@/experience/chapters';
import { seatLabel } from '@/experience/seats';
import { trackOf, useExperience } from '@/experience/store';
import styles from './ui.module.css';

function usePointer() {
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: PointerEvent) => setPointer({ x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
  return pointer;
}

export default function Overlay() {
  const phase = useExperience((s) => s.phase);
  const chapter = useExperience((s) => chapterAt(trackOf(s.phase), s.progress).id);
  const hovered = useExperience((s) => s.seats.find((x) => x.id === s.hoveredSeatId));
  const selected = useExperience((s) => s.seats.find((x) => x.id === s.selectedSeatId));
  const { autoPick, confirm, standUp, changeSeat } = useExperience((s) => s);
  const pointer = usePointer();

  const browsing = phase === 'browse';
  const caption = browsing && (chapter === 'sky' || chapter === 'door' || chapter === 'aisle') ? copy.chapters[chapter] : null;
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
      {hovered && (
        <div className={styles.tooltip} style={{ left: pointer.x + 16, top: pointer.y + 16 }}>
          {seatLabel(hovered)}
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
          <span>{seatLabel(selected)}</span>
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
      <p className={styles.disclaimer}>{copy.footer.disclaimer}</p>
    </div>
  );
}
