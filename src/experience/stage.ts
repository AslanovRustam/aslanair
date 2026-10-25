import { Euler, MathUtils, Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { applyLens, poseOnPreTrack, type CameraPose } from './cameraPoses';
import { chapterAt, trackProgress } from './chapters';
import { GLOBE, GLOBE_FADE } from './globe';
import { INTRO } from './introState';
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

/** Over the globe the plane is 6 % of its 60 m diameter long: 3.6 m of the 37.6 m airliner. */
export const ON_GLOBE_SCALE = 0.0957;

/**
 * The transfer chapter: the plane flies in from beyond the right of the frame, nose first, slowing to a stop where it
 * waits beside the choices, turning slowly away over the chapter (from `turn` to `away`); in the ready chapter it
 * turns back to face the camera, at rest for the door flight. `up`: metres higher as it comes in.
 */
const WAITING = { up: 2, turn: degToRad(25), away: degToRad(-20), faces: 0.8 };
/** Its flight in (spec r5 §4): at `ready` of the destinations chapter — gone over the globe's horizon, the globe
 * starting to fade — it moves unseen to just beyond the frame's right edge (its box's left side at `edge` of the
 * frame's width); from `start`, the globe nearly gone, it comes across to a stop at `settle` of the transfer chapter,
 * carried by the camera while the camera still turns (seenFrom), so no empty sky lies between the two. */
export const ARRIVAL = { ready: GLOBE_FADE.from, start: 0.87, settle: 0.24, edge: 1.04 } as const;

/** The plane's point over the globe in the world, its nose's heading and its up (Task 6 computes it). */
export interface OnGlobe {
  position: Vector3;
  heading: Vector3;
  up: Vector3;
}

/**
 * The first screen's departure (spec r4 §3.4): from rest the plane sets off along its nose, turns right (away from
 * the hero camera, banked into the turn) and dives off towards the globe, shrinking to its size over the globe; it
 * comes over the globe's top edge as the hero camera sees it and slips round behind it, never through it, before the
 * chapter ends. A cubic Bézier: `forward` metres along the nose, then `over` radii above the globe's centre across
 * the camera's view, ending `behind` (radii above, radii beyond the centre) out of sight; `end` is where it gets there
 * and `shrunk` where it has its size over the globe.
 */
const DEPARTURE = { forward: 14, over: 1.6, behind: [0.6, 1.3], end: 0.93, shrunk: 0.85, turn: 0.6, bank: degToRad(20), pitch: [degToRad(-30), degToRad(15)] };
/** From the hero camera through the globe's centre, and up across that view. */
const AWAY = GLOBE.center.clone().sub(INTRO.swapPose.position).normalize();
const OVER = new Vector3(0, 1, 0).addScaledVector(AWAY, -AWAY.y).normalize();
/** The heading it turns to: into the hero camera's view, level (yaw about y; the nose starts along +x). */
const AWAY_YAW = Math.atan2(-AWAY.z, AWAY.x);
const PATH = [
  new Vector3(),
  new Vector3(DEPARTURE.forward, 0, 0),
  GLOBE.center.clone().addScaledVector(OVER, GLOBE.radius * DEPARTURE.over),
  GLOBE.center.clone().addScaledVector(OVER, GLOBE.radius * DEPARTURE.behind[0]).addScaledVector(AWAY, GLOBE.radius * DEPARTURE.behind[1]),
];

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

/**
 * Where the plane waits unseen once it has gone round the globe (or without a point over it): far off to the side of
 * the globe as its camera sees it, at its size there — out of frame until it flies in for the transfer.
 */
const parked = (): Stage => ({
  position: GLOBE.center.clone().addScaledVector(AWAY.clone().cross(new Vector3(0, 1, 0)).normalize(), GLOBE.radius * 8),
  rotation: new Euler(0, AWAY_YAW, 0, 'YZX'),
  scale: ON_GLOBE_SCALE,
});

const rest = (): Stage => ({ position: new Vector3(), rotation: new Euler(0, 0, 0, 'YZX'), scale: 1 });

function departure(t: number): Stage {
  const u = smoothstep(t, 0, DEPARTURE.end);
  const [p0, p1, p2, p3] = PATH;
  const a = (1 - u) ** 2;
  const position = p0.clone().multiplyScalar(a * (1 - u)).addScaledVector(p1, 3 * a * u).addScaledVector(p2, 3 * (1 - u) * u * u).addScaledVector(p3, u ** 3);
  // nose along the path: the curve's tangent
  const tangent = p1.clone().sub(p0).multiplyScalar(3 * a).addScaledVector(p2.clone().sub(p1), 6 * (1 - u) * u).addScaledVector(p3.clone().sub(p2), 3 * u * u).normalize();
  const [low, high] = DEPARTURE.pitch;
  return {
    position,
    // yaw about y — turning right, into the camera's view, over the first stretch (the path's own heading flips where
    // it dives) — then pitch about z (the dive held to a glide), then roll about the nose: starboard (+z) wing down
    // into the turn
    rotation: new Euler(DEPARTURE.bank * Math.sin(Math.PI * u), AWAY_YAW * smoothstep(u, 0, DEPARTURE.turn), MathUtils.clamp(Math.asin(tangent.y), low, high), 'YZX'),
    // shrinking to its size over the globe from the first scroll on (eased out), so it never looms as it sets off
    scale: ON_GLOBE_SCALE ** (1 - (1 - Math.min(t / DEPARTURE.shrunk, 1)) ** 2),
  };
}

function turnedTo(yaw: number): Stage {
  return { position: new Vector3(), rotation: new Euler(0, yaw, 0, 'YZX'), scale: 1 };
}

/** The flight in for a frame of one aspect: along that transfer camera's right (square to its gaze, so the plane
 * keeps its depth and slides straight across the screen), nose first, from `distance` metres out. */
interface Entry {
  right: Vector3;
  /** The nose's heading coming in, right to left across the view (yaw about y; the nose is +x at 0). */
  yaw: number;
  distance: number;
}

/** `away` of the way out, turned from its heading coming in towards `yaw` as it arrives. */
function flyingIn(entry: Entry, away: number, yaw: number): Stage {
  return {
    position: entry.right.clone().multiplyScalar(entry.distance * away).add(new Vector3(0, WAITING.up * away, 0)),
    rotation: new Euler(0, MathUtils.lerp(yaw, entry.yaw, away), 0, 'YZX'),
    scale: 1,
  };
}

/** The flight in for a frame of this aspect, its start just beyond the frame's right edge (cached per aspect). */
const entryFor = (() => {
  const known = new Map<number, Entry>();
  return (aspect: number): Entry => {
    const key = Math.round(aspect * 1000) / 1000;
    let entry = known.get(key);
    if (!entry) {
      const pose = poseOnPreTrack(trackProgress('pre', 'transfer', 0.5), key);
      const right = pose.target.clone().sub(pose.position).cross(new Vector3(0, 1, 0)).normalize();
      const found: Entry = { right, yaw: Math.atan2(right.z, -right.x), distance: 0 };
      let [near, far] = [0, 600];
      for (let i = 0; i < 32; i++) {
        found.distance = (near + far) / 2;
        if (projectedBox(flyingIn(found, 1, WAITING.turn), pose, key).x0 < ARRIVAL.edge) near = found.distance;
        else far = found.distance;
      }
      found.distance = far;
      entry = found;
      known.set(key, entry);
    }
    return entry;
  };
})();

/** A camera at `pose` for a frame of `aspect`, its lens shifted as the scene's is. */
function lensCamera(pose: CameraPose, aspect: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(pose.fov, aspect, 0.1, 10000);
  camera.position.copy(pose.position);
  camera.lookAt(pose.target);
  applyLens(camera, pose, aspect, 1);
  camera.updateMatrixWorld();
  return camera;
}

/** The transfer's own camera for a frame of this aspect, where the flight in is laid out (cached per aspect). */
const transferCamera = (() => {
  const known = new Map<number, PerspectiveCamera>();
  return (aspect: number): PerspectiveCamera => {
    const key = Math.round(aspect * 1000) / 1000;
    let camera = known.get(key);
    if (!camera) known.set(key, (camera = lensCamera(poseOnPreTrack(trackProgress('pre', 'transfer', 0.5), key), key)));
    return camera;
  };
})();

/**
 * The plane `stage` of the transfer's frame, carried by a camera still turning towards it: it keeps its place on the
 * screen and its depth — and its heading to the camera — so it comes in steadily while the view swings round
 * (spec r5 §4); once the turn is done, the two are one.
 */
function seenFrom(stage: Stage, pose: CameraPose, aspect: number): Stage {
  const final = transferCamera(aspect);
  const now = lensCamera(pose, aspect);
  const depth = -stage.position.clone().applyMatrix4(final.matrixWorldInverse).z;
  const onScreen = stage.position.clone().project(final);
  const ray = onScreen.setZ(0.5).unproject(now).sub(now.position).normalize();
  const position = now.position.clone().addScaledVector(ray, depth / ray.dot(now.getWorldDirection(new Vector3())));
  const turn = now.quaternion.clone().multiply(final.quaternion.clone().invert());
  const rotation = new Euler().setFromQuaternion(turn.multiply(new Quaternion().setFromEuler(stage.rotation)), stage.rotation.order);
  return { position, rotation, scale: stage.scale };
}

/** At track progress `progress` across the destinations → transfer seam; `t` is the transfer chapter's own share
 * (0 before it). */
function waiting(progress: number, t: number, aspect: number, reduced: boolean): Stage {
  // flying in already at 1.2 × its mean pace and slowing to a stop (it sets off beyond the edge, where no start is
  // seen): f(0) = 0, f'(0) = 1.2, f(1) = 1, f'(1) = 0 — its fastest only 1.35 × the mean
  const u = MathUtils.clamp(MathUtils.inverseLerp(trackProgress('pre', 'destinations', ARRIVAL.start), trackProgress('pre', 'transfer', ARRIVAL.settle), progress), 0, 1);
  const arrived = 1.2 * u + 0.6 * u ** 2 - 0.8 * u ** 3;
  const slowTurn = WAITING.turn + (WAITING.away - WAITING.turn) * smoothstep(t, 0, 1);
  const stage = flyingIn(entryFor(aspect), 1 - arrived, slowTurn);
  // in the transfer chapter the camera has come round: the frame is the transfer's own — as it is from the turn on
  // under reduced motion, where the camera cuts there instead of turning (reducedMotion.ts)
  return t > 0 || reduced ? stage : seenFrom(stage, poseOnPreTrack(progress, aspect), aspect);
}

function overTheGlobe(at: OnGlobe): Stage {
  const nose = at.heading.clone().normalize();
  const turn = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(nose, at.up, nose.clone().cross(at.up)));
  return { position: at.position.clone(), rotation: new Euler().setFromQuaternion(turn, 'YZX'), scale: ON_GLOBE_SCALE };
}

