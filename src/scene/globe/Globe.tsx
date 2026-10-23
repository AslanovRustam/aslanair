'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AddEquation,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CustomBlending,
  MathUtils,
  OneFactor,
  ShaderMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  ZeroFactor,
  type Group,
  type Mesh,
  type PerspectiveCamera,
} from 'three';
import { CITY_LIGHTS } from '@/experience/cities';
import { DESTINATIONS, destination, HOME } from '@/experience/destinations';
import { arcDrawn, arcPoints, GLOBE, globeFade, globeTurnAt, latLonToVector } from '@/experience/globe';
import { experienceStore, useExperience } from '@/experience/store';
import { landMask } from './landMask';

/** Degrees between the land's dots, along a parallel and between parallels. */
const LAND_STEP = 1.1;
/** Heights above the surface, in radii: dots, lights and markers clear the sphere's depth at 140 m. */
const LIFT = { land: 1.004, city: 1.006, marker: 1.01 };
const COLORS = {
  ocean: '#0a1222',
  rim: '#3d5c9a',
  halo: '#2f4f8f',
  land: '#b9c4dc',
  city: '#ffc87e',
  home: '#d4683a',
  destination: '#f2efe8',
  arc: '#e58a5c',
};

/** Points over the land in rows along the parallels, every other row offset half a step. */
function landPoints(isLand: (lat: number, lon: number) => boolean): Float32Array {
  const out: number[] = [];
  let row = 0;
  for (let lat = -84; lat <= 84; lat += LAND_STEP, row++) {
    const count = Math.max(1, Math.round((360 * Math.cos(MathUtils.degToRad(lat))) / LAND_STEP));
    for (let i = 0; i < count; i++) {
      const lon = -180 + ((i + (row % 2) * 0.5) * 360) / count;
      if (isLand(lat, lon)) out.push(...latLonToVector(lat, lon, GLOBE.radius * LIFT.land).toArray());
    }
  }
  return new Float32Array(out);
}

function pointsGeometry(positions: Float32Array, sizes: Float32Array, kinds?: Float32Array): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setAttribute('aSize', new BufferAttribute(sizes, 1));
  if (kinds) g.setAttribute('aKind', new BufferAttribute(kinds, 1));
  return g;
}

/** Points sized in metres; `vFacing` fades them towards the limb and hides the far side. */
const POINTS_VERTEX = /* glsl */ `
uniform float uScale;
attribute float aSize;
attribute float aKind;
varying float vFacing;
varying float vKind;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFacing = dot(normalize(normalMatrix * normalize(position)), normalize(-mv.xyz));
  vKind = aKind;
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const LAND_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uFade;
varying float vFacing;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(uColor, smoothstep(0.5, 0.25, d) * smoothstep(0.0, 0.4, vFacing) * 0.5 * uFade);
}`;

/** A warm light with a soft glow round it (additive). */
const GLOW_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uFade;
varying float vFacing;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float glow = exp(-d * d * 9.0) + 0.6 * exp(-d * d * 60.0);
  gl_FragColor = vec4(uColor * glow * smoothstep(0.0, 0.3, vFacing) * uFade, 1.0);
}`;

/** Markers by index (0 home, then the destinations); the chosen and the hovered one grow. */
const MARKER_VERTEX = /* glsl */ `
uniform float uScale;
uniform float uChosen;
uniform float uHover;
attribute float aSize;
attribute float aKind;
attribute float aIndex;
varying float vFacing;
varying float vKind;
varying float vChosen;
varying float vHover;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFacing = dot(normalize(normalMatrix * normalize(position)), normalize(-mv.xyz));
  vKind = aKind;
  vChosen = step(abs(aIndex - uChosen), 0.5);
  vHover = step(abs(aIndex - uHover), 0.5);
  gl_PointSize = aSize * (1.0 + 0.5 * vChosen + 0.3 * vHover) * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

/** Markers: a bright core in a ring; home (aKind 1) in terracotta, the destinations in warm white, the chosen one
 * ringed in terracotta. */
const MARKER_FRAGMENT = /* glsl */ `
uniform vec3 uHome;
uniform vec3 uDestination;
uniform float uFade;
varying float vFacing;
varying float vKind;
varying float vChosen;
varying float vHover;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float core = smoothstep(0.34, 0.24, d);
  float ring = smoothstep(0.1, 0.0, abs(d - 0.7)) * 0.8;
  float glow = exp(-d * d * 5.0) * (0.35 + 0.4 * vHover);
  vec3 base = mix(uDestination, uHome, vKind);
  vec3 color = base * (core + glow) + mix(base, uHome, vChosen) * ring;
  gl_FragColor = vec4(color * (1.0 + 0.4 * vHover) * smoothstep(0.05, 0.35, vFacing) * uFade, 1.0);
}`;

