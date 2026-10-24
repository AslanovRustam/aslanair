'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  AddEquation,
  Color,
  CustomBlending,
  MathUtils,
  Matrix4,
  OneFactor,
  Quaternion,
  ShaderMaterial,
  Vector3,
  Vector4,
  ZeroFactor,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type PerspectiveCamera,
} from 'three';
import { CURTAIN_LAYER } from '@/experience/curtain';
import { curtainStore } from '@/experience/curtainStore';
import { MODEL_URL, WINDOW_GLOW } from './aircraft/Aircraft';
import NightLights from './aircraft/NightLights';

/** The covered screen: the site's dark. */
const DARK = new Color('#07080b');
/**
 * The plane across the covered screen: the 37.6 m airliner seen from above, its length `share` of the frame height,
 * nose down; it flies from `from` to `to` half-heights off the frame's centre (top to bottom), banking up to `bank`.
 */
const PLANE = { length: 37.6, share: 0.55, from: 1.35, to: -1.35, bank: MathUtils.degToRad(10) };
const NOSE_AXIS = new Vector3(1, 0, 0);

const QUAD_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/** Two layers with bowed edges (curtain.ts): terracotta under the night's dark; sRGB out, like the page around it. */
const QUAD_FRAGMENT = /* glsl */ `
uniform vec4 uEdges;
uniform float uBulge;
uniform float uOpacity;
varying vec2 vUv;
float layer(float top, float bottom, float arch) {
  if (top <= 0.0 || bottom >= 1.0) return 0.0;
  float aa = fwidth(vUv.y) * 1.5;
  float yt = top >= 1.0 ? 2.0 : top + uBulge * arch * 0.5;
  float yb = bottom <= 0.0 ? -1.0 : bottom - uBulge * arch * 0.5;
  return smoothstep(yb - aa, yb + aa, vUv.y) * (1.0 - smoothstep(yt - aa, yt + aa, vUv.y));
}
void main() {
  float arch = 4.0 * vUv.x * (1.0 - vUv.x);
  float a = layer(uEdges.x, uEdges.y, arch);
  float d = layer(uEdges.z, uEdges.w, arch);
  vec3 accent = mix(vec3(0.831, 0.408, 0.227), vec3(0.561, 0.227, 0.118), vUv.x);
  vec3 dark = vec3(0.0275, 0.0314, 0.0431);
  float alpha = max(a, d) * uOpacity;
  if (alpha <= 0.0) discard;
  gl_FragColor = vec4(mix(accent, dark, d), alpha);
}`;

/** Two contrails off the engines, fading out behind the plane (its frame: x along it, z across, top towards us). */
const TRAIL = { length: 45, width: 16, engines: 5.75, line: 0.3 };
const TRAIL_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const TRAIL_FRAGMENT = /* glsl */ `
uniform float uFade;
uniform vec2 uLines;
uniform float uLine;
varying vec2 vUv;
void main() {
  float across = exp(-pow((vUv.y - uLines.x) / uLine, 2.0)) + exp(-pow((vUv.y - uLines.y) / uLine, 2.0));
  float along = pow(vUv.x, 2.0);
  gl_FragColor = vec4(vec3(0.75, 0.78, 0.85) * across * along * uFade * 0.6, 1.0);
}`;

const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);

/**
 * The curtain of the chapter transition in WebGL (spec r4 §7), in the one canvas. While it rises and leaves: a
 * full-screen quad drawn over everything. While the screen is covered: the camera sees only the curtain layer — the
 * lights and a clone of the airliner (the same geometry and materials, so nothing downloads or compiles again), which
 * flies down across the dark with its night lights and contrails. Everything here compiles under the loader.
 */
