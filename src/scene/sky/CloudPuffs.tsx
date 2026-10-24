'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PUFFS, puffLayout, puffTexels, wrapAround, type Puff } from '@/experience/clouds';
import { experienceStore } from '@/experience/store';
import { nightSkyDrawn } from '@/experience/worldState';
import { PUFF_FRAGMENT, PUFF_VERTEX } from './shaders';

/** The puff sprites: an atlas of `ATLAS` × `ATLAS` different blobs, `SPRITE` texels each. */
const ATLAS = 2;
const SPRITE = 128;
/** Seconds between re-sorting the puffs far to near. */
const SORT_EVERY = 1;

function puffAtlas(): THREE.DataTexture {
  const size = ATLAS * SPRITE;
  const data = new Uint8Array(size * size * 4);
  for (let k = 0; k < ATLAS * ATLAS; k++) {
    const sprite = puffTexels(SPRITE, k + 1);
    const [cx, cy] = [k % ATLAS, Math.floor(k / ATLAS)];
    for (let y = 0; y < SPRITE; y++) data.set(sprite.subarray(y * SPRITE * 4, (y + 1) * SPRITE * 4), ((cy * SPRITE + y) * size + cx * SPRITE) * 4);
  }
  const t = new THREE.DataTexture(data, size, size);
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

function puffGeometry(puffs: Puff[]): THREE.InstancedBufferGeometry {
  const quad = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = quad.index;
  g.setAttribute('position', quad.getAttribute('position'));
  g.setAttribute('uv', quad.getAttribute('uv'));
  g.setAttribute('aCentre', new THREE.InstancedBufferAttribute(new Float32Array(puffs.length * 3), 3));
  g.setAttribute('aCluster', new THREE.InstancedBufferAttribute(new Float32Array(puffs.length * 3), 3));
  g.setAttribute('aSize', new THREE.InstancedBufferAttribute(new Float32Array(puffs.length), 1));
  g.setAttribute('aVariant', new THREE.InstancedBufferAttribute(new Float32Array(puffs.length), 1));
  g.instanceCount = puffs.length;
  return g;
}

/** Writes the puffs into the geometry's instance attributes in the given order. */
function writePuffs(g: THREE.InstancedBufferGeometry, puffs: Puff[], order: number[]) {
  const [centre, cluster, size, variant] = ['aCentre', 'aCluster', 'aSize', 'aVariant'].map((n) => g.getAttribute(n) as THREE.InstancedBufferAttribute);
  order.forEach((i, k) => {
    const p = puffs[i];
    centre.setXYZ(k, ...p.centre);
    cluster.setXYZ(k, ...p.cluster);
    size.setX(k, p.size);
    variant.setX(k, i % (ATLAS * ATLAS));
  });
  for (const a of [centre, cluster, size, variant]) a.needsUpdate = true;
}

/**
 * The sprite clouds (spec r4 §9.3): `PUFFS.count` moonlit puffs in clusters between the cloud sea and the plane, one
 * instanced draw of camera-facing quads. The wind carries them and their field wraps round the camera on the GPU;
 * here they are only re-sorted far to near once a second, for their blending.
 */
export default function CloudPuffs({ moon }: { moon: THREE.Vector3 }) {
  const puffs = useMemo(() => puffLayout(7), []);
  const geometry = useMemo(() => {
    const g = puffGeometry(puffs);
    writePuffs(g, puffs, puffs.map((_, i) => i));
    return g;
  }, [puffs]);
  const uniforms = useMemo(
    () => ({
      uPuff: { value: puffAtlas() },
      uDrift: { value: new THREE.Vector3() },
      uBox: { value: PUFFS.box },
      uCam: { value: new THREE.Vector3() },
      uMoon: { value: moon },
    }),
    [moon],
  );
  const field = useRef<THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>>(null);
  const sorted = useRef(-Infinity);

  useFrame(({ camera, clock }) => {
    const mesh = field.current;
    if (!mesh) return;
    const s = experienceStore.getState();
    mesh.visible = nightSkyDrawn(s.phase, s.progress, s.ready);
    if (!mesh.visible) return;
    const t = clock.elapsedTime;
    const [wx, wy, wz] = PUFFS.wind;
    const { box } = PUFFS;
    const u = mesh.material.uniforms;
    // the wind's offset, wrapped by the field (the shader wraps again round the camera)
    u.uDrift.value.set(wrapAround(wx * t, 0, box), wy * t, wrapAround(wz * t, 0, box));
    u.uCam.value.copy(camera.position);
    if (t - sorted.current < SORT_EVERY) return;
    sorted.current = t;
    const drift = u.uDrift.value as THREE.Vector3;
    const at = puffs.map((p) => {
      const cx = p.cluster[0] + drift.x;
      const cz = p.cluster[2] + drift.z;
      const x = p.centre[0] + drift.x + wrapAround(cx, camera.position.x, box) - cx;
      const z = p.centre[2] + drift.z + wrapAround(cz, camera.position.z, box) - cz;
      return (x - camera.position.x) ** 2 + (p.centre[1] - camera.position.y) ** 2 + (z - camera.position.z) ** 2;
    });
    writePuffs(
      mesh.geometry,
      puffs,
      puffs.map((_, i) => i).sort((a, b) => at[b] - at[a]),
    );
  });

  return (
    <mesh ref={field} name="CloudPuffs" geometry={geometry} frustumCulled={false} renderOrder={-10} visible={false}>
      <shaderMaterial args={[{ uniforms, vertexShader: PUFF_VERTEX, fragmentShader: PUFF_FRAGMENT, transparent: true, depthWrite: false }]} />
    </mesh>
  );
}
