// Text System P1/A1 — text-object: built TextObject scene group.
// Real atlas metrics + a stub Texture (no renderer; TSL graph build is pure JS).

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { Texture } from 'three';
import { createTextObject } from '@/lib/prism/text/text-object';
import {
  TEXT_BLOCK_UV_ATTR,
  TEXT_OBJECT_NAME,
  textUnitName,
  type LoadedFontAtlas,
  type MsdfFontData,
} from '@/lib/prism/text/contract';

const data = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../public/prism-assets/font-inter.msdf.json', import.meta.url)),
    'utf8',
  ),
) as MsdfFontData;

function makeAtlas(): LoadedFontAtlas {
  return { family: 'Inter', weight: 400, texture: new Texture(), data, source: 'core' };
}

describe('text-object', () => {
  it('builds a flat group of glyph-named unit meshes', () => {
    const atlas = makeAtlas();
    const handle = createTextObject({ content: 'PRISM' }, atlas);
    expect(handle.object.name).toBe(TEXT_OBJECT_NAME);
    expect(handle.units).toHaveLength(5);
    expect(handle.object.children).toHaveLength(5);
    handle.units.forEach((mesh, i) => {
      expect(mesh.name).toBe(textUnitName(i));
      expect(mesh.parent).toBe(handle.object); // FLAT children
      expect(mesh.geometry.getAttribute(TEXT_BLOCK_UV_ATTR)).toBeDefined();
      expect(mesh.geometry.getAttribute('position')).toBeDefined();
    });
    expect(handle.object.userData.textHandle).toBe(handle);
    expect(atlas.texture.userData.prismShared).toBe(true);
  });

  it('setSpec rebuilds in place keeping the SAME Group identity', () => {
    const handle = createTextObject({ content: 'PRISM' }, makeAtlas());
    const group = handle.object;
    handle.setSpec({ content: 'PR' });
    expect(handle.object).toBe(group);
    expect(handle.units).toHaveLength(2);
    expect(group.children).toHaveLength(2);
    expect(group.children.map((c) => c.name)).toEqual([textUnitName(0), textUnitName(1)]);
    expect(handle.spec.content).toBe('PR');
  });

  it('setSpec completes under 50ms for a 30-char string', () => {
    const handle = createTextObject({ content: 'warm-up' }, makeAtlas());
    const thirty = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123'; // 30 chars
    const t0 = performance.now();
    handle.setSpec({ content: thirty });
    const elapsed = performance.now() - t0;
    expect(handle.units).toHaveLength(30);
    expect(elapsed).toBeLessThan(50);
  });

  it('measure() reports the block size in scene units', () => {
    const handle = createTextObject({ content: 'PRISM', fontSize: 0.4 }, makeAtlas());
    const m = handle.measure();
    expect(m.width).toBeGreaterThan(0);
    expect(m.height).toBeGreaterThan(0);
    handle.setSpec({ content: 'PRISM', fontSize: 0.8 });
    expect(handle.measure().width).toBeCloseTo(m.width * 2, 6);
  });

  it('dispose() never disposes the shared atlas texture', () => {
    const atlas = makeAtlas();
    const disposeSpy = vi.spyOn(atlas.texture, 'dispose');
    const handle = createTextObject({ content: 'PRISM' }, atlas);
    handle.setSpec({ content: 'PR' }); // replaced geometries/materials disposed
    handle.dispose();
    expect(handle.object.children).toHaveLength(0);
    expect(handle.units).toHaveLength(0);
    expect(disposeSpy).not.toHaveBeenCalled();
  });
});
