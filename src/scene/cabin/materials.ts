// Cabin materials shared by the kit parts (the kit GLB carries geometry only).
import {
  DataTexture,
  DoubleSide,
  LinearMipmapLinearFilter,
  MeshLambertMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { withCabinLight } from './cabinLight';
import { weaveNormals } from './fabric';
import { fabricPrint } from './fabricPrint';

export interface CabinMaterials {
  // seats fill half the aisle view: matte Lambert costs a fraction of PBR on integrated GPUs
  fabric: MeshLambertMaterial;
  shell: MeshLambertMaterial;
  cover: MeshLambertMaterial;
  arm: MeshLambertMaterial;
  legs: MeshLambertMaterial;
  belt: MeshLambertMaterial;
  buckle: MeshStandardMaterial;
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

function printTexture(): DataTexture {
  const size = 256;
  const tex = new DataTexture(fabricPrint(size, 7), size, size);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(4, 4); // one tile is 25 cm of upholstery: flecks about a centimetre apart
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
      // white base: the print carries the colour and instance colours dim occupied seats
      fabric: new MeshLambertMaterial({ color: '#ffffff', map: printTexture(), normalMap: weave }),
      shell: new MeshLambertMaterial({ color: '#e9e6df' }),
      cover: new MeshLambertMaterial({ color: '#ffffff', normalMap: weave, side: DoubleSide }),
      arm: new MeshLambertMaterial({ color: '#d9d8d3' }),
      legs: new MeshLambertMaterial({ color: '#9aa0a8' }),
      belt: new MeshLambertMaterial({ color: '#9a2f35' }),
      buckle: new MeshStandardMaterial({ color: '#c8ccd2', roughness: 0.25, metalness: 1 }),
      curtain: new MeshStandardMaterial({ color: '#1b2541', roughness: 0.95, normalMap: weave, side: DoubleSide }),
      panels: new MeshStandardMaterial({ color: '#e9e6df', roughness: 0.55 }),
      steel: new MeshStandardMaterial({ color: '#c9ced4', roughness: 0.3, metalness: 0.85 }),
      worktop: new MeshStandardMaterial({ color: '#2f343c', roughness: 0.4 }),
    };
    // furnishing receives no sun shadow, so it takes no direct sun either
    for (const m of Object.values(shared)) withCabinLight(m, { sun: false });
  }
  return shared;
}
