// Cabin materials shared by the kit parts (the kit GLB carries geometry only).
import {
  DataTexture,
  DoubleSide,
  LinearMipmapLinearFilter,
  MeshLambertMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
} from 'three';
import { INTERIOR_ENV } from '@/experience/cabinLayout';
import { withCabinLight } from './cabinLight';
import { weaveNormals } from './fabric';

export interface CabinMaterials {
  // seats fill half the aisle view: matte Lambert costs a fraction of PBR on integrated GPUs
  fabric: MeshLambertMaterial;
  shell: MeshLambertMaterial;
  cover: MeshLambertMaterial;
  arm: MeshLambertMaterial;
  legs: MeshLambertMaterial;
  curtain: MeshStandardMaterial;
  panels: MeshStandardMaterial;
  steel: MeshStandardMaterial;
  worktop: MeshStandardMaterial;
}

let shared: CabinMaterials | null = null;

function weaveTexture(): DataTexture {
  const size = 256;
  const tex = new DataTexture(weaveNormals(size, 16), size, size);
  tex.colorSpace = NoColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(6, 6); // kit UVs are in metres: one weave period ≈ 1 cm
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** One set for the whole cabin; instance colours carry per-seat state. */
export function cabinMaterials(): CabinMaterials {
  if (!shared) {
    const weave = weaveTexture();
    shared = {
      fabric: new MeshLambertMaterial({ color: '#3d4658', normalMap: weave }),
      shell: new MeshLambertMaterial({ color: '#e9e6df' }),
      cover: new MeshLambertMaterial({ color: '#ffffff', normalMap: weave, side: DoubleSide }),
      arm: new MeshLambertMaterial({ color: '#5b6070' }),
      legs: new MeshLambertMaterial({ color: '#9aa0a8' }),
      curtain: new MeshStandardMaterial({ color: '#1b2541', roughness: 0.95, normalMap: weave, side: DoubleSide }),
      panels: new MeshStandardMaterial({ color: '#e9e6df', roughness: 0.55 }),
      steel: new MeshStandardMaterial({ color: '#c9ced4', roughness: 0.3, metalness: 0.85 }),
      worktop: new MeshStandardMaterial({ color: '#2f343c', roughness: 0.4 }),
    };
    for (const m of Object.values(shared)) {
      if (m instanceof MeshStandardMaterial) m.envMapIntensity = INTERIOR_ENV;
      withCabinLight(m);
    }
  }
  return shared;
}
