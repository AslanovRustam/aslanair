'use client';

import { useEffect, useRef } from 'react';
import { copy } from '@/content/copy';
import styles from './shell.module.css';

const OPEN = 'aslanair:how-its-made';

/** Opens the panel from anywhere on the page (the outro's short block); focus returns to `from` when it closes. */
export function openHowItsMade(from: HTMLElement) {
  window.dispatchEvent(new CustomEvent<HTMLElement>(OPEN, { detail: from }));
}

/** For the Shell, which owns the panel: calls `handler` whenever something asks for it; returns the unsubscribe. */
export function onOpenHowItsMade(handler: (from: HTMLElement) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<HTMLElement>).detail);
  window.addEventListener(OPEN, listener);
  return () => window.removeEventListener(OPEN, listener);
}

/** The full "How it's made" story as a panel over the scene, reachable from anywhere; Escape or Close dismisses it. */
export default function HowItsMade({ open, onClose }: { open: boolean; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const t = copy.outro.howItsMade;
  return (
    <div className={styles.scrim} onClick={onClose}>
      {/* data-lenis-prevent: the wheel scrolls the panel, not the journey behind it */}
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-its-made"
        className={styles.drawer}
        onClick={(e) => e.stopPropagation()}
        data-lenis-prevent
      >
        <div className={styles.drawerHead}>
          <h2 id="how-its-made" className={styles.drawerTitle}>
            {t.title}
          </h2>
          <button ref={close} type="button" className={styles.close} onClick={onClose}>
            {copy.nav.close}
          </button>
        </div>
        <ul className={styles.drawerList}>
          {t.items.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className={styles.drawerAuthor}>{t.author}</p>
      </section>
    </div>
  );
}
