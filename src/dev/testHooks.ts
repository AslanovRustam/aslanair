import type { Camera, Object3D, WebGLRenderer } from 'three';
import { trackProgress, type ChapterId } from '@/experience/chapters';
import { experienceStore } from '@/experience/store';

declare global {
  interface Window {
    __aslan?: { store: typeof experienceStore; scene?: Object3D; gl?: WebGLRenderer; camera?: Camera };
    /** Pre-track progress of chapter `id` at local `t`, for tests that set the scroll inside the page. */
    __pre?: (id: ChapterId, t: number) => number;
  }
}

/** Exposes the store (and, once the canvas exists, the scene) to Playwright in non-production builds. */
export function installTestHooks(extra: { scene?: Object3D; gl?: WebGLRenderer; camera?: Camera } = {}): void {
  if (process.env.NODE_ENV === 'production') return;
  window.__aslan = { ...window.__aslan, store: experienceStore, ...extra };
  window.__pre = (id, t) => trackProgress('pre', id, t);
}
