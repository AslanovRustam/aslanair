import { MathUtils, Vector3 } from 'three';
import type { CameraPose } from './cameraPoses';
import { chapterAt } from './chapters';

/**
 * The intro: the hero shows a picture of the plane, captured from this scene at `swapPose`, and the live 3D
 * takes over when the camera reaches that same pose. Three-quarter front view, nose to the left, the plane
 * filling about 70 % of a 16:9 frame. Times are fractions of the sky chapter.
 */
export const INTRO = {
  /** The picture is full frame here; the 3D plane is already behind it from `swapAt − crossfade`. */
  swapAt: 0.8,
  /** The picture fades out over this after the swap; the camera holds the pose until it has. */
  crossfade: 0.06,
  /** The hero: the picture at this fraction of the frame height, lifted by this fraction of it. */
  heroScale: 0.42,
  heroLift: 0.18,
  swapPose: { position: new Vector3(42, 6.5, -36), target: new Vector3(0, 0, 0), fov: 30 } satisfies CameraPose,
  /** public/images/plane-hero.png, and the plane's box in it (fractions; measured — re-measure on a recapture). */
  picture: { width: 1600, height: 900, plane: { left: 0.187, right: 0.868, top: 0.243, bottom: 0.671 } },
};

export interface IntroFrame {
  imageScale: number;
  /** Lift of the picture above the frame centre, in frame heights. */
  imageY: number;
  imageOpacity: number;
  aircraftVisible: boolean;
}

/** On a narrow screen the hero picture shrinks so the whole plane fits in this share of the width. */
const HERO_FIT = 0.86;
const easeOutCubic = (u: number) => 1 - (1 - u) ** 3;
/** Float noise in progress must not keep the picture a hair from landed, or from gone. */
const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

function heroScale(aspect: number): number {
  const { plane, width, height } = INTRO.picture;
  const planeWidth = (plane.right - plane.left) * (width / height); // in frame heights at scale 1
  return Math.min(INTRO.heroScale, (HERO_FIT * aspect) / planeWidth);
}

/** The picture's flight from the hero to the full frame and the hand-over to the 3D plane, for pre-track progress. */
export function introState(progress: number, aspect = 16 / 9): IntroFrame {
  const chapter = chapterAt('pre', progress);
  const t = chapter.id === 'sky' ? round6(chapter.t) : 1;
  const k = easeOutCubic(MathUtils.clamp(t / INTRO.swapAt, 0, 1));
  return {
    imageScale: MathUtils.lerp(heroScale(aspect), 1, k),
    imageY: INTRO.heroLift * (1 - k),
    imageOpacity: round6(1 - MathUtils.clamp((t - INTRO.swapAt) / INTRO.crossfade, 0, 1)),
    aircraftVisible: t >= round6(INTRO.swapAt - INTRO.crossfade),
  };
}
