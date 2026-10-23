import { Vector3 } from 'three';
import type { CameraPose } from './cameraPoses';

/**
 * The intro: the hero shows a picture of the plane, captured from this scene at `swapPose`, and the live 3D
 * takes over when the camera reaches that same pose. Three-quarter front view, nose to the left, the plane
 * filling about 70 % of a 16:9 frame.
 */
export const INTRO = {
  swapPose: { position: new Vector3(42, 6.5, -36), target: new Vector3(0, 0, 0), fov: 30 } satisfies CameraPose,
};
