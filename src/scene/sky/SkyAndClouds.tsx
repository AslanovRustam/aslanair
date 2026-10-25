'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SKY_IMAGES } from '@/experience/clouds';
import { CURTAIN_LAYER } from '@/experience/curtain';
import { TIER } from '@/experience/quality';
import { experienceStore, useExperience } from '@/experience/store';
import { nightSkyDrawn, worldMode } from '@/experience/worldState';
import CloudPuffs from './CloudPuffs';
import CloudSea from './CloudSea';
import { BACKDROP_FRAGMENT, BACKDROP_VERTEX, ENV_FRAGMENT, ENV_VERTEX } from './shaders';
import { loadSkyTexture, standIn, swapTexture } from './skyTexture';

/** The moon: 32° up, behind-left of the hero camera, ahead of the nose — it lights the side the visitor sees. */
export const MOON_DIRECTION = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(58), THREE.MathUtils.degToRad(85));
/** The moon by mode: in the showcase it is the key light of a product shot and an ambient fill lifts the shadow side
 * (ambient adds no per-light shader work, unlike another directional light); aboard it is a plain night moon and the
 * fill is off, so nothing lights the cabin through the hull. Same lights in both modes: no shader ever recompiles. */
const MOONLIGHT = {
  showcase: { intensity: 2.6, fill: 0.55 },
  night: { intensity: 1.2, fill: 0 },
  color: '#b9c7ff',
  fillColor: '#8ea2cc',
};

/** How bright the Milky Way panorama is added over the night gradient. */
const STAR_EXPOSURE = 0.3;

/**
 * World direction → the panorama's galactic frame: the galactic centre `CORE_AT` (ahead, up and out to starboard,
 * where the window seats and the way out look), the band through it tilted `BAND_TILT` from the horizon.
 */
const CORE_AT = new THREE.Vector3(0.25, 0.35, 1).normalize();
const BAND_TILT = THREE.MathUtils.degToRad(50);
function galacticFrame(): THREE.Matrix3 {
  const across = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), CORE_AT).normalize();
  const upward = new THREE.Vector3().crossVectors(CORE_AT, across);
  const band = across.multiplyScalar(Math.cos(BAND_TILT)).addScaledVector(upward, Math.sin(BAND_TILT));
  const pole = new THREE.Vector3().crossVectors(band, CORE_AT).normalize();
  const third = new THREE.Vector3().crossVectors(CORE_AT, pole);
  // rows: the frame's axes in world terms, so M · d gives d in the frame
  return new THREE.Matrix3().set(CORE_AT.x, CORE_AT.y, CORE_AT.z, pole.x, pole.y, pole.z, third.x, third.y, third.z);
}

/** The stars sampled up close (the panorama is magnified at every field of view): no mipmaps, so no seam where the
 * longitude wraps. */
function starsTexture(t: THREE.Texture) {
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.wrapS = THREE.RepeatWrapping;
}

/** `background={false}`: no sky behind the scene at all — the capture tool photographs the plane on transparency. */
export default function SkyAndClouds({ background = true }: { background?: boolean }) {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const backdrop = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>>(null);
  const moon = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.AmbientLight>(null);
  // the tier's shadow map size (the frame below lets go of a map of another size)
  const shadowMapSize = useExperience((s) => TIER[s.quality].shadowMapSize);
  const uniforms = useMemo(
    () => ({
      uStars: { value: standIn([0, 0, 0, 255]) as THREE.Texture },
      uStarExposure: { value: STAR_EXPOSURE },
      uGalactic: { value: galacticFrame() },
      uMoon: { value: MOON_DIRECTION },
      uPixel: { value: 0.001 },
      uTime: { value: 0 },
      uCamY: { value: 0 },
      uInvProj: { value: new THREE.Matrix4() },
      uInvView: { value: new THREE.Matrix4() },
    }),
    [],
  );

  useEffect(() => {
    const { scene } = get();
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
  }, [gl, get]);

  useEffect(() => {
    if (!background) return;
    return loadSkyTexture(gl, SKY_IMAGES.stars, starsTexture, (t) => swapTexture(backdrop.current!.material.uniforms.uStars, t));
  }, [gl, background]);

  // the curtain's plane is drawn on its own layer with these lights, so its programs are the aircraft's own
  useEffect(() => {
    moon.current?.layers.enable(CURTAIN_LAYER);
    fill.current?.layers.enable(CURTAIN_LAYER);
  }, []);

  // Negative priority: runs before R3F's own render without taking the render loop over.
  useFrame((state) => {
    const { camera, clock } = state;
    const s = experienceStore.getState();
    // a new tier's shadow map size: the old map goes and the next shadow pass draws one of the new size
    if (moon.current?.shadow.map && moon.current.shadow.map.width !== moon.current.shadow.mapSize.x) {
      moon.current.shadow.map.dispose();
      moon.current.shadow.map = null;
      state.gl.shadowMap.needsUpdate = true;
    }
    const look = worldMode(s.phase, s.progress) === 'showcase' ? MOONLIGHT.showcase : MOONLIGHT.night;
    if (moon.current && fill.current) {
      moon.current.intensity = look.intensity;
      fill.current.intensity = look.fill;
    }
    const sky = backdrop.current;
    if (!sky) return;
    // showcase: the plain dark of the site (the page behind a see-through canvas), the hero's title behind the plane
    sky.visible = background && nightSkyDrawn(s.phase, s.progress, s.ready);
    if (!sky.visible) return;
    camera.updateMatrixWorld();
    const u = sky.material.uniforms;
    u.uTime.value = clock.elapsedTime;
    u.uCamY.value = camera.position.y;
    u.uInvProj.value.copy(camera.projectionMatrixInverse);
    u.uInvView.value.copy(camera.matrixWorld);
    // radians across one drawing-buffer pixel, for stars a pixel wide
    u.uPixel.value = (2 * Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov) / 2)) / (size.height * dpr);
  }, -1);

  return (
    <>
      {/* the night background at full resolution, drawn first behind everything */}
      <mesh ref={backdrop} name="NightBackdrop" frustumCulled={false} renderOrder={-1000} visible={false}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial args={[{ uniforms, vertexShader: BACKDROP_VERTEX, fragmentShader: BACKDROP_FRAGMENT, depthTest: false, depthWrite: false }]} />
      </mesh>
      {background && (
        <>
          <CloudSea moon={MOON_DIRECTION} />
          <CloudPuffs moon={MOON_DIRECTION} />
        </>
      )}
      <ambientLight ref={fill} color={MOONLIGHT.fillColor} intensity={MOONLIGHT.showcase.fill} />
      <directionalLight
        ref={moon}
        color={MOONLIGHT.color}
        intensity={MOONLIGHT.showcase.intensity}
        position={MOON_DIRECTION.clone().multiplyScalar(80).toArray()}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-bias={-0.0003}
        shadow-normalBias={0.04}
      />
    </>
  );
}
