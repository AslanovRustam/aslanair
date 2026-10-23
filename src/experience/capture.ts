/** `?capture=plane`: the page renders only the aircraft at the intro's swap pose, on a transparent background,
 * for tools/capture-plane.mjs to photograph. */
export function captureMode(): boolean {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('capture') === 'plane';
}
