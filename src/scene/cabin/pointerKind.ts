'use client';

import { useSyncExternalStore } from 'react';
import type { PointerKind } from '@/experience/seatCard';

// The kind of pointer the visitor used last, from pointer events seen on the window in the capture phase — before
// R3F's handlers run. Some mobile browsers fire the click that follows a tap as a plain MouseEvent, without a
// pointerType, so the click itself cannot tell a tap from a mouse click.

let kind: PointerKind = 'mouse';
const listeners = new Set<() => void>();
let installed = false;

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  // until the first pointer event, a coarse pointer (a phone, a tablet) is taken for touch
  if (matchMedia('(pointer: coarse)').matches) kind = 'touch';
  const update = (e: PointerEvent) => {
    const next: PointerKind = e.pointerType === 'touch' ? 'touch' : 'mouse';
    if (next === kind) return;
    kind = next;
    listeners.forEach((l) => l());
  };
  window.addEventListener('pointerdown', update, true);
  window.addEventListener('pointermove', update, true);
}

export function lastPointerKind(): PointerKind {
  install();
  return kind;
}

export function usePointerKind(): PointerKind {
  install();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => kind,
    () => 'mouse',
  );
}
