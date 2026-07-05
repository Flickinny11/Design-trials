// P1 TEXT SYSTEM (A2) — FontRegistry: memoization + core/non-core URL routing.
//
// Contract under test (src/lib/prism/text/contract.ts `FontRegistry`):
//   - core pairs load static atlases (Inter-400 keeps the LEGACY
//     /prism-assets/font-inter.msdf.* pair; other core families use
//     /prism-assets/fonts/<slug>-400.msdf.*);
//   - non-core pairs (including core families at non-baked weights) route to
//     GET /api/prism/fonts/atlas (criterion 27 bake path);
//   - resolveAtlas is memoized per (family, weight) — the second resolve
//     returns the SAME object and the IO stubs fire exactly once;
//   - peekAtlas is the synchronous cache view;
//   - the atlas texture is marked registry-owned (userData.prismShared).
//
// All IO is injected — zero network, zero DOM.

import { describe, it, expect, vi } from 'vitest';
import type { Texture } from 'three';

import { createFontRegistry } from '@/lib/prism/text/font-registry';
import { FONTS_API_BASE, type MsdfFontData } from '@/lib/prism/text/contract';

const FAKE_DATA: MsdfFontData = {
  pages: ['fake.png'],
  chars: [],
  common: { lineHeight: 58, base: 46, scaleW: 2048, scaleH: 2048 },
};

function makeStubs() {
  const jsonUrls: string[] = [];
  const textureUrls: string[] = [];
  const fetchJSON = vi.fn(async (url: string): Promise<unknown> => {
    jsonUrls.push(url);
    if (url === FONTS_API_BASE) {
      return {
        fonts: [{ family: 'Inter', category: 'Sans Serif', weights: [400, 700], core: true }],
      };
    }
    return { ...FAKE_DATA };
  });
  const loadTexture = vi.fn(async (url: string): Promise<Texture> => {
    textureUrls.push(url);
    return { userData: {}, dispose: vi.fn() } as unknown as Texture;
  });
  return { fetchJSON, loadTexture, jsonUrls, textureUrls };
}

describe('font-registry — core/non-core URL routing', () => {
  it('Inter 400 resolves the LEGACY static pair', async () => {
    const stubs = makeStubs();
    const reg = createFontRegistry(stubs);
    const atlas = await reg.resolveAtlas('Inter', 400);
    expect(stubs.jsonUrls).toEqual(['/prism-assets/font-inter.msdf.json']);
    expect(stubs.textureUrls).toEqual(['/prism-assets/font-inter.msdf.png']);
    expect(atlas.source).toBe('core');
    expect(atlas.family).toBe('Inter');
    expect(atlas.weight).toBe(400);
  });

  it('other core families at 400 resolve /prism-assets/fonts/<slug>-400.msdf.*', async () => {
    const stubs = makeStubs();
    const reg = createFontRegistry(stubs);
    const atlas = await reg.resolveAtlas('Playfair Display', 400);
    expect(stubs.jsonUrls).toEqual(['/prism-assets/fonts/playfair-display-400.msdf.json']);
    expect(stubs.textureUrls).toEqual(['/prism-assets/fonts/playfair-display-400.msdf.png']);
    expect(atlas.source).toBe('core');
  });

  it('non-core families route to the on-demand bake API (json + png assets)', async () => {
    const stubs = makeStubs();
    const reg = createFontRegistry(stubs);
    const atlas = await reg.resolveAtlas('Roboto', 700);
    expect(stubs.jsonUrls).toEqual([
      `${FONTS_API_BASE}/atlas?family=Roboto&weight=700&asset=json`,
    ]);
    expect(stubs.textureUrls).toEqual([
      `${FONTS_API_BASE}/atlas?family=Roboto&weight=700&asset=png`,
    ]);
    expect(atlas.source).toBe('generated');
  });

  it('a CORE family at a non-baked weight is NOT core — it routes to the API', async () => {
    const stubs = makeStubs();
    const reg = createFontRegistry(stubs);
    const atlas = await reg.resolveAtlas('Inter', 700);
    expect(stubs.jsonUrls).toEqual([
      `${FONTS_API_BASE}/atlas?family=Inter&weight=700&asset=json`,
    ]);
    expect(atlas.source).toBe('generated');
  });

  it('weight defaults to 400', async () => {
    const stubs = makeStubs();
    const reg = createFontRegistry(stubs);
    const atlas = await reg.resolveAtlas('Lora');
    expect(stubs.jsonUrls).toEqual(['/prism-assets/fonts/lora-400.msdf.json']);
    expect(atlas.weight).toBe(400);
  });

  it('family names with spaces are URI-encoded on the API path', async () => {
    const stubs = makeStubs();
    const reg = createFontRegistry(stubs);
    await reg.resolveAtlas('Noto Sans', 400);
    expect(stubs.jsonUrls).toEqual([
      `${FONTS_API_BASE}/atlas?family=Noto%20Sans&weight=400&asset=json`,
    ]);
  });
});

