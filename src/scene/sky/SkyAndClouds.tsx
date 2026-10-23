'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { cloudScale } from '@/experience/cloudDetail';
import { experienceStore } from '@/experience/store';
import { worldMode } from '@/experience/worldState';
import { bakeNoise3D } from './noise3d';
import { BLUR_FRAGMENT, CLOUD_FRAGMENT, ENV_FRAGMENT, ENV_VERTEX, FULLSCREEN_VERTEX } from './shaders';

/** The moon: 32° up, behind-left of the hero camera, ahead of the nose — it lights the side the visitor sees. */
export const MOON_DIRECTION = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(58), THREE.MathUtils.degToRad(85));
/** The site's own background: the plane is shown like a product on it until the camera is aboard. */
export const SHOWCASE_BACKGROUND = new THREE.Color('#07080b');

/** Clouds are raymarched at a fraction of the drawing buffer (see cloudScale), then blurred. */
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
    uMoon: { value: MOON_DIRECTION },
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
        new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { uMoon: { value: MOON_DIRECTION } }, vertexShader: ENV_VERTEX, fragmentShader: ENV_FRAGMENT }),
      ),
    );
    const pmrem = new THREE.PMREMGenerator(gl);
    const envTarget = pmrem.fromScene(env, 0);
    pmrem.dispose();
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.9;
    return () => {
      scene.background = null;
      scene.environment = null;
      envTarget.dispose();
    };
  }, [gl, scene, pipe]);

  // The cloud targets follow the canvas size and the current cloudScale; resized only when either changes.
  const sized = useRef('');

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
    const s = experienceStore.getState();
    // showcase: the plain dark of the site and no cloud pass at all
    if (worldMode(s.phase, s.progress) === 'showcase') {
      scene.background = SHOWCASE_BACKGROUND;
      return;
    }
    scene.background = pipe.out.texture;
    const scale = cloudScale(s.phase, s.progress);
    const w = Math.max(2, Math.round(size.width * dpr * scale));
    const h = Math.max(2, Math.round(size.height * dpr * scale));
    if (sized.current !== `${w}x${h}`) {
      sized.current = `${w}x${h}`;
      pipe.raw.setSize(w, h);
      pipe.tmp.setSize(w, h);
      pipe.out.setSize(w, h);
    }
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
      color="#b9c7ff"
      intensity={1.2}
      position={MOON_DIRECTION.clone().multiplyScalar(80).toArray()}
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