/**
 * Where the aircraft stands for this phase and scroll position. The journey's chapters place it; from the door on,
 * and after a seat is chosen, it stands at the origin (the flight's fly-away is applied on top, see cameraPoses).
 * `onGlobe` is the plane's point over the globe; without it the plane waits parked, out of frame. Between the
 * chapters it changes place unseen: behind the globe, then out of frame. `aspect` (the frame's width over height)
 * sets where the flight in for the transfer starts: just beyond that frame's right edge.
 */
export function aircraftStage(phase: Phase, progress: number, onGlobe?: OnGlobe, aspect = 16 / 9, reduced = false): Stage {
  if (trackOf(phase) === 'post' || phase === 'seated') return rest();
  const { id, t } = chapterAt('pre', progress);
  if (id === 'sky') return departure(t);
  // over the globe it comes and goes over the horizon (globe.ts), so it is never seen to change place; before and
  // after, it holds the departure's end, out of frame
  if (id === 'destinations') {
    if (t >= ARRIVAL.ready) return waiting(progress, 0, aspect, reduced);
    return onGlobe ? overTheGlobe(onGlobe) : parked();
  }
  if (id === 'transfer') return waiting(progress, t, aspect, reduced);
  // `|| 0` keeps −0 out of the rest pose
  if (id === 'ready') return turnedTo(WAITING.away * (1 - smoothstep(t, 0, WAITING.faces)) || 0);
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