/** The flight's arc: drawn from home up to uDraw (0 … 1 along it), brightest at its drawing tip, a glint running on. */
const ARC_VERTEX = /* glsl */ `
varying float vAlong;
void main() {
  vAlong = uv.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const ARC_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uDraw;
uniform float uTime;
uniform float uFade;
varying float vAlong;
void main() {
  if (vAlong > uDraw) discard;
  float tip = smoothstep(uDraw - 0.12, uDraw, vAlong) * step(uDraw, 0.999);
  float glint = exp(-pow((fract(uTime * 0.35) * 1.4 - 0.2 - vAlong) * 9.0, 2.0));
  gl_FragColor = vec4(uColor * (0.55 + 1.2 * tip + 0.8 * glint) * uFade, 1.0);
}`;

const SPHERE_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

/** The dark sea, lit only at its limb. */
const OCEAN_FRAGMENT = /* glsl */ `
uniform vec3 uOcean;
uniform vec3 uRim;
uniform float uFade;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.5);
  gl_FragColor = vec4(uOcean + uRim * rim * 0.9, uFade);
}`;

/** The air round it: a shell seen from inside, glowing next to the globe and fading out to its edge. */
const HALO_FRAGMENT = /* glsl */ `
uniform vec3 uHalo;
uniform float uFade;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float glow = pow(max(-dot(vNormal, vView), 0.0), 3.0) * 2.2;
  gl_FragColor = vec4(uHalo * glow * uFade, 1.0);
}`;

/**
 * The night Earth: a dark sphere with a lit limb and a halo, the land as fine dots, the cities as warm lights, home
 * (Odesa) and the destinations marked. It stands in its own space below the aircraft (GLOBE), turned so the
 * chosen flight faces the camera, and fades in and out with globeFade. All of it is drawn under the loader once
 * (fade 0) so nothing compiles or uploads when it first comes into view.
 */
