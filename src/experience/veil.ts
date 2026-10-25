import { createStore } from 'zustand/vanilla';

/** The reduced-motion veil (spec §4.8): the scene goes dark for `seconds`, the camera cuts to its next key pose under
 * it (reducedMotion.ts), and it clears again over as long. */
export const VEIL = { seconds: 0.25 };

export const veilStore = createStore<{ covered: boolean }>(() => ({ covered: false }));
