'use client';

import { useStore } from 'zustand';
import { veilStore } from '@/experience/veil';
import styles from './veil.module.css';

/** The reduced-motion veil: covers the scene while the camera cuts to a new key pose (CameraRig). */
export default function Veil() {
  const covered = useStore(veilStore, (s) => s.covered);
  return <div className={styles.veil} data-veil data-covered={covered} aria-hidden="true" />;
}
