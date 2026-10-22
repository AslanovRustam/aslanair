import { MeshStandardMaterial } from 'three';
import { describe, expect, test } from 'vitest';
import { CABIN_LIGHT, withCabinLight } from '@/scene/cabin/cabinLight';

describe('cabin light', () => {
  test('adds a warm indirect term to interior materials only, without a point light', () => {
    const m = withCabinLight(new MeshStandardMaterial());
    const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: '', fragmentShader: 'void main() {\n#include <lights_fragment_end>\n}' };
    m.onBeforeCompile(shader as never, null as never);
    expect(shader.uniforms.uCabinLight.value).toBe(CABIN_LIGHT.value);
    expect(shader.fragmentShader).toMatch(/^uniform vec3 uCabinLight;/);
    expect(shader.fragmentShader.indexOf('irradiance += uCabinLight')).toBeLessThan(shader.fragmentShader.indexOf('#include <lights_fragment_end>'));
    expect(m.customProgramCacheKey()).toBe('cabin-light');
    expect(new MeshStandardMaterial().customProgramCacheKey()).not.toBe('cabin-light');
  });
});
