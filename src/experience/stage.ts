import { Euler, MathUtils, Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { applyLens, type CameraPose } from './cameraPoses';
import { chapterAt } from './chapters';
import { trackOf, type Phase } from './store';

/** Where the one aircraft group stands: position, rotation (the aircraft frame: nose +x, port −z) and size. */
export interface Stage {
  position: Vector3;
  rotation: Euler;
  scale: number;
}

/** A box on screen in fractions of the frame, y down. */
export interface ScreenBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const { smoothstep, degToRad } = MathUtils;

/**
 * The first screen's departure: from rest the plane accelerates along its nose, turning right (towards +z, away from
 * the hero camera) and climbing, banked into the turn; with the camera's gaze turning down and left it crosses the
 * frame up and to the left and is gone by the end of the chapter. Metres; `pace` shapes the start from rest.
 */
const DEPARTURE = { forward: 35, aside: 25, climb: 10, bank: degToRad(25), pace: 1.3 };

/** The plane's extremities in its own frame, measured from the GLB: nose, tail cone, fin tip, wingtips, tailplane
 * tips, engine cowls' bottoms, crown and keel. */
const OUTLINE = [
  [18.8, -0.2, 0],
  [-19, 0.9, 0],
  [-15.6, 7.8, 0],
  [-4, 2.3, -17.84],
  [-4, 2.3, 17.84],
  [-16.5, 1.1, -6.21],
  [-16.5, 1.1, 6.21],
  [4.5, -3.48, -5.75],
  [4.5, -3.48, 5.75],
  [0, 2.1, 0],
  [0, -2.04, 0],
].map(([x, y, z]) => new Vector3(x, y, z));

const rest = (): Stage => ({ position: new Vector3(), rotation: new Euler(0, 0, 0, 'YZX'), scale: 1 });

function departure(t: number): Stage {
  const { forward, aside, climb, bank, pace } = DEPARTURE;
  const s = t ** pace;
  // nose along the path: its tangent (forward, 2·climb·s, 2·aside·s)
  const tangent = new Vector3(forward, 2 * climb * s, 2 * aside * s).normalize();
  return {
    position: new Vector3(forward * s, climb * s * s, aside * s * s),
    // yaw about y, then pitch about z, then roll about the nose: starboard (+z) wing down into the right turn
    rotation: new Euler(bank * smoothstep(t, 0, 0.6), Math.atan2(-tangent.z, tangent.x), Math.asin(tangent.y), 'YZX'),
    scale: 1,
  };
}

/**
 * Where the aircraft stands for this phase and scroll position. The journey's chapters place it; from the door on,
 * and after a seat is chosen, it stands at the origin (the flight's fly-away is applied on top, see cameraPoses).
 */
export function aircraftStage(phase: Phase, progress: number): Stage {
  if (trackOf(phase) === 'post' || phase === 'seated') return rest();
  const { id, t } = chapterAt('pre', progress);
  if (id === 'sky') return departure(t);
  // destinations and transfer hold the departure's end (out of frame) until they place the plane themselves
  if (id === 'destinations' || id === 'transfer') return departure(1);
  return rest();
}

/** The aircraft's outline on screen through `pose` in a frame of `aspect` (width / height): fractions, y down. */
export function projectedBox(stage: Stage, pose: CameraPose, aspect: number): ScreenBox {
  const camera = new PerspectiveCamera(pose.fov, aspect, 0.1, 10000);
  camera.position.copy(pose.position);
  camera.lookAt(pose.target);
  applyLens(camera, pose, aspect, 1);
  camera.updateMatrixWorld();
  const toWorld = new Matrix4().compose(stage.position, new Quaternion().setFromEuler(stage.rotation), new Vector3().setScalar(stage.scale));
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const corner of OUTLINE) {
    const p = corner.clone().applyMatrix4(toWorld).project(camera);
    const x = (p.x + 1) / 2;
    const y = (1 - p.y) / 2;
    box.x0 = Math.min(box.x0, x);
    box.x1 = Math.max(box.x1, x);
    box.y0 = Math.min(box.y0, y);
    box.y1 = Math.max(box.y1, y);
  }
  return box;
}
