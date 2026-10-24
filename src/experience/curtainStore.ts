import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { CurtainFrame, CurtainStage } from './curtain';
import type { TransitionLabel } from './navState';

export interface CurtainState {
  stage: CurtainStage;
  /** When the running transition began (s, performance clock). */
  startedAt: number;
  /** When the chapter underneath reported ready (s, same clock); null until then. */
  readyAt: number | null;
  /** Where the running transition goes; null when idle. */
  to: TransitionLabel | null;
  /** The curtain this frame, for the DOM label and the WebGL pass; null when idle. */
  frame: CurtainFrame | null;
  /** Starts a transition; false (and nothing changes) while one is running. */
  begin(to: TransitionLabel, now: number): boolean;
  markReady(now: number): void;
  setFrame(frame: CurtainFrame): void;
  finish(): void;
}

/** The chapter transition in flight (spec r4 §7): one at a time. */
export const curtainStore = createStore<CurtainState>()((set, get) => ({
  stage: 'idle',
  startedAt: 0,
  readyAt: null,
  to: null,
  frame: null,
  begin: (to, now) => {
    if (get().stage !== 'idle') return false;
    set({ stage: 'cover', startedAt: now, readyAt: null, to, frame: null });
    return true;
  },
  markReady: (now) => {
    if (get().readyAt === null) set({ readyAt: now });
  },
  setFrame: (frame) => set({ frame, stage: frame.stage }),
  finish: () => set({ stage: 'idle', readyAt: null, to: null, frame: null }),
}));

export function useCurtain<T>(selector: (s: CurtainState) => T): T {
  return useStore(curtainStore, selector);
}
