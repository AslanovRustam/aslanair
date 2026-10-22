import { MeshLambertMaterial, MeshStandardMaterial } from 'three';
import { describe, expect, test } from 'vitest';
import { CABIN_LIGHT, INTERIOR_ENV, withCabinLight } from '@/scene/cabin/cabinLight';

const compile = (m: MeshStandardMaterial | MeshLambertMaterial) => {
  const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: '', fragmentShader: 'void main() {\n#include <lights_fragment_end>\n}' };
  m.onBeforeCompile(shader as never, null as never);
  return shader;
};

describe('cabin light', () => {
  test('adds a warm indirect term to interior materials only, without a point light', () => {
    const shader = compile(withCabinLight(new MeshStandardMaterial()));
    expect(shader.uniforms.uCabinLight.value).toBe(CABIN_LIGHT.value);
    expect(shader.fragmentShader).toMatch(/^uniform vec3 uCabinLight;/);
    expect(shader.fragmentShader.indexOf('irradiance += uCabinLight')).toBeLessThan(shader.fragmentShader.indexOf('#include <lights_fragment_end>'));
    expect(new MeshStandardMaterial().customProgramCacheKey()).not.toMatch(/cabin-light/);
  });

  test('scales the sky environment itself (envMapIntensity is overridden by scene.environmentIntensity)', () => {
    const shader = compile(withCabinLight(new MeshStandardMaterial()));
    expect(shader.uniforms.uInteriorEnv).toBe(INTERIOR_ENV);
    expect(shader.fragmentShader).toContain('iblIrradiance *= uInteriorEnv');
    expect(shader.fragmentShader).toMatch(/\bradiance \*= uInteriorEnv/);
  });

  test('parts that receive no sun shadow take no direct sun either', () => {
    const shaded = withCabinLight(new MeshLambertMaterial(), { sun: false });
    expect(compile(shaded).fragmentShader).toContain('reflectedLight.directDiffuse = vec3( 0.0 )');
    expect(compile(withCabinLight(new MeshStandardMaterial())).fragmentShader).not.toContain('reflectedLight.directDiffuse = vec3( 0.0 )');
    expect(shaded.customProgramCacheKey()).not.toBe(withCabinLight(new MeshLambertMaterial()).customProgramCacheKey());
  });
});
