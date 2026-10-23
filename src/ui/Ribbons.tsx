'use client';

import type { CSSProperties } from 'react';
import { copy } from '@/content/copy';
import { trackProgress, type ChapterId } from '@/experience/chapters';
import { useExperience } from '@/experience/store';
import styles from './ribbons.module.css';

/** The chapters whose start is a seam the ribbons sweep across. */
const SEAMS: ChapterId[] = ['destinations', 'transfer', 'ready'];
/** How far either side of a seam (pre-track progress) the ribbons are on their way across. */
const WINDOW = 0.04;

/** −1 … 1 through the nearest seam's window (0 at the seam), or null away from every seam. */
function sweep(progress: number): number | null {
  for (const id of SEAMS) {
    const d = (progress - trackProgress('pre', id, 0)) / WINDOW;
    if (Math.abs(d) < 1) return d;
  }
  return null;
}

/**
 * Two ribbons crossing at ±4° — terracotta and navy, each a running line of the flight's phrases — that sweep over
 * the screen at the seams of the journey: in from above and below as a seam nears, crossing at it, out as it passes
 * (the scroll moves them; the phrases run on the compositor). Decoration only.
 */
export default function Ribbons() {
  const d = useExperience((s) => {
    if (s.phase !== 'browse') return null;
    const at = sweep(s.progress);
    return at === null ? null : Math.round(at * 1000) / 1000;
  });
  const code = useExperience((s) => s.destinationId);
  const phrases = [copy.ribbons.route(code), ...copy.ribbons.phrases];
  const shown = d !== null;

  return (
    <div className={styles.ribbons} aria-hidden="true">
      {[1, -1].map((side) => (
        <div key={side} className={styles.lane} style={{ '--slide': side * (d ?? 1) } as CSSProperties}>
          <div className={styles.ribbon} data-testid="ribbon" data-side={side} data-shown={shown}>
            <div className={styles.track}>
              {[0, 1].map((copyIndex) => (
                <span key={copyIndex} className={styles.phrases}>
                  {[...phrases, ...phrases].map((phrase, i) => (
                    <span key={i} className={styles.phrase}>
                      {phrase}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
