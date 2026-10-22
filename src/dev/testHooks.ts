import type { Object3D } from 'three';
import { experienceStore } from '@/experience/store';

declare global {
  interface Window {
    __aslan?: { store: typeof experienceStore; scene?: Object3D };
  }
}

/** Exposes the store (and, once the canvas exists, the scene) to Playwright in non-production builds. */
export function installTestHooks(extra: { scene?: Object3D } = {}): void {
  if (process.env.NODE_ENV === 'production') return;
  window.__aslan = { ...window.__aslan, store: experienceStore, ...extra };
}
