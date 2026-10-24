import * as THREE from 'three';

/** A 1×1 texture of one RGBA colour: what a sky image's uniform holds until the image arrives. */
export function standIn(rgba: [number, number, number, number]): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array(rgba), 1, 1);
  t.needsUpdate = true;
  return t;
}

/**
 * Loads a sky image after the journey has started — the loader never waits for it — and hands it over uploaded
 * (`initTexture`), so the night never uploads a texture as it comes in. Returns the cancel, for an effect's cleanup.
 * Its own loading manager: the default one is the loader's progress (drei's useProgress), which must not wait for it.
 */
export function loadSkyTexture(
  gl: THREE.WebGLRenderer,
  url: string,
  setup: (t: THREE.Texture) => void,
  onLoad: (t: THREE.Texture) => void,
): () => void {
  let live = true;
  let loaded: THREE.Texture | null = null;
  new THREE.TextureLoader(new THREE.LoadingManager()).load(url, (t) => {
    if (!live) return t.dispose();
    setup(t);
    gl.initTexture(t);
    loaded = t;
    onLoad(t);
  });
  return () => {
    live = false;
    loaded?.dispose();
  };
}

/** Puts `t` in the uniform and frees what it held (the stand-in). */
export function swapTexture(uniform: { value: THREE.Texture }, t: THREE.Texture) {
  const previous = uniform.value;
  uniform.value = t;
  if (previous !== t) previous.dispose();
}
