// 3D TEXT SYSTEM — FontOutlineRegistry: accumulating per-key outline cache.
//
// Contract under test (./contract-3d.ts `FontOutlineRegistry`):
//   - resolveOutlines memoizes per (family, weight, italic) and ACCUMULATES:
//     a follow-up request for new chars fetches ONLY the missing ones and
//     merges them into the cached set;
//   - peekOutlines is the synchronous view — it returns the set only when the
//     cache already covers every requested char (else undefined);
//   - concurrent resolves for the same missing set coalesce to one fetch.
//
// All IO is injected via fetchImpl — zero network, zero DOM. Relative imports
// only (FP-05 hygiene; this test is colocated under src/).

import { describe, it, expect, vi } from 'vitest';

import { createFontOutlineRegistry } from './font-outline-registry';
import { FONT_OUTLINE_API } from './contract-3d';
import type { GlyphOutline, LoadedFontOutlines } from './contract-3d';

const glyph = (advance: number): GlyphOutline => ({
  advanceWidth: advance,
  commands: [
    { type: 'M', x: 0, y: 0 },
    { type: 'L', x: advance, y: 700 },
    { type: 'Z' },
  ],
});

/** Build a LoadedFontOutlines-shaped payload covering exactly `chars`. */
function payloadFor(chars: string): Partial<LoadedFontOutlines> {
  const glyphs: Record<string, GlyphOutline> = {};
  let i = 0;
  for (const ch of chars) glyphs[ch] = glyph(500 + i++ * 10);
  return {
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    underlinePosition: -100,
    underlineThickness: 50,
    glyphs,
    source: 'generated',
  };
}

/** Stub fetchImpl: records the chars requested per call, returns a payload
 *  covering exactly the `chars=` query param. */
function makeStub() {
  const charsRequested: string[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    const chars = decodeURIComponent(
      new URL(url, 'http://x').searchParams.get('chars') ?? '',
    );
    charsRequested.push(chars);
    return {
      ok: true,
      status: 200,
      json: async () => payloadFor(chars),
    } as unknown as Response;
  });
  return { fetchImpl, charsRequested };
}

describe('font-outline-registry — peek/resolve + accumulating cache', () => {
  it('peek returns undefined before resolve; resolve fetches once', async () => {
    const stub = makeStub();
    const reg = createFontOutlineRegistry({ fetchImpl: stub.fetchImpl });

    expect(reg.peekOutlines('Inter', 700, 'AB')).toBeUndefined();

    const set = await reg.resolveOutlines('Inter', 700, 'AB');
    expect(stub.fetchImpl).toHaveBeenCalledTimes(1);
    expect(stub.charsRequested).toEqual(['AB']);
    expect(Object.keys(set.glyphs).sort()).toEqual(['A', 'B']);
    expect(set.family).toBe('Inter');
    expect(set.weight).toBe(700);
    expect(set.italic).toBe(false);
  });

  it('peek returns the set after resolve (covers a subset of cached chars)', async () => {
    const stub = makeStub();
    const reg = createFontOutlineRegistry({ fetchImpl: stub.fetchImpl });
    const set = await reg.resolveOutlines('Inter', 700, 'AB');

    expect(reg.peekOutlines('Inter', 700, 'A')).toBe(set);
    expect(reg.peekOutlines('Inter', 700, 'AB')).toBe(set);
    // A char outside the cached set still misses.
    expect(reg.peekOutlines('Inter', 700, 'AC')).toBeUndefined();
  });

  it('fully-cached resolve does NOT fetch again (peek fast path)', async () => {
    const stub = makeStub();
    const reg = createFontOutlineRegistry({ fetchImpl: stub.fetchImpl });
    const first = await reg.resolveOutlines('Inter', 700, 'AB');
    const again = await reg.resolveOutlines('Inter', 700, 'A');
    expect(again).toBe(first);
    expect(stub.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('resolving new chars fetches only the missing ones and merges', async () => {
    const stub = makeStub();
    const reg = createFontOutlineRegistry({ fetchImpl: stub.fetchImpl });
    const first = await reg.resolveOutlines('Inter', 700, 'AB');
    const merged = await reg.resolveOutlines('Inter', 700, 'ABC');

    // Same cached object, grown in place.
    expect(merged).toBe(first);
    expect(stub.fetchImpl).toHaveBeenCalledTimes(2);
    // Second fetch asked for ONLY the missing char.
    expect(stub.charsRequested).toEqual(['AB', 'C']);
    expect(Object.keys(merged.glyphs).sort()).toEqual(['A', 'B', 'C']);
    expect(reg.peekOutlines('Inter', 700, 'ABC')).toBe(merged);
  });

  it('concurrent resolves of the same missing set coalesce to one fetch', async () => {
    const stub = makeStub();
    const reg = createFontOutlineRegistry({ fetchImpl: stub.fetchImpl });
    const [a, b] = await Promise.all([
      reg.resolveOutlines('Inter', 700, 'AB'),
      reg.resolveOutlines('Inter', 700, 'AB'),
    ]);
    expect(b).toBe(a);
    expect(stub.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('encodes family + chars and passes weight/italic on the API query', async () => {
    const stub = makeStub();
    const reg = createFontOutlineRegistry({ fetchImpl: stub.fetchImpl });
    await reg.resolveOutlines('Playfair Display', 400, 'A B', true);
    const url = String(stub.fetchImpl.mock.calls[0][0]);
    expect(url.startsWith(`${FONT_OUTLINE_API}?`)).toBe(true);
    expect(url).toContain('family=Playfair%20Display');
    expect(url).toContain('weight=400');
    expect(url).toContain('italic=1');
    // Space is a distinct char; it is de-duped but still requested once.
    expect(url).toContain(`chars=${encodeURIComponent('A B')}`);
  });

  it('italic and roman of the same family/weight are distinct cache keys', async () => {
    const stub = makeStub();
    const reg = createFontOutlineRegistry({ fetchImpl: stub.fetchImpl });
    const roman = await reg.resolveOutlines('Inter', 700, 'AB', false);
    const italic = await reg.resolveOutlines('Inter', 700, 'AB', true);
    expect(italic).not.toBe(roman);
    expect(stub.fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('a failed fetch is evicted so the key can be retried', async () => {
    const stub = makeStub();
    stub.fetchImpl.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as unknown as Response);
    const reg = createFontOutlineRegistry({ fetchImpl: stub.fetchImpl });

    await expect(reg.resolveOutlines('Inter', 700, 'AB')).rejects.toThrow('HTTP 500');
    expect(reg.peekOutlines('Inter', 700, 'AB')).toBeUndefined();

    const set = await reg.resolveOutlines('Inter', 700, 'AB');
    expect(Object.keys(set.glyphs).sort()).toEqual(['A', 'B']);
  });

  it('dispose() clears the cache', async () => {
    const stub = makeStub();
    const reg = createFontOutlineRegistry({ fetchImpl: stub.fetchImpl });
    await reg.resolveOutlines('Inter', 700, 'AB');
    reg.dispose();
    expect(reg.peekOutlines('Inter', 700, 'AB')).toBeUndefined();
  });
});
