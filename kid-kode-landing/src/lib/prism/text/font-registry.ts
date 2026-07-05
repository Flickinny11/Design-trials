// P1 TEXT SYSTEM (A2) — client font registry (contract.ts `FontRegistry`).
//
// Resolves (family, weight) → LoadedFontAtlas with one cache per pair
// (criterion 27 client side):
//   - CORE families at weight 400 load the pre-baked static atlases —
//     Inter keeps the legacy /prism-assets/font-inter.msdf.* pair; the rest
//     live at /prism-assets/fonts/<slug>-400.msdf.*.
//   - Everything else requests the on-demand server bake via
//     GET /api/prism/fonts/atlas (which itself disk-caches; the
//     x-prism-font-cache header proves it).
//
// DOM-free (FP-05 hygiene): texture/JSON IO is injected with global-fetch +
// three TextureLoader defaults — the same pattern as runtime/shared/text.ts.
// The atlas texture is SHARED and registry-owned: consumers (TextObject)
// must never dispose it; `texture.userData.prismShared = true` marks it.

import { LinearFilter, TextureLoader, type Texture } from 'three';

import { FONTS_API_BASE } from './contract';
import type {
  FontManifestEntry,
  FontRegistry,
  LoadedFontAtlas,
  MsdfFontData,
} from './contract';

// Pre-baked atlas set — must stay in lockstep with scripts/bake-core-fonts.mjs
// and the `core: true` flags in google-fonts-manifest.json.
const CORE_FAMILIES = new Set([
  'Inter',
  'Playfair Display',
  'Space Grotesk',
  'JetBrains Mono',
  'Lora',
  'Bebas Neue',
]);
const CORE_WEIGHT = 400;
const DEFAULT_WEIGHT = 400;

/** 'Playfair Display' → 'playfair-display'. Same rule as the bake scripts and
 *  atlas-gen.ts — the slug IS the asset-path contract. */
export function slugifyFamily(family: string): string {
  return family
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface FontRegistryOptions {
  /** Inject a JSON fetcher (defaults to `fetch().json()`). */
  fetchJSON?: (url: string) => Promise<unknown>;
  /** Inject a texture loader (defaults to three's TextureLoader.loadAsync). */
  loadTexture?: (url: string) => Promise<Texture>;
}

interface AtlasUrls {
  json: string;
  png: string;
  source: LoadedFontAtlas['source'];
}

/** Static asset paths for core pairs; API bake URLs for everything else. A
 *  core FAMILY at a non-baked weight (e.g. Inter 700) is NOT core — it goes
 *  through the on-demand bake like any other request. */
function atlasUrls(family: string, weight: number): AtlasUrls {
  if (CORE_FAMILIES.has(family) && weight === CORE_WEIGHT) {
    if (family === 'Inter') {
      // Legacy pair the runtime already ships/consumes — reuse, don't fork.
      return {
        json: '/prism-assets/font-inter.msdf.json',
        png: '/prism-assets/font-inter.msdf.png',
        source: 'core',
      };
    }
    const slug = slugifyFamily(family);
    return {
      json: `/prism-assets/fonts/${slug}-${CORE_WEIGHT}.msdf.json`,
      png: `/prism-assets/fonts/${slug}-${CORE_WEIGHT}.msdf.png`,
      source: 'core',
    };
  }
  const query = `family=${encodeURIComponent(family)}&weight=${weight}`;
  return {
    json: `${FONTS_API_BASE}/atlas?${query}&asset=json`,
    png: `${FONTS_API_BASE}/atlas?${query}&asset=png`,
    source: 'generated',
  };
}

export function createFontRegistry(options: FontRegistryOptions = {}): FontRegistry {
  const fetchJSON =
    options.fetchJSON ??
    (async (url: string): Promise<unknown> => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${url}`);
      return r.json();
    });
  const loadTexture =
    options.loadTexture ??
    ((url: string): Promise<Texture> => new TextureLoader().loadAsync(url));

  // Memoization per (family, weight): `pending` dedupes concurrent resolves
  // (second call returns the SAME promise → the same atlas object); `loaded`
  // backs the synchronous peek. Failed loads are evicted so a transient
  // network error doesn't poison the pair forever.
  const pending = new Map<string, Promise<LoadedFontAtlas>>();
  const loaded = new Map<string, LoadedFontAtlas>();
  let manifestPromise: Promise<FontManifestEntry[]> | null = null;

  function keyOf(family: string, weight: number): string {
    return `${family}::${weight}`;
  }

  async function loadAtlas(family: string, weight: number): Promise<LoadedFontAtlas> {
    const urls = atlasUrls(family, weight);
    const [data, texture] = await Promise.all([
      fetchJSON(urls.json) as Promise<MsdfFontData>,
      loadTexture(urls.png),
    ]);
    // Registry-owned shared texture — TextObject.dispose() must skip it.
    texture.userData.prismShared = true;
    // SHARPNESS (Logan directive 2026-06-10): an MSDF atlas must NEVER be
    // mipmapped — TextureLoader's default LinearMipmapLinear minFilter makes
    // the sampler read channel-averaged mip levels at small on-screen sizes,
    // which corrupts the median-of-RGB distance field and renders small text
    // soft/out-of-focus. Linear/Linear, no mips: the fwidth-based AA in the
    // material is the only smoothing, and it is exactly 1px in screen space.
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    return { family, weight, texture, data, source: urls.source };
  }

  function listFonts(): Promise<FontManifestEntry[]> {
    manifestPromise ??= (async () => {
      const payload = (await fetchJSON(FONTS_API_BASE)) as { fonts?: FontManifestEntry[] };
      if (!Array.isArray(payload?.fonts)) {
        throw new Error(`malformed manifest response from ${FONTS_API_BASE}`);
      }
      return payload.fonts;
    })().catch((err) => {
      manifestPromise = null;
      throw err;
    });
    return manifestPromise;
  }

  function resolveAtlas(family: string, weight = DEFAULT_WEIGHT): Promise<LoadedFontAtlas> {
    const key = keyOf(family, weight);
    const existing = pending.get(key);
    if (existing) return existing;

    const task = loadAtlas(family, weight).then(
      (atlas) => {
        loaded.set(key, atlas);
        return atlas;
      },
      (err) => {
        pending.delete(key);
        throw err;
      },
    );
    pending.set(key, task);
    return task;
  }

  function peekAtlas(family: string, weight = DEFAULT_WEIGHT): LoadedFontAtlas | undefined {
    return loaded.get(keyOf(family, weight));
  }

  function dispose(): void {
    for (const atlas of loaded.values()) {
      try {
        atlas.texture.dispose();
      } catch {
        // ignore — disposing a lost-context texture must not throw teardown
      }
    }
    loaded.clear();
    pending.clear();
    manifestPromise = null;
  }

  return { listFonts, resolveAtlas, peekAtlas, dispose };
}

// Lazy app-wide singleton — built scenes and the editor share one atlas cache.
let singleton: FontRegistry | null = null;

export function getFontRegistry(): FontRegistry {
  singleton ??= createFontRegistry();
  return singleton;
}
