import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { aisleProgressForRow } from './cameraPoses';
import type { Track } from './chapters';
import { generateSeatMap, pickRecommendedSeat, type Seat } from './seats';

export type Phase = 'browse' | 'seated' | 'confirmed' | 'thanks';

export interface ExperienceState {
  phase: Phase;
  seats: Seat[];
  hoveredSeatId: string | null;
  selectedSeatId: string | null;
  /** 0..1 along the current scroll track. */
  progress: number;
  soundOn: boolean;
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
  const selectedRow = () => get().seats.find((s) => s.id === get().selectedSeatId)?.row ?? 1;
  const backToAisle = () =>
    set({ phase: 'browse', selectedSeatId: null, hoveredSeatId: null, progress: aisleProgressForRow(selectedRow()) });

  return {
    phase: 'browse',
    seats: generateSeatMap(),
    hoveredSeatId: null,
    selectedSeatId: null,
    progress: 0,
    soundOn: false,
    setProgress: (p) => set({ progress: Math.min(1, Math.max(0, p)) }),
    hover: (id) => {
      if (get().phase === 'browse') set({ hoveredSeatId: id });
    },
    sit: (id) => {
      const seat = get().seats.find((s) => s.id === id);
      if (get().phase !== 'browse' || !seat || seat.status !== 'free') return false;
      set({ phase: 'seated', selectedSeatId: id, hoveredSeatId: null });
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
    restart: () => set({ phase: 'browse', progress: 0, selectedSeatId: null, hoveredSeatId: null }),
  };
});

export function useExperience<T>(selector: (s: ExperienceState) => T): T {
  return useStore(experienceStore, selector);
}
