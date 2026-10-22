import { experienceStore } from '@/experience/store';

declare global {
  interface Window {
    __aslan?: { store: typeof experienceStore };
  }
}

/** Exposes the store to Playwright in non-production builds. */
export function installTestHooks(): void {
  if (process.env.NODE_ENV === 'production') return;
  window.__aslan = { store: experienceStore };
}
