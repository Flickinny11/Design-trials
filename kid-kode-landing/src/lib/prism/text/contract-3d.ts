// Prism Text System — TRUE 3D EXTRUDED TEXT contract (additive; canvas-spec §7,
// INV-11 / INV-18). This file ADDS to the frozen `contract.ts`; it never changes
// an existing signature. The 3D builder returns the SAME `TextObjectHandle` as
// the flat MSDF builder, so the factory dispatch (default-factory.ts), the
// GraphScene restyle effect, HubManager cleanup, and all 36 text-animation
// primitives consume it with zero edits — units stay named `glyph-<i>`.
//
// Letterforms are ALWAYS real font outlines (opentype.js → THREE.Shape →
// ExtrudeGeometry), never `THREE.TextGeometry`/typeface JSON (FP-02) and never
// diffusion-drawn (INV-11). DOM-free, relative imports only (FP-05 + dep-guard
// scope). All IO (outline fetch, fill-texture load) is injected, mirroring the
// flat builder's `resolveFillTexture`.

import type { Texture } from 'three';
import type { TextSpec } from '../../prism-graph/types';
import type { TextObjectHandle } from './contract';

// ── Glyph outline data (server outline-gen JSON; opentype units) ───────────
// One path command, mirroring opentype.js `Path.commands` (and THREE.ShapePath
// ops). Coordinates are in font units (see `unitsPerEm`); the client normalizes
// to em-space at build time. `M` moveTo, `L` lineTo, `Q` quadratic, `C` cubic,
// `Z` close.
export interface GlyphOutlineCommand {
  type: 'M' | 'L' | 'Q' | 'C' | 'Z';
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

export interface GlyphOutline {
  /** Horizontal advance in font units (drives kerning-aware layout). */
  advanceWidth: number;
  /** Contour commands. Empty for whitespace glyphs (advance only). */
  commands: GlyphOutlineCommand[];
}

/** A loaded, render-ready set of glyph outlines + the metrics needed to lay
 *  them out self-consistently (no MSDF cross-scale dependency). */
export interface LoadedFontOutlines {
  family: string;
  weight: number;
  /** Whether the resolved face is a real italic (vs synthesized shear). */
  italic: boolean;
  /** Font units per em (normalizer: emScale = 1 / unitsPerEm). */
  unitsPerEm: number;
  ascender: number;
  descender: number;
  /** Underline rule position (font units, baseline-relative) + thickness. */
  underlinePosition: number;
  underlineThickness: number;
  /** Per-character outline, keyed by the literal character. Grows as more
   *  characters are requested (the registry merges). */
  glyphs: Record<string, GlyphOutline>;
  /** Optional pair kerning, keyed `"<a><b>"` → font units. */
  kerning?: Record<string, number>;
  /** 'core' = parsed from a local TTF; 'generated' = on-demand server parse. */
  source: 'core' | 'generated';
  /** True when `bold` was requested but no heavier face existed → faux-bold. */
  syntheticBold?: boolean;
}

// ── Server outline API ─────────────────────────────────────────────────────
// GET /api/prism/fonts/outline?family&weight&chars&italic
//   → LoadedFontOutlines-shaped JSON (minus the runtime-only fields).
// Reuses the css2 raw-TTF fetch + disk cache from src/server/fonts/atlas-gen.ts.
export const FONT_OUTLINE_API = '/api/prism/fonts/outline';

// ── Client outline registry (mirrors FontRegistry memoization) ─────────────
export interface FontOutlineRegistry {
  /** Resolve outlines for a family/weight covering at least `chars`. Memoized
   *  per (family,weight,italic); merges newly-requested chars into the cached
   *  set. Core families (Inter) parse from the local TTF; others hit the
   *  on-demand server endpoint (which caches). */
  resolveOutlines(
    family: string,
    weight: number,
    chars: string,
    italic?: boolean,
  ): Promise<LoadedFontOutlines>;
  /** Synchronous cache peek — returns the set if it covers every char in
   *  `chars` (so createNode can mount synchronously, spec §8), else undefined. */
  peekOutlines(
    family: string,
    weight: number,
    chars: string,
    italic?: boolean,
  ): LoadedFontOutlines | undefined;
  dispose(): void;
}

// ── The 3D builder ─────────────────────────────────────────────────────────
/** Additive build options for the extruded builder. Mirrors the flat
 *  `CreateTextObjectOpts` and adds the injected outline source path is handled
 *  by the caller (outlines passed in pre-resolved, like the flat atlas). */
export interface CreateTextObject3DOpts {
  /** Async pigment loader for `texture` / `ai-texture` face/side fills (the
   *  builder is DOM-free and never loads URLs itself). Factory passes the
   *  runtime's cached `ctx.textureLoader`. */
  resolveFillTexture?: (url: string) => Promise<Texture>;
  /** Device capability tier (INV-9). Drives geometry resolution + whether the
   *  full extrude path runs. The factory resolves this; the builder trusts it. */
  tier?: 'T0' | 'T1' | 'T2';
}

/** Build an extruded TextObject from a spec + pre-resolved outlines. Synchronous
 *  (outlines are pre-loaded by the registry, atlas-style). Returns the SAME
 *  `TextObjectHandle` interface as the flat builder. Implemented in
 *  `text-object-3d.ts`. */
export type CreateTextObject3DFn = (
  spec: TextSpec,
  outlines: LoadedFontOutlines,
  opts?: CreateTextObject3DOpts,
) => TextObjectHandle;
