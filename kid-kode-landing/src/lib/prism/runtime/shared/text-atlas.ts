// text-atlas.ts — atlas plumbing for renderMode:'text' (canvas-spec §7,
// criterion 26/27).
//
// The default render-mode factory needs the SAME font-atlas cache the editor's
// font picker uses (one cache per (family, weight) pair — criterion 27), but
// `createNode` is synchronous (spec §8) while atlas IO is async. This module
// is the thin seam between the two:
//
//   - `peekTextAtlas(family, weight)` — synchronous cache hit (build glyphs now).
//   - `resolveTextAtlas(family, weight)` — async load-or-cache (build on resolve,
//     exactly like the textureLoader pattern for sprite/plane assets).
//
// By default both delegate to the app-wide font-registry singleton
// (`getFontRegistry()` in ../../text/font-registry). Tests (and any host that
// wants an isolated cache) can swap the backing registry via
// `setTextAtlasRegistry` — the same injection style as runtime/shared/text.ts.
//
// DOM-free (FP-05 hygiene): no window/document here or in the registry it
// delegates to. Relative imports only (dep-guard).

import { getFontRegistry } from '../../text/font-registry';
import { getFontOutlineRegistry } from '../../text/font-outline-registry';
import { TEXT_SPEC_DEFAULT } from '../../../prism-graph/types';
import type { FontRegistry, LoadedFontAtlas } from '../../text/contract';
import type { FontOutlineRegistry, LoadedFontOutlines } from '../../text/contract-3d';

const DEFAULT_FAMILY = TEXT_SPEC_DEFAULT.fontFamily ?? 'Inter';
const DEFAULT_WEIGHT = TEXT_SPEC_DEFAULT.fontWeight ?? 400;

let registryOverride: FontRegistry | null = null;

/** Swap the backing registry (tests / isolated hosts). Pass `null` to restore
 *  the app-wide singleton. */
export function setTextAtlasRegistry(registry: FontRegistry | null): void {
  registryOverride = registry;
}

/** The registry currently backing the text-atlas seam. */
export function getTextAtlasRegistry(): FontRegistry {
  return registryOverride ?? getFontRegistry();
}

/** Synchronous cache peek — returns the loaded atlas when this (family,
 *  weight) pair has already been resolved, else `undefined`. */
export function peekTextAtlas(
  family: string = DEFAULT_FAMILY,
  weight: number = DEFAULT_WEIGHT,
): LoadedFontAtlas | undefined {
  return getTextAtlasRegistry().peekAtlas(family, weight);
}

/** Load-or-cache an atlas. Memoized per (family, weight) by the registry —
 *  a second resolve returns the same atlas object (criterion 27). */
export function resolveTextAtlas(
  family: string = DEFAULT_FAMILY,
  weight: number = DEFAULT_WEIGHT,
): Promise<LoadedFontAtlas> {
  return getTextAtlasRegistry().resolveAtlas(family, weight);
}

// ── Outline seam (3D extruded text — contract-3d.ts) ───────────────────────
// The extruded builder needs glyph OUTLINES, not an MSDF atlas. These three
// functions are the outline siblings of the atlas seam above: same
// synchronous-peek / async-resolve / swappable-registry shape, delegating to
// the app-wide outline-registry singleton (`getFontOutlineRegistry()`) by
// default. DOM-free, relative imports only — same hygiene as the atlas seam.

let outlineRegistryOverride: FontOutlineRegistry | null = null;

/** Swap the backing outline registry (tests / isolated hosts). Pass `null` to
 *  restore the app-wide singleton. */
export function setTextOutlineRegistry(registry: FontOutlineRegistry | null): void {
  outlineRegistryOverride = registry;
}

/** The outline registry currently backing the seam. */
export function getTextOutlineRegistry(): FontOutlineRegistry {
  return outlineRegistryOverride ?? getFontOutlineRegistry();
}

/** Synchronous cache peek — returns the loaded outline set ONLY when this
 *  (family, weight, italic) key already covers every char in `chars` (so
 *  createNode can mount synchronously, spec §8), else `undefined`. */
export function peekTextOutlines(
  family: string = DEFAULT_FAMILY,
  weight: number = DEFAULT_WEIGHT,
  chars: string = '',
  italic = false,
): LoadedFontOutlines | undefined {
  return getTextOutlineRegistry().peekOutlines(family, weight, chars, italic);
}

/** Load-or-cache glyph outlines covering at least `chars`. Memoized per
 *  (family, weight, italic) by the registry, which ACCUMULATES newly-requested
 *  chars into the cached set (fetches only the missing ones). */
export function resolveTextOutlines(
  family: string = DEFAULT_FAMILY,
  weight: number = DEFAULT_WEIGHT,
  chars: string = '',
  italic = false,
): Promise<LoadedFontOutlines> {
  return getTextOutlineRegistry().resolveOutlines(family, weight, chars, italic);
}
