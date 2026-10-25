/** `?capture=plane`: the page renders only the aircraft at the intro's swap pose, on a transparent background,
 * for tools/capture-plane.mjs to photograph — on the dev server only, never in production. */
export function captureMode(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('capture') === 'plane';
}
