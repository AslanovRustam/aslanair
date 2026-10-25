'use client';

import { useGLTF } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, FileLoader, MeshLambertMaterial, Vector2, type Mesh, type MeshStandardMaterial } from 'three';
import { BEZEL, bezelGeometryData, bezelOpening } from '@/experience/windowBezel';
import { META_URL, MODEL_URL } from '../aircraft/Aircraft';
import { withCabinLight } from './cabinLight';


const VERTEX_DECL = /* glsl */ `attribute vec2 aBezel;\nattribute vec2 aBezelOuter;\nvarying vec2 vBezel;\nvarying vec2 vBezelOuter;`;
const FRAGMENT_DECL = /* glsl */ `
uniform vec2 uBezelHalf;
uniform float uBezelRadius;
uniform float uBezelFeather;
varying vec2 vBezel;
varying vec2 vBezelOuter;`;
/**
 * The opening: the rounded rectangle's signed distance (negative inside), its edge anti-aliased into coverage
 * (alpha-to-coverage, no sorting); a soft lip of shade round it; the panel's outer edge fading into the wall.
 */
const FRAGMENT_BODY = /* glsl */ `
vec2 bezelQ = abs(vBezel) - (uBezelHalf - uBezelRadius);
float bezelD = length(max(bezelQ, 0.0)) + min(max(bezelQ.x, bezelQ.y), 0.0) - uBezelRadius;
float bezelAa = fwidth(bezelD);
float bezelEdge = min(vBezelOuter.x - abs(vBezel.x), vBezelOuter.y - abs(vBezel.y));
diffuseColor.a *= smoothstep(-bezelAa, bezelAa, bezelD) * smoothstep(0.0, uBezelFeather, bezelEdge);
diffuseColor.rgb *= 1.0 - 0.18 * exp(-max(bezelD, 0.0) / 0.015);`;

/**
 * The cabin wall's colour in the furnishing's cheap matte (Lambert, the cabin's own light only, no shadow pass — the
 * full wall material over this much of the screen cost the seat view 2 ms on the integrated GPU), with the bezel's
 * opening cut by its shader.
 */
function bezelMaterial(wall: MeshStandardMaterial): MeshLambertMaterial {
  const m = withCabinLight(new MeshLambertMaterial({ color: wall.color }), { sun: false });
  const { halfW, halfH, radius } = bezelOpening();
  const lit = m.onBeforeCompile;
  const key = m.customProgramCacheKey.bind(m);
  m.alphaToCoverage = true;
  m.onBeforeCompile = (shader, renderer) => {
    lit.call(m, shader, renderer);
    shader.uniforms.uBezelHalf = { value: new Vector2(halfW, halfH) };
    shader.uniforms.uBezelRadius = { value: radius };
    shader.uniforms.uBezelFeather = { value: BEZEL.feather };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_DECL}`)
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvBezel = aBezel;\nvBezelOuter = aBezelOuter;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_DECL}`)
      .replace('#include <alphamap_fragment>', `#include <alphamap_fragment>\n${FRAGMENT_BODY}`);
  };
  m.customProgramCacheKey = () => `${key()}|bezel`;
  return m;
}

/**
 * A bezel round every cabin window (spec r4 §9.4, windowBezel.ts): one mesh laid on the liner from the airliner's
 * meta, in the wall's own material, its opening a smooth rounded rectangle — the window reads round from the seat.
 */
export default function WindowBezels() {
  const meta = useLoader(FileLoader, META_URL) as string;
  const { scene } = useGLTF(MODEL_URL);
  const geometry = useMemo(() => {
    const data = bezelGeometryData(JSON.parse(meta));
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(data.positions, 3));
    g.setAttribute('aBezel', new BufferAttribute(data.uvs, 2));
    g.setAttribute('aBezelOuter', new BufferAttribute(data.outer, 2));
    g.setIndex(new BufferAttribute(data.indices, 1));
    g.computeVertexNormals();
    return g;
  }, [meta]);
  const material = useMemo(() => bezelMaterial((scene.getObjectByName('CabinShell') as Mesh).material as MeshStandardMaterial), [scene]);

  // drawn before the cabin shell: the wall under a bezel then fails the depth test instead of being shaded twice
  return <mesh name="WindowBezels" geometry={geometry} material={material} renderOrder={-1} />;
}
