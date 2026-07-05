// 3D TEXT SYSTEM — client font-OUTLINE registry (contract-3d.ts
// `FontOutlineRegistry`).
//
// The flat builder needs an MSDF atlas (font-registry.ts); the EXTRUDED builder
// (text-object-3d.ts) needs real glyph OUTLINES instead. This registry is the
// outline sibling of `createFontRegistry`: one cache per (family, weight,
// italic) triple (mirroring criterion 27's per-pair cache), with an accumulating
// glyph set — successive resolves for new characters fetch ONLY the missing
// chars and merge the returned glyphs/kerning into the cached
// `LoadedFontOutlines`. `peekOutlines` is the synchronous view createNode uses
// to mount without awaiting (spec §8): it returns the set only when the cache
// already covers every requested char.
//
// Outlines come from GET /api/prism/fonts/outline (FONT_OUTLINE_API), which
// reuses the css2 raw-TTF fetch + disk cache from src/server/fonts/atlas-gen.ts.
//
// DOM-free (FP-05 hygiene): no DOM globals. Fetch IO is injected with a
// global-fetch default — the same pattern as font-registry.ts /
// runtime/shared/text.ts. Relative imports only (dep-guard).

import { FONT_OUTLINE_API } from './contract-3d';
import type {
  FontOutlineRegistry,
  GlyphOutline,
  LoadedFontOutlines,
} from './contract-3d';

const DEFAULT_WEIGHT = 400;

// Mirrors font-registry.ts CORE_FAMILIES — these parse from a local TTF on the
// server, so their outlines carry source='core'. Everything else is parsed
// on-demand → source='generated'. (The endpoint may override; this is the
// client-side default when the response omits `source`.)
const CORE_FAMILIES = new Set([
  'Inter',
  'Playfair Display',
  'Space Grotesk',
  'JetBrains Mono',
  'Lora',
  'Bebas Neue',
]);
const CORE_WEIGHT = 400;

/** Unique characters of `chars`, in first-seen order (de-dupe for both the
 *  coverage check and the fetched `chars=` query). */
function uniqueChars(chars: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ch of chars) {
    if (!seen.has(ch)) {
      seen.add(ch);
      out.push(ch);
    }
  }
  return out;
}

export interface FontOutlineRegistryOptions {
  /** Inject a fetch implementation (defaults to `globalThis.fetch`). */
  fetchImpl?: typeof fetch;
}

/** Shape the outline endpoint returns — `LoadedFontOutlines` minus the
 *  runtime-derived fields the client fills in (it may still send them; the
 *  client trusts its own family/weight/italic key). */
type OutlineResponse = Omit<LoadedFontOutlines, 'family' | 'weight' | 'italic'> &
  Partial<Pick<LoadedFontOutlines, 'family' | 'weight' | 'italic' | 'source'>>;

