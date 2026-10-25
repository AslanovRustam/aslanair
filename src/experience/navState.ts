import { copy } from '@/content/copy';
import { trackProgress, type ChapterId, type Track } from './chapters';
import type { Phase } from './store';

/** A place on a track, `stay` (the current place: nothing to do) or out of reach. */
export type NavTarget = { track: Track; progress: number } | 'stay' | null;

export interface NavItem<Id extends string = string> {
  id: Id;
  label: string;
  enabled: boolean;
  active: boolean;
  target: NavTarget;
}

export type HeaderId = 'flight' | 'destinations' | 'transfer' | 'cabin' | 'seat' | 'pass';
export type RailId = 'flight' | 'destinations' | 'transfer' | 'boarding' | 'cabin' | 'seat' | 'takeoff';

const AISLE = { track: 'pre' as const, progress: trackProgress('pre', 'aisle', 0) };
const PASS = { track: 'post' as const, progress: 0 };
/** Where the journey's links land: past each chapter's entrance, where its words and choices show. */
const DESTINATIONS = { track: 'pre' as const, progress: trackProgress('pre', 'destinations', 0.4) };
const TRANSFER = { track: 'pre' as const, progress: trackProgress('pre', 'transfer', 0.7) };
const BOARDING = { track: 'pre' as const, progress: trackProgress('pre', 'ready', 0.2) };

/** Once a seat is confirmed the flight is behind the visitor: only Change seat goes back into the cabin. */
const confirmed = (phase: Phase) => phase === 'confirmed' || phase === 'thanks';

function item<Id extends string>(id: Id, label: string, target: NavTarget, active = false): NavItem<Id> {
  return { id, label, enabled: target !== null, active, target };
}

/**
 * The header's chapter links under the seat gate (spec r2 §4, r3 §8). Before confirmation Flight, Destinations,
 * Transfer and Cabin go to their chapters, Your seat goes to the aisle (or, while seated, keeps the visitor in the
 * seat) and Boarding pass is out of reach; after it the journey and the cabin are out of reach — the choices are
 * fixed — and Your seat and Boarding pass go to the pass.
 */
export function navItems(phase: Phase, chapter: ChapterId): NavItem<HeaderId>[] {
  const t = copy.nav;
  if (confirmed(phase)) {
    return [
      item('flight', t.flight, null),
      item('destinations', t.destinations, null),
      item('transfer', t.transfer, null),
      item('cabin', t.cabin, null),
      item('seat', t.seat, PASS),
      item('pass', t.pass, PASS, chapter === 'pass'),
    ];
  }
  const browsing = phase === 'browse';
  return [
    item('flight', t.flight, { track: 'pre', progress: 0 }, browsing && chapter === 'sky'),
    item('destinations', t.destinations, DESTINATIONS, browsing && chapter === 'destinations'),
    item('transfer', t.transfer, TRANSFER, browsing && chapter === 'transfer'),
    item('cabin', t.cabin, AISLE, browsing && (chapter === 'door' || chapter === 'aisle')),
    phase === 'seated' ? item('seat', t.seat, 'stay', true) : item('seat', t.seat, AISLE),
    item('pass', t.pass, null),
  ];
}

/** The chapter rail: the journey's seven stages, numbered because they are a sequence, under the same gate. */
export function railItems(phase: Phase, chapter: ChapterId): (NavItem<RailId> & { number: string })[] {
  const t = copy.rail;
  const browsing = phase === 'browse';
  const items: NavItem<RailId>[] = confirmed(phase)
    ? [
        item('flight', t.flight, null),
        item('destinations', t.destinations, null),
        item('transfer', t.transfer, null),
        item('boarding', t.boarding, null),
        item('cabin', t.cabin, null),
        item('seat', t.seat, PASS, chapter === 'pass'),
        item('takeoff', t.takeoff, { track: 'post', progress: trackProgress('post', 'exit', 0) }, chapter === 'exit' || chapter === 'outro'),
      ]
    : [
        item('flight', t.flight, { track: 'pre', progress: 0 }, browsing && chapter === 'sky'),
        item('destinations', t.destinations, DESTINATIONS, browsing && chapter === 'destinations'),
        item('transfer', t.transfer, TRANSFER, browsing && chapter === 'transfer'),
        item('boarding', t.boarding, BOARDING, browsing && (chapter === 'ready' || chapter === 'door')),
        item('cabin', t.cabin, AISLE, browsing && chapter === 'aisle'),
        phase === 'seated' ? item('seat', t.seat, 'stay', true) : item('seat', t.seat, AISLE),
        item('takeoff', t.takeoff, null),
      ];
  return items.map((it, i) => ({ ...it, number: String(i + 1).padStart(2, '0') }));
}

/** What a chapter jump says on the curtain — the rail's number and name — and the heading it focuses after. */
export type TransitionLabel = { number: string; name: string; heading: ChapterId };

/** A click that jumps somewhere: a header or rail item (not take-off), the call to action, Start again or Change
 * seat. */
export type TransitionId = Exclude<HeaderId | RailId, 'takeoff'> | 'cta' | 'restart' | 'change';

/** The curtain's label for a jump (spec r4 §7), in the rail's words. */
export function transitionLabel(id: TransitionId, phase: Phase): TransitionLabel {
  const t = copy.rail;
  switch (id) {
    case 'flight':
    case 'restart':
      return { number: '01', name: t.flight, heading: 'sky' };
    case 'destinations':
      return { number: '02', name: t.destinations, heading: 'destinations' };
    case 'transfer':
      return { number: '03', name: t.transfer, heading: 'transfer' };
    case 'boarding':
      return { number: '04', name: t.boarding, heading: 'ready' };
    case 'cabin':
    case 'cta':
    case 'change':
      return { number: '05', name: t.cabin, heading: 'aisle' };
    case 'seat':
    case 'pass':
      return { number: '06', name: t.seat, heading: confirmed(phase) ? 'pass' : 'aisle' };
  }
}
