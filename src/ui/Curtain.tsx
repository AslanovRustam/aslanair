'use client';

import type { CSSProperties } from 'react';
import { useCurtain } from '@/experience/curtainStore';
import styles from './curtain.module.css';

/**
 * The curtain's words (the curtain itself is drawn in WebGL, CurtainPass): the chapter it goes to — the rail's number
 * and name — and a thin bar that fills as the chapter gets ready. Shown while the screen is covered; decoration only.
 */
export default function Curtain() {
  const to = useCurtain((s) => s.to);
  const stage = useCurtain((s) => s.stage);
  const bar = useCurtain((s) => s.frame?.bar ?? 0);
  if (!to || stage === 'idle') return null;

  return (
    <div className={styles.curtain} data-stage={stage} aria-hidden="true" style={{ '--bar': bar } as CSSProperties}>
      <p className={styles.label} data-testid="curtain-label">
        <span className={styles.num}>{to.number}</span> {to.name}
      </p>
      <span className={styles.bar}>
        <i />
      </span>
    </div>
  );
}
