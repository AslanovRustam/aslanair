'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { pickTier, qualityOverride, stepDown, TIER, type DeviceProbe, type Tier } from '@/experience/quality';
import { experienceStore, useExperience } from '@/experience/store';

/** The one runtime step down: `wait` s after the scene is ready, the median of `frames` frame times over `slowMs`. */
const SAMPLE = { wait: 3, frames: 120, slowMs: 25 };

function probe(gl: WebGLRenderingContext | WebGL2RenderingContext): DeviceProbe {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    renderer: String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)),
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    minScreenSide: Math.min(screen.width, screen.height),
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency ?? 4,
  };
}

/**
 * Picks the device's quality tier before anything is drawn (spec §4.8) and applies the pixel ratio; the tier's clouds,
 * shadows and seats follow the store (CloudPuffs, SkyAndClouds, Seats). Once the scene is ready it watches the frame
 * time and steps down a tier, once, if the device turns out slower than its probe said — unless `?quality=` chose.
 */
export default function QualityGovernor() {
  const gl = useThree((s) => s.gl);
  const setDpr = useThree((s) => s.setDpr);
  const quality = useExperience((s) => s.quality);
  const chosen = useRef<Tier | null>(null);
  const watch = useRef<{ since: number | null; times: number[]; done: boolean }>({ since: null, times: [], done: false });

  useLayoutEffect(() => {
    chosen.current = qualityOverride(location.search);
    experienceStore.getState().setQuality(pickTier(probe(gl.getContext()), chosen.current));
  }, [gl]);

  useEffect(() => setDpr(TIER[quality].dpr), [quality, setDpr]);

  useFrame((state, delta) => {
    const w = watch.current;
    if (w.done || chosen.current || !experienceStore.getState().ready) return;
    // a hidden tab's frames are throttled, not slow: start the count again when it comes back
    if (document.hidden) {
      w.since = null;
      w.times.length = 0;
      return;
    }
    w.since ??= state.clock.elapsedTime;
    if (state.clock.elapsedTime - w.since < SAMPLE.wait) return;
    w.times.push(delta * 1000);
    if (w.times.length < SAMPLE.frames) return;
    w.done = true;
    const median = [...w.times].sort((a, b) => a - b)[w.times.length >> 1];
    if (median > SAMPLE.slowMs) {
      const s = experienceStore.getState();
      s.setQuality(stepDown(s.quality));
    }
  });

  return null;
}
