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
import { TEXT_SPEC_DEFAULT } from '../../../prism-graph/types';
import type { FontRegistry, LoadedFontAtlas } from '../../text/contract';

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
