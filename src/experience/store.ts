import { Quaternion } from 'three';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { Track } from './chapters';
import { DEFAULT_TRANSFER, destination, SUGGESTED, TRANSFERS, type TransferId } from './destinations';
import { nextFlight, type ArcFlight } from './globe';
import type { Tier } from './quality';
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
  /** The visitor's sound choice: on unless they muted (kept in localStorage by SoundController). */
  soundOn: boolean;
  setSoundOn(on: boolean): void;
  /** How many times the pass has been turned over: the paper's rustle follows it (audio/mix.ts). */
  passFlips: number;
  flipPass(): void;
  /** How much the device draws (quality.ts); the QualityGovernor sets it from the device and may step it down once. */
  quality: Tier;
  setQuality(tier: Tier): void;
  /** The chosen destination's code (home, Odesa, is always the origin). */
  destinationId: string;
  transferId: TransferId;
  /** Whether the visitor has picked a transfer this visit: until then scrolling the chapter shows each in turn. */
  transferPicked: boolean;
  /** Both choices stay open until the seat is confirmed; false (and no change) after that or for an unknown id. */
  chooseDestination(code: string): boolean;
  chooseTransfer(id: TransferId): boolean;
  /** The plane's last flight over the globe (null: it waits over home). */
  flight: ArcFlight | null;
  /** Chooses `code` and flies the plane there from wherever it is at `now` (seconds); false if the choice is refused. */
  pickDestination(code: string, now: number): boolean;
  /** The visitor's own turn of the globe (dragging it), on top of the flight's; a pick folds it in. */
  globeSpin: Quaternion;
  spinGlobe(spin: Quaternion): void;
  /** The destination under the pointer or keyboard focus, for the globe to highlight. */
  hoveredDestinationId: string | null;
  hoverDestination(code: string | null): void;
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
    soundOn: true,
    setSoundOn: (soundOn) => set({ soundOn }),
    passFlips: 0,
    flipPass: () => set({ passFlips: get().passFlips + 1 }),
    quality: 'high',
    setQuality: (quality) => set({ quality }),
    destinationId: SUGGESTED,
    transferId: DEFAULT_TRANSFER,
    transferPicked: false,
    chooseDestination: (code) => {
      if (trackOf(get().phase) === 'post' || !destination(code)) return false;
      set({ destinationId: code });
      return true;
    },
    flight: null,
    pickDestination: (code, now) => {
      // the city already chosen and flown to: nothing to do (the first pick of tonight's city still flies there)
      if (code === get().destinationId && get().flight) return trackOf(get().phase) !== 'post';
      const chosen = destination(get().destinationId)!;
      const to = destination(code);
      if (!to || !get().chooseDestination(code)) return false;
      // the globe turns on from where the visitor left it
      set({ flight: nextFlight(get().flight, chosen, to, now, get().globeSpin), globeSpin: new Quaternion() });
      return true;
    },
    globeSpin: new Quaternion(),
    spinGlobe: (spin) => set({ globeSpin: spin }),
    hoveredDestinationId: null,
    hoverDestination: (code) => set({ hoveredDestinationId: code }),
    chooseTransfer: (id) => {
      if (trackOf(get().phase) === 'post' || !TRANSFERS.some((t) => t.id === id)) return false;
      set({ transferId: id, transferPicked: true });
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
        transferPicked: false,
        flight: null,
        hoveredDestinationId: null,
        globeSpin: new Quaternion(),
      }),
  };
});

export function useExperience<T>(selector: (s: ExperienceState) => T): T {
  return useStore(experienceStore, selector);
}
