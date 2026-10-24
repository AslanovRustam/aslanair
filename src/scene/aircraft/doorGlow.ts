// The warm light of the cabin around door 1L as it comes ajar (spec r4 §8.1), painted by the hull's own materials:
// it lies on the curved skin exactly along the door's rounded outline, from any angle — a flat quad off the skin
// slid away from the door as the camera came round.
import { Color, Matrix4, Vector4, type Material, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { DOOR_1L, stationToX } from '@/experience/geometry';

/** Shared by every material that wears the light; Aircraft feeds the strength and its frame each frame. */
export const DOOR_GLOW_UNIFORMS = {
  /** 0 … 1 (doorGlow in aircraftAnimation.ts). */
  uDoorGlow: { value: 0 },
  /** World → the aircraft's own frame (nose +x, port −z). */
  uToAircraft: { value: new Matrix4() },
  /** The door's centre (x, y) and half size (x, y) in that frame. */
  uDoor: { value: new Vector4(stationToX(DOOR_1L.station), DOOR_1L.y, DOOR_1L.width / 2, DOOR_1L.height / 2) },
  uDoorRadius: { value: DOOR_1L.radius },
  uDoorColor: { value: new Color('#ffb46e') },
};

const VERTEX_DECL = /* glsl */ `varying vec3 vDoorWorld;`;
const VERTEX_BODY = /* glsl */ `vDoorWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`;
const FRAGMENT_DECL = /* glsl */ `
uniform float uDoorGlow;
uniform mat4 uToAircraft;
uniform vec4 uDoor;
uniform float uDoorRadius;
uniform vec3 uDoorColor;
varying vec3 vDoorWorld;`;
/**
 * On the port side, within 0.6 m of the door's rounded outline (its signed distance d in the side's x–y plane, which
 * the door's cut follows): a glow falling off outward from the outline, and the panel's own rim lit from behind it.
 * The panel sliding forward as it opens leaves the outline, and its light with it.
 */
const FRAGMENT_BODY = /* glsl */ `
if (uDoorGlow > 0.0) {
  vec3 doorP = (uToAircraft * vec4(vDoorWorld, 1.0)).xyz;
  vec2 doorQ = abs(doorP.xy - uDoor.xy) - (uDoor.zw - uDoorRadius);
  float doorD = length(max(doorQ, 0.0)) + min(max(doorQ.x, doorQ.y), 0.0) - uDoorRadius;
  if (doorP.z < 0.0 && doorD < 0.6) {
    float outside = step(0.0, doorD) * exp(-doorD * 9.0) * 0.9;
    float rim = (1.0 - step(0.0, doorD)) * 0.6 * exp(doorD * 16.0);
    totalEmissiveRadiance += uDoorColor * uDoorGlow * (outside + rim);
  }
}`;

/** Adds the door's light to a hull material, after whatever it compiled with before (and keys its program apart). */
export function withDoorGlow<T extends Material>(material: T): T {
  const before = material.onBeforeCompile;
  const key = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => {
    before.call(material, shader, renderer);
    Object.assign(shader.uniforms, DOOR_GLOW_UNIFORMS);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_DECL}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_DECL}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${FRAGMENT_BODY}`);
  };
  material.customProgramCacheKey = () => `${key()}|door-glow`;
  return material;
}
