// Cabin lighting without point lights: a warm indirect term injected into interior materials only.
// Point lights cost a light loop on every lit fragment (≈7 ms on Intel UHD) and, casting no shadows, leaked
// onto the wing outside; this term is one multiply-add and cannot reach anything that is not cabin.
import { Color, type Material } from 'three';

/** Shared uniform: one warm colour for the whole cabin (scaled for Lambert's 1/π). */
export const CABIN_LIGHT = { value: new Color('#fff1dc').multiplyScalar(1.4) };

// geometryPosition/geometryNormal are in view space; world position comes from the view rotation's transpose
// (no matrix inverse per fragment). Brighter high up and darker towards the floor; the cove strips wash the
// ceiling and bin faces that look down; a soft pool every row pitch gives the cabin its rhythm.
const GLSL = `
  vec3 cabinWorld = transpose(mat3(viewMatrix)) * (geometryPosition - viewMatrix[3].xyz);
  float cabinHeight = clamp((cabinWorld.y + 0.45) / 2.2, 0.0, 1.0);
  float cabinDown = max(-dot(geometryNormal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)), 0.0);
  float cabinPool = 0.9 + 0.1 * cos(6.2832 * cabinWorld.x / 0.76);
  irradiance += uCabinLight * (0.4 + 0.6 * cabinHeight) * (1.0 + 0.8 * cabinDown * cabinHeight * cabinHeight * cabinHeight) * cabinPool;
`;

export function withCabinLight<T extends Material>(material: T): T {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCabinLight = CABIN_LIGHT;
    shader.fragmentShader = `uniform vec3 uCabinLight;\n${shader.fragmentShader.replace('#include <lights_fragment_end>', `${GLSL}\n#include <lights_fragment_end>`)}`;
  };
  material.customProgramCacheKey = () => 'cabin-light';
  return material;
}