export function createFontOutlineRegistry(
  options: FontOutlineRegistryOptions = {},
): FontOutlineRegistry {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  // Per (family, weight, italic): `loaded` is the accumulating cache backing
  // peekOutlines; `pending` dedupes concurrent resolves for the SAME missing
  // char-set so a burst of identical requests fires one fetch. A failed fetch
  // is evicted from `pending` so a transient network error doesn't poison the
  // key forever (mirrors font-registry.ts).
  const loaded = new Map<string, LoadedFontOutlines>();
  const pending = new Map<string, Promise<LoadedFontOutlines>>();

  function keyOf(family: string, weight: number, italic: boolean): string {
    return `${family}__${weight}__${italic ? 'i' : 'r'}`;
  }

  /** True when the cached set has an outline for every char in `unique`. */
  function covers(cached: LoadedFontOutlines | undefined, unique: string[]): boolean {
    if (!cached) return false;
    for (const ch of unique) {
      if (!(ch in cached.glyphs)) return false;
    }
    return true;
  }

  /** Merge a fetched outline payload into the cached set (or seed it), growing
   *  `glyphs`/`kerning`. Existing entries win — re-fetched chars don't clobber. */
  function merge(
    key: string,
    family: string,
    weight: number,
    italic: boolean,
    res: OutlineResponse,
  ): LoadedFontOutlines {
    const existing = loaded.get(key);
    if (!existing) {
      const seeded: LoadedFontOutlines = {
        family,
        weight,
        italic: res.italic ?? italic,
        unitsPerEm: res.unitsPerEm,
        ascender: res.ascender,
        descender: res.descender,
        underlinePosition: res.underlinePosition,
        underlineThickness: res.underlineThickness,
        glyphs: { ...res.glyphs },
        source:
          res.source ??
          (CORE_FAMILIES.has(family) && weight === CORE_WEIGHT ? 'core' : 'generated'),
        ...(res.kerning ? { kerning: { ...res.kerning } } : {}),
        ...(res.syntheticBold !== undefined ? { syntheticBold: res.syntheticBold } : {}),
      };
      loaded.set(key, seeded);
      return seeded;
    }
    // Accumulate: add only chars/kern pairs not already present.
    for (const [ch, glyph] of Object.entries(res.glyphs) as [string, GlyphOutline][]) {
      if (!(ch in existing.glyphs)) existing.glyphs[ch] = glyph;
    }
    if (res.kerning) {
      existing.kerning ??= {};
      for (const [pair, amount] of Object.entries(res.kerning)) {
        if (!(pair in existing.kerning)) existing.kerning[pair] = amount;
      }
    }
    return existing;
  }

  async function fetchOutlines(
    family: string,
    weight: number,
    italic: boolean,
    missing: string[],
  ): Promise<OutlineResponse> {
    const query =
      `family=${encodeURIComponent(family)}` +
      `&weight=${weight}` +
      `&italic=${italic ? '1' : '0'}` +
      `&chars=${encodeURIComponent(missing.join(''))}`;
    const url = `${FONT_OUTLINE_API}?${query}`;
    const r = await fetchImpl(url);
    if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${url}`);
    return (await r.json()) as OutlineResponse;
  }

  function resolveOutlines(
    family: string,
    weight: number = DEFAULT_WEIGHT,
    chars: string,
    italic = false,
  ): Promise<LoadedFontOutlines> {
    const key = keyOf(family, weight, italic);
    const unique = uniqueChars(chars);

    // Fully cached → no IO (mirrors the atlas peek-before-load fast path).
    const cached = loaded.get(key);
    if (covers(cached, unique)) return Promise.resolve(cached as LoadedFontOutlines);

    const missing = unique.filter((ch) => !(cached && ch in cached.glyphs));

    // De-dupe concurrent resolves for the SAME missing set → one fetch.
    const inflightKey = `${key}::${missing.join('')}`;
    const existing = pending.get(inflightKey);
    if (existing) return existing;

    const task = fetchOutlines(family, weight, italic, missing).then(
      (res) => {
        pending.delete(inflightKey);
        return merge(key, family, weight, italic, res);
      },
      (err) => {
        pending.delete(inflightKey);
        throw err;
      },
    );
    pending.set(inflightKey, task);
    return task;
  }

  function peekOutlines(
    family: string,
    weight: number = DEFAULT_WEIGHT,
    chars: string,
    italic = false,
  ): LoadedFontOutlines | undefined {
    const cached = loaded.get(keyOf(family, weight, italic));
    return covers(cached, uniqueChars(chars)) ? cached : undefined;
  }

  function dispose(): void {
    // Outlines are plain data (no GPU resources) — just drop the caches.
    loaded.clear();
    pending.clear();
  }

  return { resolveOutlines, peekOutlines, dispose };
}

// Lazy app-wide singleton — built scenes and the editor share one outline
// cache (mirrors getFontRegistry()).
let singleton: FontOutlineRegistry | null = null;

export function getFontOutlineRegistry(): FontOutlineRegistry {
  singleton ??= createFontOutlineRegistry();
  return singleton;
}
