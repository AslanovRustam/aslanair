'use client';

import { Html } from '@react-three/drei';
import { copy } from '@/content/copy';
import { seatCardAnchor, seatCardContent } from '@/experience/seatCard';
import { useExperience } from '@/experience/store';
import styles from '@/ui/ui.module.css';
import { usePointerKind } from './pointerKind';

/** A card floating above the hovered (or, on touch, focused) seat: number, kind, price, legroom badge and hint.
 * Anchored in 3D, so it stays on its seat while the camera walks. */
export default function SeatCard() {
  const seat = useExperience((s) => (s.phase === 'browse' ? s.seats.find((x) => x.id === s.hoveredSeatId) : undefined));
  const pointer = usePointerKind();
  if (!seat) return null;
  const card = seatCardContent(seat, pointer);
  return (
    <Html position={seatCardAnchor(seat.id)} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
      <div className={styles.seatCard} data-testid="seat-card" key={seat.id}>
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
