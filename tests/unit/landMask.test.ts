import { afterEach, describe, expect, test, vi } from 'vitest';
import { drawingSurface } from '@/scene/globe/landMask';

afterEach(() => vi.unstubAllGlobals());

const page = () => ({ createElement: (tag: string) => ({ tag, width: 0, height: 0, getContext: () => ({}) }) });

describe('the land mask draws where the browser can', () => {
  test('on an OffscreenCanvas when there is one with a 2D context', () => {
    class Offscreen {
      constructor(
        public width: number,
        public height: number,
      ) {}
      getContext() {
        return {};
      }
    }
    vi.stubGlobal('OffscreenCanvas', Offscreen);
    vi.stubGlobal('document', page());
    expect(drawingSurface(8, 4)).toBeInstanceOf(Offscreen);
  });

  test('on a page canvas without OffscreenCanvas (Safari before 16.4), or when it has no 2D context', () => {
    vi.stubGlobal('OffscreenCanvas', undefined);
    vi.stubGlobal('document', page());
    expect(drawingSurface(8, 4)).toMatchObject({ tag: 'canvas', width: 8, height: 4 });
    class NoContext {
      getContext() {
        return null;
      }
    }
    vi.stubGlobal('OffscreenCanvas', NoContext);
    expect(drawingSurface(8, 4)).toMatchObject({ tag: 'canvas', width: 8, height: 4 });
  });
});
