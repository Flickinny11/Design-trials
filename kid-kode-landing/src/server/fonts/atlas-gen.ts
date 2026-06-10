import 'server-only';

// P1 TEXT SYSTEM (A2) — on-demand server MSDF atlas bake with disk cache.
//
// Contract (src/lib/prism/text/contract.ts, "Server atlas bake API"):
//   - Criterion 27: a non-core family is baked ONCE on first request and
//     served from `.prism-font-cache/atlases/` afterwards. The atlas route
//     proves it via the `x-prism-font-cache: hit|miss` header.
//   - INV-11: atlases are generated from REAL font TTFs via msdf-bmfont-xml —
//     the same generator, charset, and options as the pre-baked core set
//     (scripts/bake-core-fonts.mjs), so the BMFont JSON shape is identical.
//   - Unknown families are rejected against the committed manifest
//     (google-fonts-manifest.json) — the server never fetches arbitrary URLs
//     derived from client input; the manifest is the gate.
//
// Cache layout (kid-kode-landing root, gitignored):
//   .prism-font-cache/ttf/<slug>-<weight>.ttf          downloaded source font
//   .prism-font-cache/atlases/<slug>-<weight>.msdf.png  atlas page
//   .prism-font-cache/atlases/<slug>-<weight>.msdf.json BMFont metrics
//
// Writes are atomic (tmp + rename, png BEFORE json) so a half-written bake
// can never satisfy the hit check. Concurrent first requests for the same
// (family, weight) are deduped via an in-flight promise map — one bake runs,
// every waiter gets its result.

import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import manifestJson from '@/lib/prism/text/google-fonts-manifest.json';
import type { FontManifestEntry, MsdfFontData } from '@/lib/prism/text/contract';

// Same charset + options as scripts/bake-core-fonts.mjs and the legacy
// build-msdf.mjs — keep in lockstep so on-demand atlases are metric-compatible
// with the shipped core atlases.
const CHARSET =
  Array.from({ length: 127 - 32 }, (_, i) => String.fromCharCode(32 + i)).join('') + '—©';

const BASE_OPTIONS = {
  fieldType: 'msdf',
  fontSize: 64,
  charset: CHARSET,
  textureSize: [2048, 2048],
  texturePadding: 2,
  distanceRange: 8,
  smartSize: true,
  pot: false,
  square: false,
  rot: false,
  rtl: false,
};

/** Client asked for a family/weight the committed manifest does not list —
 *  the atlas route maps this to a 400 (vs 502 for a real bake failure). */
export class UnknownFontError extends Error {
  readonly name = 'UnknownFontError';
}

export interface AtlasGenResult {
  json: MsdfFontData;
  /** Absolute path of the cached atlas PNG (the route streams its bytes). */
  pngPath: string;
  cache: 'hit' | 'miss';
}

/** Full bake for one (family, weight): TTF → { png bytes, BMFont JSON }. */
export type AtlasGenerator = (
  family: string,
  weight: number,
) => Promise<{ png: Buffer; json: MsdfFontData }>;

/** Test seams — production callers pass nothing. */
export interface AtlasGenOverrides {
  /** Atlas cache directory (default `<cwd>/.prism-font-cache/atlases`). */
  cacheDir?: string;
  /** Manifest to validate against (default the committed Google Fonts list). */
  manifest?: FontManifestEntry[];
  /** Replaces the TTF-fetch + msdf-bmfont-xml bake (tests stub this). */
  generator?: AtlasGenerator;
}

/** 'Playfair Display' → 'playfair-display'. Same rule as font-registry.ts and
 *  the bake scripts — the slug IS the on-disk + URL contract. */
export function slugifyFamily(family: string): string {
  return family
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function defaultCacheDir(): string {
  return join(process.cwd(), '.prism-font-cache', 'atlases');
}

function ttfCacheDir(): string {
  return join(process.cwd(), '.prism-font-cache', 'ttf');
}

/** css2 with a non-browser UA returns a single @font-face whose src is a
 *  .ttf url (no woff2/unicode-range splitting). Only gstatic urls from that
 *  response are ever fetched — never client-supplied URLs. */
async function fetchTtf(family: string, weight: number): Promise<Buffer> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${weight}`;
  const res = await fetch(cssUrl, { headers: { 'User-Agent': 'curl/8' } });
  if (!res.ok) throw new Error(`css2 HTTP ${res.status} for ${family}:${weight}`);
  const css = await res.text();
  const m = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/);
  if (!m) throw new Error(`no truetype url in css2 response for ${family}:${weight}`);
  const ttfRes = await fetch(m[1]);
  if (!ttfRes.ok) throw new Error(`ttf HTTP ${ttfRes.status} for ${family}:${weight}`);
  return Buffer.from(await ttfRes.arrayBuffer());
}

async function resolveTtfPath(family: string, weight: number): Promise<string> {
  const dir = ttfCacheDir();
  const cached = join(dir, `${slugifyFamily(family)}-${weight}.ttf`);
  if (!existsSync(cached)) {
    await fs.mkdir(dir, { recursive: true });
    const bytes = await fetchTtf(family, weight);
    const tmp = `${cached}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmp, bytes);
    await fs.rename(tmp, cached);
  }
  return cached;
}

