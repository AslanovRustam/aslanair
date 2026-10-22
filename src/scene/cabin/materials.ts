// Cabin materials shared by the kit parts (the kit GLB carries geometry only).
import { DataTexture, DoubleSide, LinearMipmapLinearFilter, MeshStandardMaterial, NoColorSpace, RepeatWrapping } from 'three';
import { INTERIOR_ENV } from '@/experience/cabinLayout';
import { withCabinLight } from './cabinLight';
import { weaveNormals } from './fabric';

export interface CabinMaterials {
  fabric: MeshStandardMaterial;
  shell: MeshStandardMaterial;
  cover: MeshStandardMaterial;
  arm: MeshStandardMaterial;
  legs: MeshStandardMaterial;
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
      fabric: new MeshStandardMaterial({ color: '#3d4658', roughness: 0.95, normalMap: weave }),
      shell: new MeshStandardMaterial({ color: '#e9e6df', roughness: 0.55 }),
      cover: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, normalMap: weave, side: DoubleSide }),
      arm: new MeshStandardMaterial({ color: '#5b6070', roughness: 0.45 }),
      legs: new MeshStandardMaterial({ color: '#9aa0a8', roughness: 0.35, metalness: 0.8 }),
      curtain: new MeshStandardMaterial({ color: '#1b2541', roughness: 0.95, normalMap: weave, side: DoubleSide }),
      panels: new MeshStandardMaterial({ color: '#e9e6df', roughness: 0.55 }),
      steel: new MeshStandardMaterial({ color: '#c9ced4', roughness: 0.3, metalness: 0.85 }),
      worktop: new MeshStandardMaterial({ color: '#2f343c', roughness: 0.4 }),
    };
    for (const m of Object.values(shared)) {
      m.envMapIntensity = INTERIOR_ENV;
      withCabinLight(m);
    }
  }
  return shared;
}
