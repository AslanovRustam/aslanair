import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { Track } from './chapters';
import { DEFAULT_TRANSFER, destination, SUGGESTED, TRANSFERS, type TransferId } from './destinations';
import { generateSeatMap, pickRecommendedSeat, type Seat } from './seats';

export type Phase = 'browse' | 'seated' | 'confirmed' | 'thanks';

export interface ExperienceState {
  phase: Phase;
  seats: Seat[];
  hoveredSeatId: string | null;
  selectedSeatId: string | null;
  /** 0..1 along the current scroll track. */
  progress: number;
  /** Aisle progress when the visitor sat down; standing up or changing seat returns here. */
  aisleReturn: number;
  soundOn: boolean;
  /** The chosen destination's code (Chișinău is always the origin). */
  destinationId: string;
  transferId: TransferId;
  /** Both choices stay open until the seat is confirmed; false (and no change) after that or for an unknown id. */
  chooseDestination(code: string): boolean;
  chooseTransfer(id: TransferId): boolean;
  /** 0..100: how much of the scene has loaded; it only moves forward. */
  loadProgress: number;
  /** The scene has loaded, compiled and rendered: the loader hands over to the hero. Never reverts. */
  ready: boolean;
  setLoad(progress: number, ready?: boolean): void;
  setProgress(p: number): void;
  hover(id: string | null): void;
  sit(id: string): boolean;
  standUp(): void;
  confirm(): void;
  changeSeat(): void;
  autoPick(): void;
  submitForm(): void;
  restart(): void;
}

export function trackOf(phase: Phase): Track {
  return phase === 'confirmed' || phase === 'thanks' ? 'post' : 'pre';
}

export const experienceStore = createStore<ExperienceState>()((set, get) => {
  const backToAisle = () => set({ phase: 'browse', selectedSeatId: null, hoveredSeatId: null, progress: get().aisleReturn });

  return {
    phase: 'browse',
    seats: generateSeatMap(),
    hoveredSeatId: null,
    selectedSeatId: null,
    progress: 0,
    aisleReturn: 0,
    soundOn: false,
    destinationId: SUGGESTED,
    transferId: DEFAULT_TRANSFER,
    chooseDestination: (code) => {
      if (trackOf(get().phase) === 'post' || !destination(code)) return false;
      set({ destinationId: code });
      return true;
    },
    chooseTransfer: (id) => {
      if (trackOf(get().phase) === 'post' || !TRANSFERS.some((t) => t.id === id)) return false;
      set({ transferId: id });
      return true;
    },
    loadProgress: 0,
    ready: false,
    setLoad: (progress, ready = false) =>
      set({ loadProgress: Math.min(100, Math.max(get().loadProgress, progress)), ready: get().ready || ready }),
    setProgress: (p) => set({ progress: Math.min(1, Math.max(0, p)) }),
    hover: (id) => {
      if (get().phase === 'browse') set({ hoveredSeatId: id });
    },
    sit: (id) => {
      const seat = get().seats.find((s) => s.id === id);
      if (get().phase !== 'browse' || !seat || seat.status !== 'free') return false;
      set({ phase: 'seated', selectedSeatId: id, hoveredSeatId: null, aisleReturn: get().progress });
      return true;
    },
    standUp: () => {
      if (get().phase === 'seated') backToAisle();
    },
    confirm: () => {
      if (get().phase === 'seated') set({ phase: 'confirmed', progress: 0 });
    },
    changeSeat: () => {
      if (get().phase === 'confirmed') backToAisle();
    },
    autoPick: () => {
      if (get().phase === 'browse') get().sit(pickRecommendedSeat(get().seats).id);
    },
    submitForm: () => {
      if (get().phase === 'confirmed') set({ phase: 'thanks' });
    },
    restart: () =>
      set({
        phase: 'browse',
        progress: 0,
        aisleReturn: 0,
        selectedSeatId: null,
        hoveredSeatId: null,
        destinationId: SUGGESTED,
        transferId: DEFAULT_TRANSFER,
      }),
  };
});

export function useExperience<T>(selector: (s: ExperienceState) => T): T {
  return useStore(experienceStore, selector);
}
