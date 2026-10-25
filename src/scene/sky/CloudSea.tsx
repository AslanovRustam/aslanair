'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { CLOUD_SEA, PUFFS, SKY_IMAGES } from '@/experience/clouds';
import { experienceStore } from '@/experience/store';
import { nightSkyDrawn } from '@/experience/worldState';
import { CLOUD_SEA_FRAGMENT, CLOUD_SEA_VERTEX } from './shaders';
import { loadSkyTexture, standIn, swapTexture } from './skyTexture';

/**
 * The cloud sea (spec r4 §9.3): a disc `CLOUD_SEA.radius` across at `CLOUD_SEA.y`, kept under the camera, its photo
 * fixed to the world and drifting with the wind. Until the photo arrives the deck is an even grey.
 */
export default function CloudSea({ moon }: { moon: THREE.Vector3 }) {
  const gl = useThree((s) => s.gl);
  const sea = useRef<THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial>>(null);
  const geometry = useMemo(() => new THREE.CircleGeometry(CLOUD_SEA.radius, 128).rotateX(-Math.PI / 2), []);
  const uniforms = useMemo(
    () => ({
      uSea: { value: standIn([110, 110, 110, 255]) as THREE.Texture },
      uWind: { value: new THREE.Vector2() },
      uTile: { value: CLOUD_SEA.tile },
      uCam: { value: new THREE.Vector3() },
      uMoon: { value: moon },
    }),
    [moon],
  );

  useEffect(
    () =>
      loadSkyTexture(
        gl,
        SKY_IMAGES.cloudSea,
        (t) => {
          t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
          t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
        },
        (t) => swapTexture(sea.current!.material.uniforms.uSea, t),
      ),
    [gl],
  );

  useFrame(({ camera, clock }) => {
    const mesh = sea.current;
    if (!mesh) return;
    const s = experienceStore.getState();
    mesh.visible = nightSkyDrawn(s.phase, s.progress, s.ready);
    if (!mesh.visible) return;
    mesh.position.set(camera.position.x, CLOUD_SEA.y, camera.position.z);
    const u = mesh.material.uniforms;
    u.uCam.value.copy(camera.position);
    // how far the wind has carried the deck (metres; turned samplings cannot wrap it, and even after hours a float
    // keeps it to a fraction of a texel)
    const [wx, , wz] = PUFFS.wind;
    const t = clock.elapsedTime;
    u.uWind.value.set(wx * t, wz * t);
  });

  return (
    <mesh ref={sea} name="CloudSea" geometry={geometry} frustumCulled={false} visible={false}>
      <shaderMaterial args={[{ uniforms, vertexShader: CLOUD_SEA_VERTEX, fragmentShader: CLOUD_SEA_FRAGMENT }]} />
    </mesh>
  );
}
