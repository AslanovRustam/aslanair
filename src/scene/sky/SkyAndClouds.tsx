'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { bakeNoise3D } from './noise3d';
import { BLUR_FRAGMENT, CLOUD_FRAGMENT, ENV_FRAGMENT, ENV_VERTEX, FULLSCREEN_VERTEX } from './shaders';

export const SUN_DIRECTION = new THREE.Vector3().setFromSphericalCoords(
  1,
  THREE.MathUtils.degToRad(50),
  THREE.MathUtils.degToRad(160),
);

/** Clouds are raymarched at this fraction of the drawing buffer, then blurred. */
const CLOUD_SCALE = 0.5;
const NOISE_SIZE = 64;

function noiseTexture(): THREE.Data3DTexture {
  const tex = new THREE.Data3DTexture(bakeNoise3D(NOISE_SIZE, 1337), NOISE_SIZE, NOISE_SIZE, NOISE_SIZE);
  tex.format = THREE.RedFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

function fullscreen(material: THREE.ShaderMaterial): THREE.Scene {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  return scene;
}

function createPipeline() {
  const options = { type: THREE.HalfFloatType, depthBuffer: false };
  const raw = new THREE.WebGLRenderTarget(2, 2, options);
  const tmp = new THREE.WebGLRenderTarget(2, 2, options);
  const out = new THREE.WebGLRenderTarget(2, 2, options);
  const uniforms = {
    uNoise: { value: noiseTexture() },
    uCam: { value: new THREE.Vector3() },
    uSun: { value: SUN_DIRECTION },
    uInvProj: { value: new THREE.Matrix4() },
    uInvView: { value: new THREE.Matrix4() },
    uTime: { value: 0 },
  };
  const cloudScene = fullscreen(
    new THREE.ShaderMaterial({ uniforms, vertexShader: FULLSCREEN_VERTEX, fragmentShader: CLOUD_FRAGMENT, depthTest: false, depthWrite: false }),
  );
  const blur = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: null }, uDir: { value: new THREE.Vector2() } },
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: BLUR_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  return { raw, tmp, out, uniforms, cloudScene, blur, blurScene: fullscreen(blur), quadCamera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
}

export default function SkyAndClouds() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const pipe = useMemo(createPipeline, []);

  useEffect(() => {
    const env = new THREE.Scene();
    env.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(100, 64, 32),
        new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { uSun: { value: SUN_DIRECTION } }, vertexShader: ENV_VERTEX, fragmentShader: ENV_FRAGMENT }),
      ),
    );
    const pmrem = new THREE.PMREMGenerator(gl);
    const envTarget = pmrem.fromScene(env, 0);
    pmrem.dispose();
    scene.background = pipe.out.texture;
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.9;
    return () => {
      scene.background = null;
      scene.environment = null;
      envTarget.dispose();
    };
  }, [gl, scene, pipe]);

  useEffect(() => {
    const w = Math.max(2, Math.round(size.width * dpr * CLOUD_SCALE));
    const h = Math.max(2, Math.round(size.height * dpr * CLOUD_SCALE));
    pipe.raw.setSize(w, h);
    pipe.tmp.setSize(w, h);
    pipe.out.setSize(w, h);
  }, [size, dpr, pipe]);

  useEffect(
    () => () => {
      pipe.raw.dispose();
      pipe.tmp.dispose();
      pipe.out.dispose();
      pipe.uniforms.uNoise.value.dispose();
    },
    [pipe],
  );

  // Negative priority: runs before R3F's own render without taking the render loop over.
  useFrame((state) => {
    const { camera, clock } = state;
    camera.updateMatrixWorld();
    const u = pipe.uniforms;
    u.uTime.value = clock.elapsedTime;
    u.uCam.value.copy(camera.position);
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    u.uInvView.value.copy(camera.matrixWorld);

    const previous = gl.getRenderTarget();
    gl.setRenderTarget(pipe.raw);
    gl.render(pipe.cloudScene, pipe.quadCamera);
    pipe.blur.uniforms.uTex.value = pipe.raw.texture;
    pipe.blur.uniforms.uDir.value.set(1 / pipe.raw.width, 0);
    gl.setRenderTarget(pipe.tmp);
    gl.render(pipe.blurScene, pipe.quadCamera);
    pipe.blur.uniforms.uTex.value = pipe.tmp.texture;
    pipe.blur.uniforms.uDir.value.set(0, 1 / pipe.raw.height);
    gl.setRenderTarget(pipe.out);
    gl.render(pipe.blurScene, pipe.quadCamera);
    gl.setRenderTarget(previous);
  }, -1);

  return (
    <directionalLight
      color="#fff4e6"
      intensity={3}
      position={SUN_DIRECTION.clone().multiplyScalar(80).toArray()}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-26}
      shadow-camera-right={26}
      shadow-camera-top={26}
      shadow-camera-bottom={-26}
      shadow-camera-near={1}
      shadow-camera-far={200}
      shadow-bias={-0.0003}
      shadow-normalBias={0.04}
    />
  );
}
