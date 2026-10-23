import type { Material } from 'three';

/**
 * Adds a per-instance glow to a seat material: the instanced `seatGlow` attribute (linear rgb, already scaled by
 * strength) is emitted as light, so the seat lights up by itself. Composes with whatever onBeforeCompile the
 * material already has (the cabin light). Non-instanced meshes sharing the material get no glow.
 */
export function withSeatGlow<T extends Material>(material: T): T {
  const before = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSeatGlow;\n#ifdef USE_INSTANCING\nattribute vec3 seatGlow;\n#endif')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvSeatGlow = seatGlow;\n#else\nvSeatGlow = vec3(0.0);\n#endif');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSeatGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vSeatGlow;');
  };
  material.customProgramCacheKey = () => `${key()}+seat-glow`;
  return material;
}