/** Production bake: cached TTF + msdf-bmfont-xml (lazy-imported so the module
 *  graph stays cheap for routes that only hit the cache). */
const defaultGenerator: AtlasGenerator = async (family, weight) => {
  const slug = slugifyFamily(family);
  const ttfPath = await resolveTtfPath(family, weight);
  const mod = await import('msdf-bmfont-xml');
  const generateBMFont = mod.default ?? mod;
  const { textures, font } = await new Promise<{ textures: { texture: Buffer }[]; font: { data: string } }>(
    (resolvePromise, rejectPromise) => {
      generateBMFont(ttfPath, { ...BASE_OPTIONS, outputType: 'json' }, (err: unknown, textures: { texture: Buffer }[], font: { data: string }) => {
        if (err) return rejectPromise(err instanceof Error ? err : new Error(String(err)));
        resolvePromise({ textures, font });
      });
    },
  );
  if (textures.length !== 1) {
    throw new Error(`bake produced ${textures.length} atlas pages for ${family}:${weight} — expected 1`);
  }
  const json = JSON.parse(String(font.data)) as MsdfFontData;
  // Normalise the generator's extension-less page name to the real filename
  // (same fix as the bake scripts).
  if (Array.isArray(json.pages)) {
    json.pages = json.pages.map(() => `${slug}-${weight}.msdf.png`);
  }
  return { png: textures[0].texture, json };
};

// In-flight dedupe: one bake per (cacheDir, slug, weight) no matter how many
// concurrent requests arrive before the first write lands.
const inflight = new Map<string, Promise<AtlasGenResult>>();

export async function generateOrGetAtlas(
  family: string,
  weight = 400,
  overrides: AtlasGenOverrides = {},
): Promise<AtlasGenResult> {
  const slug = slugifyFamily(family);
  if (!slug) throw new UnknownFontError('empty font family');
  const cacheDir = overrides.cacheDir ?? defaultCacheDir();
  const key = `${slug}-${weight}`;
  const pngPath = join(cacheDir, `${key}.msdf.png`);
  const jsonPath = join(cacheDir, `${key}.msdf.json`);

  // Disk cache first — both halves must exist (json is written LAST, so its
  // presence implies a complete pair).
  if (existsSync(jsonPath) && existsSync(pngPath)) {
    const json = JSON.parse(await fs.readFile(jsonPath, 'utf8')) as MsdfFontData;
    return { json, pngPath, cache: 'hit' };
  }

  const inflightKey = `${cacheDir}::${key}`;
  const pending = inflight.get(inflightKey);
  if (pending) return pending;

  const task = (async (): Promise<AtlasGenResult> => {
    // Manifest gate — reject before any network/bake work.
    const manifest = overrides.manifest ?? (manifestJson as FontManifestEntry[]);
    const entry = manifest.find((e) => e.family === family);
    if (!entry) throw new UnknownFontError(`unknown font family: ${family}`);
    if (!Number.isInteger(weight) || !entry.weights.includes(weight)) {
      throw new UnknownFontError(`family '${family}' has no upright weight ${weight}`);
    }

    const generator = overrides.generator ?? defaultGenerator;
    const { png, json } = await generator(family, weight);

    await fs.mkdir(cacheDir, { recursive: true });
    const tmpSuffix = `.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(pngPath + tmpSuffix, png);
    await fs.rename(pngPath + tmpSuffix, pngPath);
    await fs.writeFile(jsonPath + tmpSuffix, JSON.stringify(json));
    await fs.rename(jsonPath + tmpSuffix, jsonPath);

    return { json, pngPath, cache: 'miss' };
  })();

  inflight.set(inflightKey, task);
  try {
    return await task;
  } finally {
    inflight.delete(inflightKey);
  }
}
