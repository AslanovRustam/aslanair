'use client';

import { useMemo } from 'react';
import { CanvasTexture, MeshBasicMaterial, SRGBColorSpace } from 'three';
import { copy } from '@/content/copy';
import { EXIT_SIGN } from '@/experience/cabinLayout';
import { stationToX } from '@/experience/geometry';
import { cabinMaterials } from './materials';
import { useKitGeometry } from './Seats';

function exitFace(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 140;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f7f7f2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#2fbf71';
  ctx.font = '700 92px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(copy.cabin.exitSign, canvas.width / 2, canvas.height / 2 + 4);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Galley opposite door 1L, the drawn-open curtain, and lit exit signs over the aisle. */
export default function EntryZone() {
  const kit = useKitGeometry();
  const m = cabinMaterials();
  const face = useMemo(() => new MeshBasicMaterial({ map: exitFace() }), []);
  // signs are lettered on both faces, so two placements at one station are one sign
  const stations = [...new Set(EXIT_SIGN.placements.map(([s]) => s))];
  const off = EXIT_SIGN.d / 2 + 0.001;

  return (
    <group>
      <mesh name="GalleyPanels" geometry={kit('GalleyPanels')} material={m.panels} receiveShadow />
      <mesh name="GalleySteel" geometry={kit('GalleySteel')} material={m.steel} receiveShadow />
      <mesh name="GalleyWorktop" geometry={kit('GalleyWorktop')} material={m.worktop} receiveShadow />
      <mesh name="Curtain" geometry={kit('Curtain')} material={m.curtain} receiveShadow />
      {stations.map((s) => (
        <group key={s} position={[stationToX(s), EXIT_SIGN.y, 0]}>
          <mesh name="ExitSign" geometry={kit('ExitSign')} material={m.panels} />
          {[1, -1].map((dir) => (
            <mesh key={dir} position-x={dir * off} rotation-y={(dir * Math.PI) / 2} material={face}>
              <planeGeometry args={[EXIT_SIGN.w - 0.03, EXIT_SIGN.h - 0.03]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
