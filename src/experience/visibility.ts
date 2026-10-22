import { chapterAt } from './chapters';
import { trackOf, type Phase } from './store';

/** Door flight: the camera is through the hull from here on. */
const DOOR_INSIDE_T = 0.62;
/** Exit flight: the camera is outside the hull from here on. */
const EXIT_OUTSIDE_T = 0.4;

/** The placeholder cabin is a box that pokes through the hull, so it is drawn only while the camera is inside. */
export function cabinVisible(phase: Phase, progress: number): boolean {
  if (phase === 'seated') return true;
  const { id, t } = chapterAt(trackOf(phase), progress);
  if (id === 'door') return t >= DOOR_INSIDE_T;
  if (id === 'exit') return t < EXIT_OUTSIDE_T;
  return id === 'aisle' || id === 'pass';
}
