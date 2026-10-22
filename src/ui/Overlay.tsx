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
  const autoPick = useExperience((s) => s.autoPick);
  const pointer = usePointer();

  const browsing = phase === 'browse';
  const caption = browsing && (chapter === 'sky' || chapter === 'door' || chapter === 'aisle') ? copy.chapters[chapter] : null;

  return (
    <div className={styles.overlay}>
      {caption && (
        <div className={styles.caption} key={chapter}>
          <h1>{caption.title}</h1>
          <p>{caption.body}</p>
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
    </div>
  );
}
