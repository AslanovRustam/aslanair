'use client';

import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { copy } from '@/content/copy';
import { boardingPassFor, type BoardingPassData } from '@/experience/boardingPass';
import { chapterAt } from '@/experience/chapters';
import { destination } from '@/experience/destinations';
import { dragAngle, flipAfterDrag, isTap, passEntrance } from '@/experience/passMotion';
import { experienceStore, useExperience } from '@/experience/store';

/** The card (m), how far before the eye it floats, and at most this share of the frame's width it takes. */
const CARD = { w: 0.5, h: 0.24, radius: 0.02, distance: 0.8, fill: 0.9 };
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
  field(ctx, t.transfer, d.transfer.pickup ? `${d.transfer.label} · ${d.transfer.pickup}` : d.transfer.label, 40, 410, 32);
  field(ctx, t.departs, d.departs, 500, 410, 32);
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

/** Draws a side of the pass; the words it wrote go along in the texture's userData.lines (what the pass says). */
function cardTexture(draw: (ctx: CanvasRenderingContext2D, d: BoardingPassData) => void, d: BoardingPassData) {
  const canvas = document.createElement('canvas');
  canvas.width = TEX.w;
  canvas.height = TEX.h;
  const ctx = canvas.getContext('2d')!;
  const lines: string[] = [];
  const write = ctx.fillText.bind(ctx);
  ctx.fillText = (text, x, y, maxWidth) => {
    lines.push(text);
    write(text, x, y, maxWidth);
  };
  draw(ctx, d);
  const tex = new THREE.CanvasTexture(canvas);
  tex.userData.lines = lines;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
/** R3F hands its events a target that captures the pointer for the object (its types say only EventTarget). */
type Capture = { setPointerCapture(id: number): void; releasePointerCapture(id: number): void };

/** The pass floats in front of the camera during the 'pass' chapter; click turns it over. */
export default function BoardingPass3D() {
  const seat = useExperience((s) => s.seats.find((x) => x.id === s.selectedSeatId));
  const camera = useThree((s) => s.camera);
  const holder = useRef<THREE.Group>(null);
  const flipper = useRef<THREE.Group>(null);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const tilt = useMemo(() => new THREE.Quaternion(), []);
  const faces = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  /** The face the pass rests on (a multiple of π), and a drag in progress. */
  const face = useRef(0);
  const drag = useRef<{ pointer: number; x: number; from: number; moved: number; at: number; angle: number; speed: number } | null>(null);
  const size = useThree((s) => s.size);
  const geometry = useMemo(() => cardGeometry(), []);
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
    // it comes in once the seat has locked: rising from below and turning up into place (passMotion)
    const e = s.confirmedAt === null ? passEntrance(Infinity, false) : passEntrance(performance.now() - s.confirmedAt, s.reducedMotion);
    // a narrow (portrait) frame holds the card at arm's length so all of it shows, centred
    const cam = camera as THREE.PerspectiveCamera;
    const across = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * cam.aspect;
    const distance = Math.max(CARD.distance, CARD.w / (CARD.fill * across));
    offset.set(cam.aspect < 1 ? 0 : 0.06, -0.04 + e.offsetY, -distance).applyQuaternion(camera.quaternion);
    h.position.copy(camera.position).add(offset);
    h.quaternion.copy(camera.quaternion).multiply(tilt.setFromAxisAngle(X_AXIS, e.tilt));
    for (const face of faces.current) if (face) face.opacity = e.opacity;
  }, -1.5);

  if (!textures) return null;

  /** Turns the pass to `to` (a face); a new face is a flip (the paper's rustle counts them). */
  const settle = (to: number) => {
    if (!flipper.current) return;
    gsap.to(flipper.current.rotation, { y: to, duration: 0.6, ease: 'power2.inOut', overwrite: true });
    if (to !== face.current) experienceStore.getState().flipPass();
    face.current = to;
  };

  /** The card's width on screen (px): half a turn per width dragged. */
  const widthPx = () => (CARD.w * size.height) / (2 * CARD.distance * Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov) / 2));

  // the hand turns it (spec §4.4, §4.8): a drag follows the pointer and settles on the nearer face, a flick turns it
  // on, a tap turns it over; the page underneath stays put (the canvas lets horizontal touch through: pan-y)
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const f = flipper.current;
    if (!f) return;
    gsap.killTweensOf(f.rotation);
    (e.target as unknown as Capture).setPointerCapture(e.pointerId);
    drag.current = { pointer: e.pointerId, x: e.clientX, from: f.rotation.y, moved: 0, at: performance.now(), angle: f.rotation.y, speed: 0 };
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    const f = flipper.current;
    if (!d || !f || e.pointerId !== d.pointer) return;
    e.stopPropagation();
    const dx = e.clientX - d.x;
    d.moved = Math.max(d.moved, Math.abs(dx));
    if (isTap(d.moved)) return;
    const angle = dragAngle(d.from, dx, widthPx());
    const now = performance.now();
    // rad/s, eased so one jittery event does not read as a flick
    if (now > d.at) d.speed = 0.6 * d.speed + (0.4 * (angle - d.angle) * 1000) / (now - d.at);
    d.at = now;
    d.angle = angle;
    f.rotation.y = angle;
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointer) return;
    e.stopPropagation();
    (e.target as unknown as Capture).releasePointerCapture(e.pointerId);
    drag.current = null;
    settle(isTap(d.moved) ? face.current + Math.PI : flipAfterDrag(face.current, d.angle, d.speed));
  };

  return (
    <group ref={holder} name="BoardingPass" visible={false}>
      <group ref={flipper} name="BoardingPassFlipper" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <mesh name="BoardingPassFront" geometry={geometry} renderOrder={999}>
          <meshBasicMaterial ref={(m) => void (faces.current[0] = m)} map={textures.front} depthTest={false} transparent toneMapped={false} />
        </mesh>
        <mesh geometry={geometry} rotation-y={Math.PI} renderOrder={999}>
          <meshBasicMaterial ref={(m) => void (faces.current[1] = m)} map={textures.back} depthTest={false} transparent toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
