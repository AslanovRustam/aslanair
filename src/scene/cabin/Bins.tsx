'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  type InstancedMesh,
} from 'three';
import { copy } from '@/content/copy';
import { binMatrices, CEILING_STRIPS } from '@/experience/cabinLayout';
import { ROWS } from '@/experience/geometry';
import { withCabinLight } from './cabinLight';
import { ATLAS, labelCell, rowLabelQuads } from './rowLabels';
import { useKitGeometry } from './Seats';

const CELL_W = ATLAS.width / ATLAS.cols;
const CELL_H = ATLAS.height / ATLAS.rows;
const LIT = '#ffe9b8';

/** Fasten-seatbelt pictogram: two belt halves meeting at a buckle. */
function seatbelt(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = LIT;
  ctx.fillStyle = LIT;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 18, y - 8);
  ctx.quadraticCurveTo(x - 10, y + 10, x - 4, y + 2);
  ctx.moveTo(x + 18, y - 8);
  ctx.quadraticCurveTo(x + 10, y + 10, x + 4, y + 2);
  ctx.stroke();
  ctx.fillRect(x - 6, y - 2, 12, 9);
}

/** No-smoking pictogram: a cigarette under a slashed circle. */
function noSmoking(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = LIT;
  ctx.fillStyle = LIT;
  ctx.lineWidth = 3;
  ctx.fillRect(x - 12, y - 2, 20, 5);
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.moveTo(x - 10, y - 11);
  ctx.lineTo(x + 10, y + 11);
  ctx.stroke();
}

function labelAtlas(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS.width;
  canvas.height = ATLAS.height;
  const ctx = canvas.getContext('2d')!;
  for (let row = 1; row <= ROWS; row++) {
    for (const side of [-1, 1] as const) {
      const cell = labelCell(row, side);
      const x = (cell % ATLAS.cols) * CELL_W;
      const y = Math.floor(cell / ATLAS.cols) * CELL_H;
      ctx.fillStyle = '#1f2633';
      ctx.fillRect(x + 2, y + 2, CELL_W - 4, CELL_H - 4);
      ctx.fillStyle = '#f4f2ec';
      ctx.font = '600 34px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(copy.cabin.rowLabel(row, side), x + 14, y + CELL_H / 2 + 1);
      seatbelt(ctx, x + CELL_W - 82, y + CELL_H / 2);
      noSmoking(ctx, x + CELL_W - 34, y + CELL_H / 2);
    }
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Overhead bins (one section per row and side), warm ceiling light strips, row labels with lit signs. */
export default function Bins() {
  const kit = useKitGeometry();
  const port = useRef<InstancedMesh>(null);
  const starboard = useRef<InstancedMesh>(null);
  const plastic = useMemo(() => withCabinLight(new MeshStandardMaterial({ color: '#e9e6df', roughness: 0.6 }), { sun: false }), []);
  // cove strips: the navy mood light mixed with warm white
  const strip = useMemo(() => new MeshBasicMaterial({ color: '#adb0c8' }), []);
  const labels = useMemo(() => {
    const q = rowLabelQuads();
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(q.position, 3));
    g.setAttribute('uv', new BufferAttribute(q.uv, 2));
    g.setIndex(new BufferAttribute(q.index, 1));
    return { geometry: g, material: new MeshBasicMaterial({ map: labelAtlas() }) };
  }, []);

  useLayoutEffect(() => {
    const matrices = binMatrices();
    for (const mesh of [port.current!, starboard.current!]) {
      matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, []);

  return (
    <group>
      <instancedMesh ref={port} name="BinPort" args={[kit('BinPort'), plastic, ROWS]} raycast={() => null} />
      <instancedMesh ref={starboard} name="BinStarboard" args={[kit('BinStarboard'), plastic, ROWS]} raycast={() => null} />
      {CEILING_STRIPS.map((s) => (
        <mesh
          key={s.side}
          name="CeilingStrip"
          position={[(s.x0 + s.x1) / 2, s.y, (s.z0 + s.z1) / 2]}
          rotation-x={Math.PI / 2}
          material={strip}
          raycast={() => null}
        >
          <planeGeometry args={[s.x1 - s.x0, Math.abs(s.z1 - s.z0)]} />
        </mesh>
      ))}
      <mesh name="RowLabels" geometry={labels.geometry} material={labels.material} raycast={() => null} />
    </group>
  );
}
