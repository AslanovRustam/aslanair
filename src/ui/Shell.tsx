'use client';

import { useCallback, useEffect, useState } from 'react';
import { copy } from '@/content/copy';
import { chapterAt } from '@/experience/chapters';
import { navItems, railItems, type NavTarget } from '@/experience/navState';
import { experienceStore, trackOf, useExperience } from '@/experience/store';
import { scrollToProgress } from '@/scroll/SmoothScroll';
import HowItsMade, { AuthorCredit, onOpenHowItsMade } from './HowItsMade';
import styles from './shell.module.css';

/** The fin's sun over the horizon: a disc cut by two bands. */
function Emblem() {
  return (
    <svg className={styles.emblem} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <mask id="emblem-bands">
          <rect width="24" height="24" fill="#fff" />
          <rect x="0" y="13.2" width="24" height="1.8" fill="#000" />
          <rect x="0" y="16.8" width="24" height="1.8" fill="#000" />
        </mask>
      </defs>
      <circle cx="12" cy="12" r="10" fill="var(--accent)" mask="url(#emblem-bands)" />
    </svg>
  );
}

/**
 * The site's frame over the scene: the header with the gated chapter links and the call to action, the chapter
 * rail, the footer, a phone menu and the How it's made panel.
 */
export default function Shell() {
  const phase = useExperience((s) => s.phase);
  const chapter = useExperience((s) => chapterAt(trackOf(s.phase), s.progress).id);
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const [menu, setMenu] = useState(false);
  const nav = navItems(phase, chapter);
  const rail = railItems(phase, chapter);
  const aisle = nav.find((i) => i.id === 'seat')!.target;

  const closePanel = useCallback(() => {
    setOpener(null);
    requestAnimationFrame(() => opener?.focus()); // back to the button that opened it
  }, [opener]);

  useEffect(() => onOpenHowItsMade(setOpener), []);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  const go = (target: NavTarget, from: HTMLElement) => {
    if (target === 'panel') {
      setMenu(false);
      setOpener(from);
      return;
    }
    if (!target) return;
    setMenu(false);
    if (target === 'stay') return;
    const s = experienceStore.getState();
    if (s.phase === 'seated' && target.track === 'pre') s.standUp();
    // after the stand-up has re-rendered the track
    requestAnimationFrame(() => scrollToProgress(target.progress, false));
  };

  const links = (className: string) =>
    nav.map((item) => (
      <li key={item.id}>
        <button
          type="button"
          className={className}
          disabled={!item.enabled}
          aria-current={item.active ? 'location' : undefined}
          onClick={(e) => go(item.target, e.currentTarget)}
        >
          {item.label}
        </button>
      </li>
    ));

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>
          <Emblem />
          {copy.brand}
        </span>
        <nav aria-label={copy.nav.label} className={styles.nav}>
          <ul>{links(styles.link)}</ul>
        </nav>
        <div className={styles.actions}>
          {/* the sound toggle lands here (Plan 5) */}
          <span className={styles.slot} data-slot="sound" />
          {phase === 'browse' && (
            <button type="button" className={styles.cta} onClick={(e) => go(aisle, e.currentTarget)}>
              {copy.nav.cta}
            </button>
          )}
          <button type="button" className={styles.menuButton} aria-haspopup="dialog" onClick={() => setMenu(true)}>
            {copy.nav.menu}
          </button>
        </div>
      </header>

      <nav aria-label={copy.rail.label} className={styles.rail}>
        <ol>
          {rail.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={styles.railItem}
                disabled={!item.enabled}
                aria-current={item.active ? 'step' : undefined}
                onClick={(e) => go(item.target, e.currentTarget)}
              >
                <span className={styles.num}>{item.number}</span>
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <footer className={styles.footer}>
        <p>{copy.footer.disclaimer}</p>
        <AuthorCredit className={styles.author} />
      </footer>

      {menu && (
        <div role="dialog" aria-modal="true" aria-label={copy.nav.menu} className={styles.sheet} data-lenis-prevent>
          <button type="button" className={styles.close} onClick={() => setMenu(false)}>
            {copy.nav.close}
          </button>
          <ul className={styles.sheetList}>{links(styles.sheetLink)}</ul>
          {phase === 'browse' && (
            <button type="button" className={styles.cta} onClick={(e) => go(aisle, e.currentTarget)}>
              {copy.nav.cta}
            </button>
          )}
        </div>
      )}

      <HowItsMade open={!!opener} onClose={closePanel} />
    </div>
  );
}
