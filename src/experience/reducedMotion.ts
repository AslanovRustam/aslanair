import { poseOnPostTrack, poseOnPreTrack, type CameraPose } from './cameraPoses';
import { trackProgress, type ChapterId, type Track } from './chapters';

/**
 * Reduced motion (spec §4.8: «облёты заменяются мягкими переходами»): the camera never flies. Each track is cut into
 * keys; from a key's `from` (track progress) on, the camera holds the pose at `at` — and the Veil covers each change of
 * key while the camera cuts there. `at: 'walk'` follows the scroll itself: the aisle is a walk, not a flight.
 */
export interface ReducedKey {
  name: string;
  from: number;
  at: number | 'walk';
}

const pre = (id: ChapterId, t: number) => trackProgress('pre', id, t);
const post = (id: ChapterId, t: number) => trackProgress('post', id, t);

export const REDUCED_KEYS: Record<Track, ReducedKey[]> = {
  pre: [
    // the hero, as the loader handed it over; the camera turns its gaze to the globe as the first screen ends
    { name: 'hero', from: 0, at: pre('sky', 0) },
    { name: 'globe', from: pre('sky', 0.6), at: pre('destinations', 0.5) },
    // the transfer's frame, from where the camera would turn to it until halfway through Ready
    { name: 'transfer', from: pre('destinations', 0.88), at: pre('transfer', 0.5) },
    // before the door, then inside it — where the aisle's walk begins, under the same key, so no veil between
    { name: 'door', from: pre('ready', 0.5), at: pre('door', 0.15) },
    { name: 'aboard', from: pre('door', 0.6), at: pre('aisle', 0) },
    { name: 'aboard', from: pre('aisle', 0), at: 'walk' },
  ],
  post: [
    { name: 'pass', from: 0, at: post('pass', 0.5) },
    // out through the window: from the seat straight to the pull-back
    { name: 'out', from: post('exit', 0.5), at: post('exit', 1) },
    { name: 'outro', from: post('outro', 0), at: post('outro', 0.5) },
  ],
};

/** The camera's pose under reduced motion at `progress` along `track`, and the key it belongs to (a new key is a cut
 * under the Veil). The post track needs the visitor's seat. */
export function reducedPose(
  track: Track,
  progress: number,
  aspect = 16 / 9,
  seat?: Parameters<typeof poseOnPostTrack>[1],
): { pose: CameraPose; key: string } {
  const keys = REDUCED_KEYS[track];
  let key = keys[0];
  for (const k of keys) if (progress >= k.from) key = k;
  const at = key.at === 'walk' ? progress : key.at;
  const pose = track === 'pre' ? poseOnPreTrack(at, aspect) : poseOnPostTrack(at, seat!);
  return { pose, key: key.name };
}
