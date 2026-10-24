'use client';

import { useMemo } from 'react';
import { CanvasTexture, MeshBasicMaterial, MeshLambertMaterial, SRGBColorSpace } from 'three';
import { copy } from '@/content/copy';
import { COCKPIT_DOOR, COCKPIT_PLACARD, EXIT_ARROWS, EXIT_SIGN } from '@/experience/cabinLayout';
import { stationToX } from '@/experience/geometry';
import { withCabinLight } from './cabinLight';
import { cabinMaterials } from './materials';
import { useKitGeometry } from './Seats';

function exitFace(text: string, width: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((384 * width) / EXIT_SIGN.w);
  canvas.height = 140;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f7f7f2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#2fbf71';
  ctx.font = '700 92px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** The flight-deck door's placard: FLIGHT DECK over CREW ONLY, warm white on a navy plate (spec r4 §8.2). */
function placardFace(): CanvasTexture {
  const lines = copy.cabin.placard;
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = Math.round((600 * COCKPIT_PLACARD.h) / COCKPIT_PLACARD.w);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#1b2541';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f2efe8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // a wider system font is squeezed to the plate rather than cut off at its edges
  const fit = canvas.width * 0.92;
  ctx.font = '800 92px system-ui, sans-serif';
  ctx.fillText(lines[0], canvas.width / 2, canvas.height * 0.38, fit);
  ctx.font = '600 50px system-ui, sans-serif';
  ctx.fillText(lines[1], canvas.width / 2, canvas.height * 0.78, fit);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  // what the plate says, for the tests (as the boarding pass does)
  if (process.env.NODE_ENV !== 'production') tex.userData.lines = [...lines];
  return tex;
}

/** A lit exit sign over the aisle centreline, lettered on both faces; `width` stretches the kit housing. */
function ExitSign({ station, y, width, face }: { station: number; y: number; width: number; face: MeshBasicMaterial }) {
  const kit = useKitGeometry();
  const m = cabinMaterials();
  const off = EXIT_SIGN.d / 2 + 0.001;
  return (
    <group position={[stationToX(station), y, 0]}>
      <mesh name="ExitSign" geometry={kit('ExitSign')} material={m.panels} scale-z={width / EXIT_SIGN.w} />
      {[1, -1].map((dir) => (
        <mesh key={dir} position-x={dir * off} rotation-y={(dir * Math.PI) / 2} material={face}>
          <planeGeometry args={[width - 0.03, EXIT_SIGN.h - 0.03]} />
        </mesh>
      ))}
    </group>
  );
}

/** Galley opposite door 1L, the drawn-open curtain, the flight-deck door and jump seat on the front bulkhead, and lit
 * exit signs over the aisle (the one at door 1L with arrows). */
export default function EntryZone() {
  const kit = useKitGeometry();
  const m = cabinMaterials();
  const faces = useMemo(
    () => ({
      exit: new MeshBasicMaterial({ map: exitFace(copy.cabin.exitSign, EXIT_SIGN.w) }),
      arrows: new MeshBasicMaterial({ map: exitFace(copy.cabin.exitSignArrows, EXIT_ARROWS.w) }),
      placard: withCabinLight(new MeshLambertMaterial({ map: placardFace() }), { sun: false }),
    }),
    [],
  );
  // signs are lettered on both faces, so two placements at one station are one sign
  const stations = [...new Set(EXIT_SIGN.placements.map(([s]) => s))];

  return (
    <group>
      <mesh name="GalleyPanels" geometry={kit('GalleyPanels')} material={m.panels} />
      <mesh name="GalleySteel" geometry={kit('GalleySteel')} material={m.steel} />
      <mesh name="GalleyLatches" geometry={kit('GalleyLatches')} material={m.latch} />
      <mesh name="GalleyDark" geometry={kit('GalleyDark')} material={m.dark} />
      <mesh name="GalleyWorktop" geometry={kit('GalleyWorktop')} material={m.worktop} />
      <mesh name="Curtain" geometry={kit('Curtain')} material={m.curtain} />
      <mesh name="CockpitDoor" geometry={kit('CockpitDoor')} material={m.panels} />
      <mesh name="CockpitDoorHardware" geometry={kit('CockpitDoorHardware')} material={m.worktop} />
      {/* on the placard's face, which looks aft (−x), inside its dark frame */}
      <mesh
        name="CockpitPlacard"
        position={[stationToX(COCKPIT_DOOR.station) - 0.0305, COCKPIT_PLACARD.y, COCKPIT_DOOR.z]}
        rotation-y={-Math.PI / 2}
        material={faces.placard}
      >
        <planeGeometry args={[COCKPIT_PLACARD.w - 0.01, COCKPIT_PLACARD.h - 0.01]} />
      </mesh>
      <mesh name="JumpSeat" geometry={kit('JumpSeat')} material={m.fabric} />
      <mesh name="JumpSeatFrame" geometry={kit('JumpSeatFrame')} material={m.legs} />
      {stations.map((s) => (
        <ExitSign key={s} station={s} y={EXIT_SIGN.y} width={EXIT_SIGN.w} face={faces.exit} />
      ))}
      <ExitSign station={EXIT_ARROWS.station} y={EXIT_ARROWS.y} width={EXIT_ARROWS.w} face={faces.arrows} />
    </group>
  );
}
