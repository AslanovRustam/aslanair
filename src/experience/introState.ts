import { Vector3 } from 'three';
import type { CameraPose } from './cameraPoses';

/**
 * The intro: the loader shows a picture of the plane, captured from this scene at `swapPose`; at the hand-over the
 * live camera frames that pose zoomed and lens-shifted so the plane lands exactly where the picture showed it. Three-quarter front view, nose to the left, the plane
 * filling about 70 % of a 16:9 frame. Times are fractions of the sky chapter.
 */
export const INTRO = {
  /** The picture is full frame here; the 3D plane is already behind it from `swapAt − crossfade`. */
  swapAt: 0.8,
  /** The picture fades out over this after the swap; the camera holds the pose until it has. */
  crossfade: 0.06,
  /** The hero: the picture at this fraction of the frame height, lifted by this fraction of it (negative: lowered).
   * At 16:9 the plane spans two thirds of the width, its middle at the centre: it flies over the foot of the title and
   * clears the scroll cue (spec r4 §3.2). */
  heroScale: 0.97,
  heroLift: -0.04,
  swapPose: { position: new Vector3(42, 6.5, -36), target: new Vector3(0, 0, 0), fov: 30 } satisfies CameraPose,
  /** The picture (CSS size; the file is twice that, for 2× screens) and the plane's box in it (fractions; measured —
   * re-measure on a recapture). */
  picture: { src: '/images/plane-hero.webp', width: 1600, height: 900, plane: { left: 0.187, right: 0.868, top: 0.243, bottom: 0.671 } },
};

/** On a narrow screen the hero picture shrinks so the whole plane fits in this share of the width. */
const HERO_FIT = 0.86;

/**
 * The hero picture's height in frame heights: `height`, or on a narrow screen `perWidth` × the frame's width over
 * its height, whichever is smaller. The loader draws the picture from these too, so the hero picks it up in place.
 */
export const HERO_PICTURE = (() => {
  const { plane, width, height } = INTRO.picture;
  const planeWidth = (plane.right - plane.left) * (width / height); // in frame heights at scale 1
  return { height: INTRO.heroScale, perWidth: HERO_FIT / planeWidth, lift: INTRO.heroLift };
})();

/** The hero picture's height in frame heights for a frame of this aspect (width / height). */
export function heroScale(aspect: number): number {
  return Math.min(HERO_PICTURE.height, HERO_PICTURE.perWidth * aspect);
}

/**
 * The loader hands its plane to the hero (spec r5 §3): while loading it shows the picture at `start` of the hero's
 * size, on the hero's centre, its emblem and words above it; once the scene is ready the emblem and words step aside
 * over `aside` s, then the picture grows up into the hero's picture over `grow` s, and only then does the loader
 * fade over `fade` s, the live plane already in its place behind it.
 */
export const LOADER = { start: 0.5, aside: 0.2, grow: 0.9, fade: 0.6 } as const;

/** Seconds from ready until the loader is gone: the words stepping aside, the growth and the fade, or under reduced
 * motion one short fade (loader.module.css). The page holds still until then, so the picture and the live plane meet. */
export function handOverSeconds(reduced: boolean): number {
  return reduced ? 0.3 : LOADER.aside + LOADER.grow + LOADER.fade;
}

/** Seconds after the scene is ready that the hero's entrance starts: after the growth, or at once under reduced motion. */
export function heroEntranceDelay(reduced: boolean): number {
  return reduced ? 0 : LOADER.aside + LOADER.grow;
}