export default function Globe() {
  const gl = useThree((s) => s.gl);
  const group = useRef<Group>(null);
  const shared = useMemo(() => ({ uScale: { value: 1 }, uFade: { value: 0 } }), []);
  const parts = useMemo(() => {
    const transparent = { transparent: true, depthWrite: false };
    // light added to whatever is behind, the canvas's alpha left alone: over the see-through canvas it adds to the
    // page's dark instead of covering it (the drawing buffer is premultiplied)
    const additive = {
      ...transparent,
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: OneFactor,
      blendDst: OneFactor,
      blendSrcAlpha: ZeroFactor,
      blendDstAlpha: OneFactor,
    };
    const color = (hex: string) => ({ value: new Color(hex) });
    const markers = [HOME, ...DESTINATIONS];
    return {
      sphere: new SphereGeometry(GLOBE.radius, 96, 64),
      halo: new SphereGeometry(GLOBE.radius * 1.2, 64, 48),
      ocean: new ShaderMaterial({
        uniforms: { uOcean: color(COLORS.ocean), uRim: color(COLORS.rim), uFade: shared.uFade },
        vertexShader: SPHERE_VERTEX,
        fragmentShader: OCEAN_FRAGMENT,
        transparent: true,
      }),
      haloMaterial: new ShaderMaterial({
        uniforms: { uHalo: color(COLORS.halo), uFade: shared.uFade },
        vertexShader: SPHERE_VERTEX,
        fragmentShader: HALO_FRAGMENT,
        side: BackSide,
        ...additive,
      }),
      land: (() => {
        const positions = landPoints(landMask());
        return pointsGeometry(positions, new Float32Array(positions.length / 3).fill(0.32));
      })(),
      landMaterial: new ShaderMaterial({
        uniforms: { uColor: color(COLORS.land), ...shared },
        vertexShader: POINTS_VERTEX,
        fragmentShader: LAND_FRAGMENT,
        ...transparent,
      }),
      cities: pointsGeometry(
        new Float32Array(CITY_LIGHTS.flatMap(([lat, lon]) => latLonToVector(lat, lon, GLOBE.radius * LIFT.city).toArray())),
        new Float32Array(CITY_LIGHTS.map(([, , w]) => 0.5 + 0.35 * w)),
      ),
      cityMaterial: new ShaderMaterial({
        uniforms: { uColor: color(COLORS.city), ...shared },
        vertexShader: POINTS_VERTEX,
        fragmentShader: GLOW_FRAGMENT,
        ...additive,
      }),
      markers: (() => {
        const g = pointsGeometry(
          new Float32Array(markers.flatMap((m) => latLonToVector(m.lat, m.lon, GLOBE.radius * LIFT.marker).toArray())),
          new Float32Array(markers.map((m) => (m === HOME ? 2.6 : 1.9))),
          new Float32Array(markers.map((m) => (m === HOME ? 1 : 0))),
        );
        g.setAttribute('aIndex', new BufferAttribute(new Float32Array(markers.map((_, i) => i)), 1));
        return g;
      })(),
      markerMaterial: new ShaderMaterial({
        uniforms: { uHome: color(COLORS.home), uDestination: color(COLORS.destination), uChosen: { value: -1 }, uHover: { value: -1 }, ...shared },
        vertexShader: MARKER_VERTEX,
        fragmentShader: MARKER_FRAGMENT,
        ...additive,
      }),
      arcMaterial: new ShaderMaterial({
        uniforms: { uColor: color(COLORS.arc), uDraw: { value: 1 }, uTime: { value: 0 }, uFade: shared.uFade },
        vertexShader: ARC_VERTEX,
        fragmentShader: ARC_FRAGMENT,
        ...additive,
      }),
    };
  }, [shared]);

  useEffect(
    () => () => {
      for (const part of Object.values(parts)) part.dispose();
    },
    [parts],
  );

  // the chosen flight's arc, from home: rebuilt when the choice changes
  const chosenId = useExperience((s) => s.destinationId);
  const arc = useMemo(() => {
    const to = destination(chosenId) ?? DESTINATIONS[0];
    return new TubeGeometry(new CatmullRomCurve3(arcPoints(HOME, to, 64)), 128, 0.16, 6, false);
  }, [chosenId]);
  useEffect(() => () => arc.dispose(), [arc]);

  const buffer = useRef(new Vector2());
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    const s = experienceStore.getState();
    const fade = globeFade(s.phase, s.progress);
    // under the loader it is drawn (unseen) once, so its programs and buffers are ready before it shows
    g.visible = fade > 0 || !s.ready;
    if (!g.visible) return;
    const now = performance.now() / 1000;
    const chosen = destination(s.destinationId) ?? DESTINATIONS[0];
    g.quaternion.copy(globeTurnAt(s.flight, chosen, now, s.globeSpin));
    // pixels per metre at 1 m: the points keep their size in metres whatever the lens
    const fov = MathUtils.degToRad((camera as PerspectiveCamera).fov);
    const scale = gl.getDrawingBufferSize(buffer.current).y / (2 * Math.tan(fov / 2));
    // the arc draws with the plane's flight (none yet: already drawn)
    const draw = arcDrawn(s.flight, now);
    const index = (code: string | null) => (code ? 1 + DESTINATIONS.findIndex((d) => d.code === code) : -1);
    for (const child of g.children) {
      const uniforms = ((child as Mesh).material as ShaderMaterial).uniforms;
      if (uniforms.uFade) uniforms.uFade.value = fade;
      if (uniforms.uScale) uniforms.uScale.value = scale;
      if (uniforms.uDraw) uniforms.uDraw.value = draw;
      if (uniforms.uTime) uniforms.uTime.value = now;
      if (uniforms.uChosen) uniforms.uChosen.value = index(s.destinationId);
      if (uniforms.uHover) uniforms.uHover.value = index(s.hoveredDestinationId);
    }
  });

  return (
    <group ref={group} name="Globe" position={GLOBE.center.toArray()}>
      <mesh geometry={parts.sphere} material={parts.ocean} renderOrder={1} frustumCulled={false} />
      <mesh geometry={parts.halo} material={parts.haloMaterial} renderOrder={2} frustumCulled={false} />
      <points geometry={parts.land} material={parts.landMaterial} renderOrder={3} frustumCulled={false} />
      <mesh name="GlobeArc" geometry={arc} material={parts.arcMaterial} renderOrder={4} frustumCulled={false} />
      <points geometry={parts.cities} material={parts.cityMaterial} renderOrder={5} frustumCulled={false} />
      <points name="GlobeMarkers" geometry={parts.markers} material={parts.markerMaterial} renderOrder={6} frustumCulled={false} />
    </group>
  );
}
