'use client';

import { cabinMaterials } from './materials';
import { useKitGeometry } from './Seats';

/** The aft galley across the aisle end, the two lavatories beside it, and a trolley pulled out into the aisle. */
export default function TailZone() {
  const kit = useKitGeometry();
  const m = cabinMaterials();
  return (
    <group>
      <mesh name="AftGalley" geometry={kit('AftGalley')} material={m.panels} />
      <mesh name="AftGalleySteel" geometry={kit('AftGalleySteel')} material={m.steel} />
      <mesh name="AftGalleyWorktop" geometry={kit('AftGalleyWorktop')} material={m.worktop} />
      <mesh name="Lavatories" geometry={kit('Lavatories')} material={m.panels} />
      <mesh name="LavatoryDoors" geometry={kit('LavatoryDoors')} material={m.laminate} />
      <mesh name="LavatoryTrim" geometry={kit('LavatoryTrim')} material={m.worktop} />
      <mesh name="GalleyCart" geometry={kit('GalleyCart')} material={m.steel} />
    </group>
  );
}