export default function CurtainPass({ onCompiled }: { onCompiled?: () => void }) {
  const { scene: model } = useGLTF(MODEL_URL);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const root = useThree((s) => s.scene);
  const group = useRef<Group>(null);
  const plane = useRef<Group>(null);
  const quad = useRef<Mesh>(null);
  const trail = useRef<Mesh>(null);
  const glass = useRef<MeshStandardMaterial | null>(null);
  const saved = useRef<number | null>(null);
  const tmp = useMemo(() => ({ fwd: new Vector3(), up: new Vector3(), x: new Vector3(), y: new Vector3(), basis: new Matrix4(), bank: new Quaternion() }), []);

  const clone = useMemo(() => {
    const c = model.clone(true);
    // the cabin inside never shows from out here
    c.traverse((o) => {
      if (/^Cabin/.test(o.name)) o.visible = false;
    });
    return c;
  }, [model]);

  const quadMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uEdges: { value: new Vector4() }, uBulge: { value: 0 }, uOpacity: { value: 1 } },
        vertexShader: QUAD_VERTEX,
        fragmentShader: QUAD_FRAGMENT,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    [],
  );
  const trailMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uFade: { value: 0 },
          uLines: { value: [0.5 - TRAIL.engines / TRAIL.width, 0.5 + TRAIL.engines / TRAIL.width] },
          uLine: { value: TRAIL.line / TRAIL.width },
        },
        vertexShader: TRAIL_VERTEX,
        fragmentShader: TRAIL_FRAGMENT,
        transparent: true,
        depthWrite: false,
        // added light, the canvas's alpha left alone
        blending: CustomBlending,
        blendEquation: AddEquation,
        blendSrc: OneFactor,
        blendDst: OneFactor,
        blendSrcAlpha: ZeroFactor,
        blendDstAlpha: OneFactor,
      }),
    [],
  );

  useLayoutEffect(() => {
    // the plane lives on the curtain layer only (its night lights too, mounted with it)
    plane.current!.traverse((o) => {
      o.layers.set(CURTAIN_LAYER);
      const m = (o as Mesh).material as MeshStandardMaterial | undefined;
      if (m?.name === 'WindowGlass') glass.current = m;
    });
    let alive = true;
    const done = () => {
      if (alive) onCompiled?.();
    };
    gl.compileAsync(group.current!, camera, root).then(done, done);
    return () => {
      alive = false;
    };
  }, [gl, camera, root, onCompiled]);

  useFrame(({ camera: cam, scene }) => {
    const f = curtainStore.getState().frame;
    const stage = f?.stage ?? 'idle';
    const covered = stage === 'covered';
    const q = quad.current!;
    const p = plane.current!;
    q.visible = !!f && (stage === 'cover' || stage === 'reveal');
    if (f && q.visible) {
      const u = (q.material as ShaderMaterial).uniforms;
      u.uEdges.value.set(f.accent.top, f.accent.bottom, f.dark.top, f.dark.bottom);
      u.uBulge.value = f.bulge;
      u.uOpacity.value = f.opacity;
    }
    // covered: the camera sees only the curtain layer, on the site's dark
    if (covered && saved.current === null) {
      saved.current = cam.layers.mask;
      cam.layers.set(CURTAIN_LAYER);
    } else if (!covered && saved.current !== null) {
      cam.layers.mask = saved.current;
      saved.current = null;
    }
    if (covered) scene.background = DARK;
    else if (scene.background === DARK) scene.background = null;

    p.visible = covered && f!.plane !== null;
    if (!p.visible) return;
    const k = f!.plane!;
    const c = cam as PerspectiveCamera;
    const half = Math.tan(MathUtils.degToRad(c.fov) / 2);
    const distance = PLANE.length / (PLANE.share * 2 * half);
    const { fwd, up, x, y, basis, bank } = tmp;
    c.getWorldDirection(fwd);
    up.set(0, 1, 0).applyQuaternion(c.quaternion);
    p.position.copy(c.position).addScaledVector(fwd, distance).addScaledVector(up, MathUtils.lerp(PLANE.from, PLANE.to, easeInOut(k)) * distance * half);
    // nose down the screen, top towards the camera, banking a little on the way
    x.copy(up).negate();
    y.copy(fwd).negate();
    basis.makeBasis(x, y, x.clone().cross(y));
    p.quaternion.setFromRotationMatrix(basis).multiply(bank.setFromAxisAngle(NOSE_AXIS, PLANE.bank * Math.sin(Math.PI * k)));
    (trail.current!.material as ShaderMaterial).uniforms.uFade.value = Math.min(1, k * 4);
    // seen from outside, its windows glow (the shared glass goes dark while the main camera is aboard)
    if (glass.current) glass.current.emissiveIntensity = WINDOW_GLOW.intensity;
  });

  return (
    <group ref={group} name="Curtain">
      <mesh ref={quad} name="CurtainQuad" material={quadMaterial} frustumCulled={false} renderOrder={1e9} visible={false}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      <group ref={plane} name="CurtainPlane" visible={false}>
        <primitive object={clone} />
        <NightLights />
        {/* behind the tail (−x), in the wing plane, which faces the camera */}
        <mesh ref={trail} position={[-19 - TRAIL.length / 2, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} material={trailMaterial} frustumCulled={false}>
          <planeGeometry args={[TRAIL.length, TRAIL.width]} />
        </mesh>
      </group>
    </group>
  );
}