describe('font-registry — memoization + peek', () => {
  it('second resolve returns the SAME atlas object; IO fires once per asset', async () => {
    const stubs = makeStubs();
    const reg = createFontRegistry(stubs);
    const first = await reg.resolveAtlas('Inter', 400);
    const second = await reg.resolveAtlas('Inter', 400);
    expect(second).toBe(first);
    expect(stubs.fetchJSON).toHaveBeenCalledTimes(1);
    expect(stubs.loadTexture).toHaveBeenCalledTimes(1);
  });

  it('concurrent resolves of the same pair dedupe to one load', async () => {
    const stubs = makeStubs();
    const reg = createFontRegistry(stubs);
    const [a, b] = await Promise.all([
      reg.resolveAtlas('Roboto', 400),
      reg.resolveAtlas('Roboto', 400),
    ]);
    expect(b).toBe(a);
    expect(stubs.loadTexture).toHaveBeenCalledTimes(1);
  });

  it('different weights of the same family are distinct cache entries', async () => {
    const stubs = makeStubs();
    const reg = createFontRegistry(stubs);
    const w400 = await reg.resolveAtlas('Roboto', 400);
    const w700 = await reg.resolveAtlas('Roboto', 700);
    expect(w700).not.toBe(w400);
    expect(stubs.loadTexture).toHaveBeenCalledTimes(2);
  });

  it('peekAtlas is undefined before resolve, the atlas after', async () => {
    const stubs = makeStubs();
    const reg = createFontRegistry(stubs);
    expect(reg.peekAtlas('Inter', 400)).toBeUndefined();
    const atlas = await reg.resolveAtlas('Inter', 400);
    expect(reg.peekAtlas('Inter', 400)).toBe(atlas);
    expect(reg.peekAtlas('Inter')).toBe(atlas); // default weight peek
    expect(reg.peekAtlas('Inter', 700)).toBeUndefined();
  });

  it('a failed load is evicted so the pair can be retried', async () => {
    const stubs = makeStubs();
    stubs.loadTexture.mockRejectedValueOnce(new Error('boom'));
    const reg = createFontRegistry(stubs);
    await expect(reg.resolveAtlas('Inter', 400)).rejects.toThrow('boom');
    expect(reg.peekAtlas('Inter', 400)).toBeUndefined();
    const atlas = await reg.resolveAtlas('Inter', 400);
    expect(atlas.family).toBe('Inter');
  });
});

describe('font-registry — shared texture ownership + manifest + dispose', () => {
  it('marks the atlas texture registry-owned (userData.prismShared)', async () => {
    const stubs = makeStubs();
    const reg = createFontRegistry(stubs);
    const atlas = await reg.resolveAtlas('Inter', 400);
    expect(atlas.texture.userData.prismShared).toBe(true);
  });

  it('listFonts hits GET /api/prism/fonts once and memoizes', async () => {
    const stubs = makeStubs();
    const reg = createFontRegistry(stubs);
    const fonts = await reg.listFonts();
    const again = await reg.listFonts();
    expect(fonts[0].family).toBe('Inter');
    expect(again).toBe(fonts);
    expect(stubs.jsonUrls).toEqual([FONTS_API_BASE]);
  });

  it('dispose() disposes registry-owned textures and clears the peek cache', async () => {
    const stubs = makeStubs();
    const reg = createFontRegistry(stubs);
    const atlas = await reg.resolveAtlas('Inter', 400);
    reg.dispose();
    expect((atlas.texture.dispose as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect(reg.peekAtlas('Inter', 400)).toBeUndefined();
  });
});
