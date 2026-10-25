'use client';

import { Html } from '@react-three/drei';
import { useCallback, useRef } from 'react';
import { Vector3, type Camera, type Object3D } from 'three';
import { copy } from '@/content/copy';
import { cardPlacement } from '@/experience/cardPlacement';
import { seatCardAnchor, seatCardContent } from '@/experience/seatCard';
import { useExperience } from '@/experience/store';
import styles from '@/ui/ui.module.css';
import { usePointerKind } from './pointerKind';

const at = new Vector3();

/** A card floating above the hovered (or, on touch, focused) seat: number, kind, price, legroom badge and hint.
 * Anchored in 3D, so it stays on its seat while the camera walks — and kept on the screen: pushed in from a side, its
 * stem still on the seat, or hung under the seat when above it the card would meet the header (cardPlacement). */
export default function SeatCard() {
  const seat = useExperience((s) => (s.phase === 'browse' ? s.seats.find((x) => x.id === s.hoveredSeatId) : undefined));
  const pointer = usePointerKind();
  const box = useRef<HTMLDivElement>(null);
  const place = useCallback((el: Object3D, camera: Camera, size: { width: number; height: number }) => {
    at.setFromMatrixPosition(el.matrixWorld).project(camera);
    const anchor = { x: ((at.x + 1) / 2) * size.width, y: ((1 - at.y) / 2) * size.height };
    const card = box.current;
    if (!card) return [anchor.x, anchor.y];
    const top = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    const placed = cardPlacement(anchor, { width: card.offsetWidth, height: card.offsetHeight }, size, top);
    card.dataset.below = String(placed.below);
    card.style.setProperty('--stem', `${placed.stem}px`);
    return [placed.x, placed.y];
  }, []);
  if (!seat) return null;
  const card = seatCardContent(seat, pointer);
  return (
    <Html position={seatCardAnchor(seat.id)} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }} calculatePosition={place}>
      <div ref={box} className={styles.seatCard} data-testid="seat-card" key={seat.id}>
        <div className={styles.seatCardBody}>
          <div className={styles.seatCardTop}>
            <span className={styles.seatCardNumber}>{card.number}</span>
            <span className={styles.seatCardPrice}>{card.price}</span>
          </div>
          <div className={styles.seatCardKind}>
            {card.kind}
            {card.extra && <span className={styles.seatCardBadge}>{copy.seatCard.extra}</span>}
          </div>
          <div className={styles.seatCardHint}>{card.hint}</div>
        </div>
        <div className={styles.seatCardStem} />
      </div>
    </Html>
  );
}
