import { copy } from '@/content/copy';
import { trackProgress, type ChapterId, type Track } from './chapters';
import type { Phase } from './store';

export type NavTarget = { track: Track; progress: number } | 'panel' | null;

export interface NavItem<Id extends string = string> {
  id: Id;
  label: string;
  enabled: boolean;
  active: boolean;
  target: NavTarget;
}

export type HeaderId = 'flight' | 'cabin' | 'seat' | 'pass' | 'made';
export type RailId = 'flight' | 'boarding' | 'cabin' | 'seat' | 'takeoff';

const AISLE = { track: 'pre' as const, progress: trackProgress('pre', 'aisle', 0) };
const PASS = { track: 'post' as const, progress: 0 };

/** Once a seat is confirmed the flight is behind the visitor: only Change seat goes back into the cabin. */
const confirmed = (phase: Phase) => phase === 'confirmed' || phase === 'thanks';

function item<Id extends string>(id: Id, label: string, target: NavTarget, active = false): NavItem<Id> {
  return { id, label, enabled: target !== null, active, target };
}

/**
 * The header's chapter links under the seat gate (spec r2 §4). Before confirmation Flight and Cabin go to their
 * chapters, Your seat goes to the aisle and Boarding pass is out of reach; after it Flight and Cabin are out of
 * reach and Your seat and Boarding pass go to the pass. How it's made is a panel, always there.
 */
export function navItems(phase: Phase, chapter: ChapterId): NavItem<HeaderId>[] {
  const t = copy.nav;
  if (confirmed(phase)) {
    return [
      item('flight', t.flight, null),
      item('cabin', t.cabin, null),
      item('seat', t.seat, PASS),
      item('pass', t.pass, PASS, chapter === 'pass'),
      item('made', t.made, 'panel'),
    ];
  }
  const browsing = phase === 'browse';
  return [
    item('flight', t.flight, { track: 'pre', progress: 0 }, browsing && (chapter === 'sky' || chapter === 'door')),
    item('cabin', t.cabin, AISLE, browsing && chapter === 'aisle'),
    item('seat', t.seat, AISLE, phase === 'seated'),
    item('pass', t.pass, null),
    item('made', t.made, 'panel'),
  ];
}

/** The chapter rail: the journey's five stages, numbered because they are a sequence, under the same gate. */
export function railItems(phase: Phase, chapter: ChapterId): (NavItem<RailId> & { number: string })[] {
  const t = copy.rail;
  const browsing = phase === 'browse';
  const items: NavItem<RailId>[] = confirmed(phase)
    ? [
        item('flight', t.flight, null),
        item('boarding', t.boarding, null),
        item('cabin', t.cabin, null),
        item('seat', t.seat, PASS, chapter === 'pass'),
        item('takeoff', t.takeoff, { track: 'post', progress: trackProgress('post', 'exit', 0) }, chapter === 'exit' || chapter === 'outro'),
      ]
    : [
        item('flight', t.flight, { track: 'pre', progress: 0 }, browsing && chapter === 'sky'),
        item('boarding', t.boarding, { track: 'pre', progress: trackProgress('pre', 'door', 0) }, browsing && chapter === 'door'),
        item('cabin', t.cabin, AISLE, browsing && chapter === 'aisle'),
        item('seat', t.seat, AISLE, phase === 'seated'),
        item('takeoff', t.takeoff, null),
      ];
  return items.map((it, i) => ({ ...it, number: String(i + 1).padStart(2, '0') }));
}
