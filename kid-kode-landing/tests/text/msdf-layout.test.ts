// Text System P1/A1 — msdf-layout: pure BMFont layout engine.
// Runs against the REAL shipped atlas data (public/prism-assets/font-inter.msdf.json).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { layoutText } from '@/lib/prism/text/msdf-layout';
import type { MsdfFontData, TextLayoutResult } from '@/lib/prism/text/contract';
import type { TextSpec } from '@/lib/prism-graph/types';

const data = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../public/prism-assets/font-inter.msdf.json', import.meta.url)),
    'utf8',
  ),
) as MsdfFontData;

const SAMPLE = 'HELLO WORLD\nX';

function spec(overrides: TextSpec = {}): TextSpec {
  return { content: SAMPLE, fontSize: 0.4, decompose: 'glyph', ...overrides };
}

/** Global bbox over units (center + unit-local quads). */
function blockBbox(result: TextLayoutResult) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const u of result.units) {
    for (const q of u.quads) {
      minX = Math.min(minX, u.center.x + q.rect[0]);
      minY = Math.min(minY, u.center.y + q.rect[1]);
      maxX = Math.max(maxX, u.center.x + q.rect[2]);
      maxY = Math.max(maxY, u.center.y + q.rect[3]);
    }
  }
  return { minX, minY, maxX, maxY };
}

describe('msdf-layout', () => {
  it('is deterministic: two runs deep-equal', () => {
    const a = layoutText(spec(), data);
    const b = layoutText(spec(), data);
    expect(a).toEqual(b);
  });

  it('applies kerning (layout differs when kernings are stripped)', () => {
    const byId = new Map(data.chars.map((c) => [c.id, c]));
    const kern = (data.kernings ?? []).find((k) => {
      const first = byId.get(k.first);
      const second = byId.get(k.second);
      return (
        k.amount !== 0 &&
        first?.char !== undefined &&
        second?.char !== undefined &&
        !/\s/.test(first.char) &&
        !/\s/.test(second.char)
      );
    });
    expect(kern).toBeDefined();
    const pair = `${byId.get(kern!.first)!.char}${byId.get(kern!.second)!.char}`;
    const kerned = layoutText(spec({ content: pair }), data);
    const unkerned = layoutText(spec({ content: pair }), { ...data, kernings: [] });
    expect(kerned).not.toEqual(unkerned);
  });

  it('keeps all atlas UVs and block UVs within [0,1]', () => {
    const result = layoutText(spec(), data);
    for (const u of result.units) {
      for (const q of u.quads) {
        for (const v of [...q.uv, ...q.blockUv]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('emits no quads for whitespace', () => {
    const result = layoutText(spec(), data);
    const totalQuads = result.units.reduce((n, u) => n + u.quads.length, 0);
    // 'HELLO WORLD\nX' = 11 non-whitespace glyphs (space + newline emit none).
    expect(totalQuads).toBe(11);
  });

  it('decomposes into glyph / word / line units', () => {
    // 11 glyphs (H,E,L,L,O,W,O,R,L,D,X) / 3 words / 2 lines.
    expect(layoutText(spec({ decompose: 'glyph' }), data).units).toHaveLength(11);
    expect(layoutText(spec({ decompose: 'word' }), data).units).toHaveLength(3);
    expect(layoutText(spec({ decompose: 'line' }), data).units).toHaveLength(2);
    const words = layoutText(spec({ decompose: 'word' }), data);
    expect(words.units.map((u) => u.text)).toEqual(['HELLO', 'WORLD', 'X']);
  });

  it('re-expresses quads unit-local (unit bbox centered on origin)', () => {
    for (const decompose of ['glyph', 'word', 'line'] as const) {
      const result = layoutText(spec({ decompose }), data);
      for (const u of result.units) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const q of u.quads) {
          minX = Math.min(minX, q.rect[0]);
          minY = Math.min(minY, q.rect[1]);
          maxX = Math.max(maxX, q.rect[2]);
          maxY = Math.max(maxY, q.rect[3]);
        }
        expect(Math.abs((minX + maxX) / 2)).toBeLessThan(1e-6);
        expect(Math.abs((minY + maxY) / 2)).toBeLessThan(1e-6);
      }
    }
  });

  it('centers the whole block on the origin', () => {
    const result = layoutText(spec(), data);
    const { minX, minY, maxX, maxY } = blockBbox(result);
    expect(Math.abs((minX + maxX) / 2)).toBeLessThan(1e-6);
    expect(Math.abs((minY + maxY) / 2)).toBeLessThan(1e-6);
    expect(maxX - minX).toBeCloseTo(result.width, 6);
    expect(maxY - minY).toBeCloseTo(result.height, 6);
  });
});
