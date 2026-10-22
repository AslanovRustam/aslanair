// Cabin lighting without point lights: a warm indirect term injected into interior materials only.
// Point lights cost a light loop on every lit fragment (≈7 ms on Intel UHD) and, casting no shadows, leaked
// onto the wing outside; this term is one multiply-add and cannot reach anything that is not cabin.
import { Color, type Material } from 'three';

/** Shared uniform: one warm colour for the whole cabin (scaled for Lambert's 1/π). */
export const CABIN_LIGHT = { value: new Color('#fff1dc').multiplyScalar(1.6) };

/**
 * Share of the sky environment interior surfaces take. three replaces a material's envMapIntensity with
 * scene.environmentIntensity whenever the material has no envMap of its own, so the scaling happens here.
 */
export const INTERIOR_ENV = { value: 0.5 };

// geometryPosition/geometryNormal are in view space; world position comes from the view rotation's transpose
// (no matrix inverse per fragment). Brighter high up and darker towards the floor; the cove strips wash the
// ceiling and bin faces that look down; a soft pool every row pitch gives the cabin its rhythm. Parts that
// receive no sun shadow also drop the direct sun: inside the closed fuselage it could only reach them falsely.
const SHADED = `
  reflectedLight.directDiffuse = vec3( 0.0 );
  reflectedLight.directSpecular = vec3( 0.0 );
`;

const glsl = (sun: boolean) => `
  vec3 cabinWorld = transpose(mat3(viewMatrix)) * (geometryPosition - viewMatrix[3].xyz);
  float cabinHeight = clamp((cabinWorld.y + 0.45) / 2.2, 0.0, 1.0);
  float cabinDown = max(-dot(geometryNormal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)), 0.0);
  float cabinPool = 0.9 + 0.1 * cos(6.2832 * cabinWorld.x / 0.76);
  irradiance += uCabinLight * (0.4 + 0.6 * cabinHeight) * (1.0 + 0.8 * cabinDown * cabinHeight * cabinHeight * cabinHeight) * cabinPool;
  #if defined( RE_IndirectDiffuse )
    iblIrradiance *= uInteriorEnv;
  #endif
  #if defined( RE_IndirectSpecular )
    radiance *= uInteriorEnv;
  #endif
${sun ? '' : SHADED}`;

export function withCabinLight<T extends Material>(material: T, { sun = true }: { sun?: boolean } = {}): T {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCabinLight = CABIN_LIGHT;
    shader.uniforms.uInteriorEnv = INTERIOR_ENV;
    const lights = shader.fragmentShader.replace('#include <lights_fragment_end>', `${glsl(sun)}\n#include <lights_fragment_end>`);
    shader.fragmentShader = `uniform vec3 uCabinLight;\nuniform float uInteriorEnv;\n${lights}`;
  };
  material.customProgramCacheKey = () => (sun ? 'cabin-light' : 'cabin-light-shaded');
  return material;
}
