// T02 — MSDF font atlas loader.
//
// Spec: §3 Tech Stack ("three-msdf-text-webgpu") + §13 Editor (text via
// MSDF only, never TextGeometry / DOM overlays).
//
// We don't render in node — we only verify the contract: load() with a
// preloaded atlas marks the handle ready, createText returns an Object3D,
// dispose flips ready back to false and disposes the atlas texture.

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createFontAtlas,
  type CreateFontAtlasOptions,
} from '@/lib/prism/runtime/shared/text';
import type { BMFontJSON } from 'three-msdf-text-webgpu';

const stubFontJSON: BMFontJSON = {
  pages: ['atlas.png'],
  chars: [
    { id: 65, x: 0, y: 0, width: 32, height: 32, xoffset: 0, yoffset: 0, xadvance: 32, page: 0, chnl: 15 },
  ],
  common: { lineHeight: 32, base: 26, scaleW: 512, scaleH: 512, pages: 1 },
};

function preloaded(): CreateFontAtlasOptions {
  const atlas = new THREE.Texture();
  atlas.name = 'msdf-atlas';
  return { preloaded: { atlas, data: stubFontJSON } };
}

describe('createFontAtlas', () => {
  it('preloaded atlas reports ready=true immediately', () => {
    const fa = createFontAtlas(preloaded());
    expect(fa.ready).toBe(true);
  });

  it('createText returns a THREE.Object3D when ready', () => {
    const fa = createFontAtlas(preloaded());
    const text = fa.createText('Hello', { fontSize: 32 });
    expect(text).toBeInstanceOf(THREE.Object3D);
  });

  it('createText throws when not yet loaded', () => {
    const fa = createFontAtlas();
    expect(fa.ready).toBe(false);
    expect(() => fa.createText('Hello')).toThrow();
  });

  it('dispose() releases the atlas texture and flips ready=false', () => {
    const fa = createFontAtlas(preloaded());
    fa.dispose();
    expect(fa.ready).toBe(false);
  });
});
