'use client';

import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { copy } from '@/content/copy';
import { boardingPassFor, type BoardingPassData } from '@/experience/boardingPass';
import { chapterAt } from '@/experience/chapters';
import { destination } from '@/experience/destinations';
import { experienceStore, useExperience } from '@/experience/store';

const CARD = { w: 0.5, h: 0.24, radius: 0.02, distance: 0.8 };
const TEX = { w: 1000, h: 480 };
const INK = '#1b2541';
const ACCENT = '#d4683a';
const PAPER = '#f4f1ea';
const MUTED = '#7a7f8c';
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function cardGeometry(): THREE.ShapeGeometry {
  const g = new THREE.ShapeGeometry(roundedRect(CARD.w, CARD.h, CARD.radius), 8);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / CARD.w + 0.5, pos.getY(i) / CARD.h + 0.5);
  return g;
}

function field(ctx: CanvasRenderingContext2D, label: string, value: string, x: number, y: number, size = 40) {
  ctx.fillStyle = MUTED;
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText(label.toUpperCase(), x, y);
  ctx.fillStyle = INK;
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.fillText(value, x, y + size + 8);
}

function drawFront(ctx: CanvasRenderingContext2D, d: BoardingPassData) {
  const t = copy.boardingPass;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, TEX.w, TEX.h);
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, TEX.w, 92);
  ctx.fillStyle = '#fff';
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText(d.airline, 40, 62);
  ctx.font = `600 22px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(t.heading.toUpperCase(), TEX.w - 40, 58);
  ctx.textAlign = 'left';

  ctx.fillStyle = INK;
  ctx.font = `700 96px ${FONT}`;
  ctx.fillText(d.from.code, 40, 222);
  ctx.fillText(d.to.code, 420, 222);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(250, 186);
  ctx.lineTo(395, 186);
  ctx.stroke();
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.arc(395, 186, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = MUTED;
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText(d.from.city, 44, 260);
  ctx.fillText(d.to.city, 424, 260);

  field(ctx, t.passenger, d.passenger, 40, 330);
  field(ctx, t.flight, d.flight, 260, 330);
  field(ctx, t.date, d.date, 500, 330);

  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = '#c9c4b8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(720, 110);
  ctx.lineTo(720, TEX.h - 20);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = MUTED;
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText(t.seat.toUpperCase(), 760, 150);
  ctx.fillStyle = ACCENT;
  ctx.font = `800 104px ${FONT}`;
  ctx.fillText(d.seat, 756, 250);
  field(ctx, t.gate, d.gate, 760, 300, 32);
  field(ctx, t.zone, String(d.zone), 880, 300, 32);
  field(ctx, t.boarding, d.boarding, 760, 390, 32);
}

function drawBack(ctx: CanvasRenderingContext2D, d: BoardingPassData) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, TEX.w, TEX.h);
  const unit = 5;
  const total = d.barcode.reduce((s, w) => s + w * unit * 2, 0);
  let x = (TEX.w - total) / 2;
  ctx.fillStyle = INK;
  for (const w of d.barcode) {
    ctx.fillRect(x, 120, w * unit, 190);
    x += w * unit * 2;
  }
  ctx.textAlign = 'center';
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText(`${d.flight} · ${d.seat} · ${d.from.code}–${d.to.code}`, TEX.w / 2, 370);
  ctx.fillStyle = MUTED;
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(copy.boardingPass.backNote, TEX.w / 2, 420);
  ctx.textAlign = 'left';
}

function cardTexture(draw: (ctx: CanvasRenderingContext2D, d: BoardingPassData) => void, d: BoardingPassData) {
  const canvas = document.createElement('canvas');
  canvas.width = TEX.w;
  canvas.height = TEX.h;
  draw(canvas.getContext('2d')!, d);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** The pass floats in front of the camera during the 'pass' chapter; click turns it over. */
export default function BoardingPass3D() {
  const seat = useExperience((s) => s.seats.find((x) => x.id === s.selectedSeatId));
  const camera = useThree((s) => s.camera);
  const holder = useRef<THREE.Group>(null);
  const flipper = useRef<THREE.Group>(null);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const geometry = useMemo(cardGeometry, []);
  const destinationId = useExperience((s) => s.destinationId);
  const transferId = useExperience((s) => s.transferId);
  const data = useMemo(
    () => (seat ? boardingPassFor(seat, destination(destinationId)!, transferId) : null),
    [seat, destinationId, transferId],
  );
  const textures = useMemo(() => (data ? { front: cardTexture(drawFront, data), back: cardTexture(drawBack, data) } : null), [data]);

  useEffect(
    () => () => {
      textures?.front.dispose();
      textures?.back.dispose();
    },
    [textures],
  );

  // After the camera rig (-2), before the cloud pass (-1).
  useFrame(() => {
    const h = holder.current;
    if (!h) return;
    const s = experienceStore.getState();
    h.visible = s.phase === 'confirmed' && chapterAt('post', s.progress).id === 'pass';
    if (!h.visible) return;
    offset.set(0.06, -0.04, -CARD.distance).applyQuaternion(camera.quaternion);
    h.position.copy(camera.position).add(offset);
    h.quaternion.copy(camera.quaternion);
  }, -1.5);

  if (!textures) return null;

  const flip = () => {
    if (flipper.current) gsap.to(flipper.current.rotation, { y: flipper.current.rotation.y + Math.PI, duration: 0.6, ease: 'power2.inOut' });
  };

  return (
    <group ref={holder} visible={false}>
      <group ref={flipper} onClick={(e) => { e.stopPropagation(); flip(); }}>
        <mesh geometry={geometry} renderOrder={999}>
          <meshBasicMaterial map={textures.front} depthTest={false} transparent toneMapped={false} />
        </mesh>
        <mesh geometry={geometry} rotation-y={Math.PI} renderOrder={999}>
          <meshBasicMaterial map={textures.back} depthTest={false} transparent toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
