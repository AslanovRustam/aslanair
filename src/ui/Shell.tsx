'use client';

import { useEffect, useState } from 'react';
import { copy } from '@/content/copy';
import { chapterAt } from '@/experience/chapters';
import { curtainStore } from '@/experience/curtainStore';
import { navItems, railItems, transitionLabel, type NavTarget, type TransitionId } from '@/experience/navState';
import { experienceStore, trackOf, useExperience } from '@/experience/store';
import { worldMode } from '@/experience/worldState';
import { scrollToProgress } from '@/scroll/SmoothScroll';
import { AuthorCredit } from './AuthorCredit';
import SoundToggle from './SoundToggle';
import styles from './shell.module.css';
import { transitionTo } from './transition';

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
 * rail, the footer with the author and the night sky's credits, and a phone menu.
 */
export default function Shell() {
  const phase = useExperience((s) => s.phase);
  const chapter = useExperience((s) => chapterAt(trackOf(s.phase), s.progress).id);
  const night = useExperience((s) => worldMode(s.phase, s.progress) === 'night');
  const [menu, setMenu] = useState(false);
  const nav = navItems(phase, chapter);
  const rail = railItems(phase, chapter);
  const aisle = nav.find((i) => i.id === 'seat')!.target;

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  /**
   * A header or rail click, or the call to action. A jump to another chapter passes under the curtain (spec r4 §7) —
   * except take-off, which keeps its flight to the window, and the chapter the visitor is already in, which just
   * scrolls there. While a jump runs under the curtain the frame's links wait.
   */
  const go = (id: TransitionId | 'takeoff', target: NavTarget, active: boolean) => {
    if (curtainStore.getState().stage !== 'idle') return;
    if (!target) return;
    setMenu(false);
    if (target === 'stay') return;
    const jump = (immediate: boolean) => () => {
      const s = experienceStore.getState();
      if (s.phase === 'seated' && target.track === 'pre') s.standUp();
      // after the stand-up has re-rendered the track
      requestAnimationFrame(() => scrollToProgress(target.progress, immediate));
    };
    // in the aisle, Your seat and the call to action lead where the visitor already is
    const here = active || (phase === 'browse' && chapter === 'aisle' && target === aisle);
    if (id === 'takeoff' || here) jump(false)();
    else transitionTo(transitionLabel(id, phase), jump(true));
  };

  const links = (className: string) =>
    nav.map((item) => (
      <li key={item.id}>
        <button
          type="button"
          className={className}
          disabled={!item.enabled}
          aria-current={item.active ? 'location' : undefined}
          onClick={() => go(item.id, item.target, item.active)}
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
          <SoundToggle />
          {phase === 'browse' && (
            <button type="button" className={styles.cta} onClick={() => go('cta', aisle, false)}>
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
                onClick={() => go(item.id, item.target, item.active)}
              >
                <span className={styles.num}>{item.number}</span>
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <footer className={styles.footer}>
        <p className={styles.disclaimer}>
          <span className={styles.long}>{copy.footer.disclaimer}</span>
          <span className={styles.short}>{copy.footer.disclaimerShort}</span>
        </p>
        {night && (
          <p className={styles.skyCredit}>
            <a className={styles.authorLink} href={copy.footer.sky.href} target="_blank" rel="noopener noreferrer">
              {copy.footer.sky.line}
            </a>{' '}
            ·{' '}
            <a className={styles.authorLink} href={copy.footer.sky.licenceHref} target="_blank" rel="noopener noreferrer">
              {copy.footer.sky.licence}
            </a>{' '}
            · {copy.footer.sky.clouds}
          </p>
        )}
        <AuthorCredit className={styles.author} />
      </footer>

      {menu && (
        <div role="dialog" aria-modal="true" aria-label={copy.nav.menu} className={styles.sheet} data-lenis-prevent>
          <button type="button" className={styles.close} onClick={() => setMenu(false)}>
            {copy.nav.close}
          </button>
          <ul className={styles.sheetList}>{links(styles.sheetLink)}</ul>
          {phase === 'browse' && (
            <button type="button" className={styles.cta} onClick={() => go('cta', aisle, false)}>
              {copy.nav.cta}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
