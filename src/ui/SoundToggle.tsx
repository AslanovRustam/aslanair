'use client';

import { copy } from '@/content/copy';
import { experienceStore, useExperience } from '@/experience/store';
import styles from './shell.module.css';

/** Two bars and a wave while on; the bars alone while off. */
function Speaker({ on }: { on: boolean }) {
  return (
    <svg className={styles.soundIcon} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 8h3l4-3.5v11L6 12H3z" fill="currentColor" />
      {on ? (
        <path d="M13 7.2a4 4 0 0 1 0 5.6M15.2 5a7 7 0 0 1 0 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      ) : (
        <path d="M13.5 8l4 4m0-4l-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      )}
    </svg>
  );
}

/** The sound switch in the header's right group, on every screen (phones too, outside the menu): it says what is on. */
export default function SoundToggle() {
  const on = useExperience((s) => s.soundOn);
  return (
    <button type="button" className={styles.sound} aria-pressed={on} onClick={() => experienceStore.getState().setSoundOn(!on)}>
      <Speaker on={on} />
      <span>{on ? copy.sound.on : copy.sound.off}</span>
    </button>
  );
}
