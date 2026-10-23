'use client';

import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { Group } from 'three';

const HIDDEN_LAYER = 31;

/**
 * Mounts its children off the camera's layer, compiles their shaders in parallel (KHR_parallel_shader_compile)
 * and only then shows them, so new materials never stall a frame. Lights must stay outside: a hidden light
 * would change the light count every program is keyed on.
 */
export default function CompileAsync({ children, onShown }: { children: ReactNode; onShown?: () => void }) {
  const group = useRef<Group>(null);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);

  useLayoutEffect(() => {
    const g = group.current!;
    let alive = true;
    g.traverse((o) => o.layers.set(HIDDEN_LAYER));
    const show = () => {
      if (!alive) return;
      g.traverse((o) => o.layers.set(0));
      onShown?.();
    };
    gl.compileAsync(g, camera, scene).then(show, show);
    return () => {
      alive = false;
    };
  }, [gl, camera, scene, onShown]);

  return <group ref={group}>{children}</group>;
}
