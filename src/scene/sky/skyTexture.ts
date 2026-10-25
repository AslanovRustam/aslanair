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
 *
 * Decoded off the main thread where the browser can (an ImageBitmap, turned right way up as it decodes — a bitmap
 * ignores the texture's flipY): the panoramas are 4096 px wide, and a plain image decodes inside the upload, on the
 * main thread, in one long frame — on a slow network, while the visitor is already scrolling.
 */
export function loadSkyTexture(
  gl: THREE.WebGLRenderer,
  url: string,
  setup: (t: THREE.Texture) => void,
  onLoad: (t: THREE.Texture) => void,
): () => void {
  let live = true;
  let loaded: THREE.Texture | null = null;
  const take = (t: THREE.Texture) => {
    if (!live) return t.dispose();
    setup(t);
    gl.initTexture(t);
    loaded = t;
    onLoad(t);
  };
  const manager = new THREE.LoadingManager();
  if (typeof createImageBitmap === 'function') {
    const bitmaps = new THREE.ImageBitmapLoader(manager).setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' });
    bitmaps.load(url, (bitmap) => {
      const t = new THREE.Texture(bitmap);
      t.flipY = false;
      t.needsUpdate = true;
      take(t);
    });
  } else new THREE.TextureLoader(manager).load(url, take);
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
