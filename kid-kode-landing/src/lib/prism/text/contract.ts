// Prism Text System — FROZEN CONTRACT (Canvas-spec §7; INV-11).
//
// Wave-0 contract for the P1 TEXT SYSTEM build. Parallel build agents code
// against THIS file; do not change signatures without updating every consumer
// in the same wave.
//
// Architecture (decided 2026-06-10 after §20 re-verify):
// - Letterforms are ALWAYS real font glyphs via MSDF (INV-11). The atlas data
//   format is BMFont JSON produced by `msdf-bmfont-xml` — the same format the
//   runtime's `ctx.fontAtlas` (three-msdf-text-webgpu) already consumes.
// - `three-msdf-text-webgpu` stays the whole-string path for runtime labels.
//   The Canvas TextObject is a PER-UNIT builder: glyph quads laid out from the
//   BMFont metrics (kerning-aware, DOM-free — works in vitest), merged per
//   animation unit (glyph | word | line), one Mesh per unit named `glyph-<i>`
//   so the 36 existing text-animation primitives animate REAL letterforms
//   unchanged (they traverse for `glyph-*` children and require materials
//   exposing color/emissive/emissiveIntensity/opacity).
// - The unit material is a TSL `MeshStandardNodeMaterial` whose `opacityNode`
//   multiplies the MSDF coverage (median-of-RGB + fwidth screen-space AA) with
//   the live `material.opacity` property — so the standard property surface
//   (`color`, `emissive`, `emissiveIntensity`, `opacity`, `transparent`) keeps
//   working for every primitive, while the letter shape comes from the font.
// - Fills (gradient / texture / ai-texture) bind to a SECOND uv attribute
//   (`aBlockUv`, 0..1 over the whole text block) and MULTIPLY with the live
//   material color so material-driven primitives still tint textured fills.
//   AI fills are textures poured into the coverage mask — never letterforms.
//
// DOM-free by construction (FP-05 hygiene): no window/document anywhere in
// this directory. Texture/JSON IO is injected (same pattern as
// runtime/shared/text.ts). Relative imports only (dep-guard).

import type { Group, Mesh, Texture } from 'three';
import type { TextSpec } from '../../prism-graph/types';

// ── BMFont atlas data (msdf-bmfont-xml JSON output) ────────────────────────
// Self-contained mirror of the fields the layout engine reads (kept local so
// tests need no package import; structurally compatible with the
// three-msdf-text-webgpu `BMFontJSON`).
export interface MsdfChar {
  id: number;
  char?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  xoffset: number;
  yoffset: number;
  xadvance: number;
  page: number;
}
export interface MsdfKerning {
  first: number;
  second: number;
  amount: number;
}
export interface MsdfFontData {
  pages: unknown[];
  chars: MsdfChar[];
  kernings?: MsdfKerning[];
  info?: { face?: string; size?: number; padding?: [number, number, number, number] };
  common: { lineHeight: number; base: number; scaleW: number; scaleH: number };
  /** msdf-bmfont-xml emits distanceField info; distanceRange drives outline width. */
  distanceField?: { fieldType?: string; distanceRange?: number };
}

/** A loaded, render-ready font atlas. `texture` is SHARED (owned by the font
 *  registry — TextObject.dispose() must NOT dispose it). */
export interface LoadedFontAtlas {
  family: string;
  weight: number;
  texture: Texture;
  data: MsdfFontData;
  /** 'core' = pre-baked shipped atlas; 'generated' = on-demand server-baked. */
  source: 'core' | 'generated';
}

// ── Layout (pure, DOM-free, unit-tested) ───────────────────────────────────
/** One animation unit (a glyph, word, or line depending on `decompose`).
 *  Quads are in unit-local coordinates with the unit's CENTER at the origin
 *  (so scale/rotation animate around the unit's own center, exactly like the
 *  legacy proxy glyph meshes). */
export interface TextLayoutUnit {
  /** Unit center in text-block space (block centered on origin). */
  center: { x: number; y: number };
  /** One entry per glyph quad in this unit. */
  quads: TextLayoutQuad[];
  /** The source string slice this unit renders (for captions / debugging). */
  text: string;
  /** Indices for word/line bookkeeping. */
  lineIndex: number;
  wordIndex: number;
}
export interface TextLayoutQuad {
  /** Quad corners in UNIT-LOCAL scene units (x right, y up), [minX,minY,maxX,maxY]. */
  rect: [number, number, number, number];
  /** Atlas UVs [minU,minV,maxU,maxV] — three.js convention (v=0 at texture
   *  bottom, i.e. flipY-true TextureLoader default). */
  uv: [number, number, number, number];
  /** Block UVs [minU,minV,maxU,maxV] 0..1 over the whole text block (for
   *  gradient/texture fills via the `aBlockUv` attribute). */
  blockUv: [number, number, number, number];
}
export interface TextLayoutResult {
  units: TextLayoutUnit[];
  /** Total block size in scene units. */
  width: number;
  height: number;
}

/** Lay out `spec.content` against the atlas metrics. Pure + deterministic.
 *  Implemented in `msdf-layout.ts`. */
export type LayoutTextFn = (spec: TextSpec, data: MsdfFontData) => TextLayoutResult;

// ── The TextObject (built scene object for renderMode:'text') ──────────────
export const TEXT_OBJECT_NAME = 'text-object';
/** Frozen attribute name for the block-space uv channel (fills sample it). */
export const TEXT_BLOCK_UV_ATTR = 'aBlockUv';
/** Unit meshes are named `glyph-<i>` (global index across the whole object) —
 *  the SAME naming contract the text-animation primitives already traverse. */
export const textUnitName = (i: number): string => `glyph-${i}`;

export interface TextObjectHandle {
  /** Group named TEXT_OBJECT_NAME; direct children are the unit meshes
   *  `glyph-0..N-1` (FLAT — primitives use subject.children / traverse). */
  object: Group;
  /** The unit meshes, in reading order. */
  units: Mesh[];
  /** The spec this object currently renders (resolved over TEXT_SPEC_DEFAULT). */
  readonly spec: TextSpec;
  /** Re-render with a new spec IN PLACE (same Group identity). Re-font /
   *  resize / restyle must be instant: geometry rebuilds from cached atlas
   *  data; NO image artifact re-render (criterion 26). When the new spec needs
   *  a different atlas, pass it via `atlas`. */
  setSpec(next: TextSpec, atlas?: LoadedFontAtlas): void;
  /** Block measurements in scene units. */
  measure(): { width: number; height: number };
  /** Dispose unit geometries + materials. NEVER disposes the shared atlas
   *  texture (registry-owned). */
  dispose(): void;
}

/** Build a TextObject from a spec + a loaded atlas. Synchronous (atlas is
 *  pre-loaded by the font registry). Implemented in `text-object.ts`. */
export type CreateTextObjectFn = (
  spec: TextSpec,
  atlas: LoadedFontAtlas,
) => TextObjectHandle;

// ── Font registry (client-side cache; criterion 27) ────────────────────────
export interface FontManifestEntry {
  family: string;
  category: string;
  weights: number[];
  /** True when a pre-baked atlas ships in public/prism-assets/fonts/. */
  core: boolean;
}

export interface FontRegistry {
  /** Full library list (target: the Google Fonts catalog) + core flags. */
  listFonts(): Promise<FontManifestEntry[]>;
  /** Resolve an atlas: core → static asset fetch; non-core → request the
   *  on-demand server bake (which CACHES — criterion 27), then load. Always
   *  memoized per (family, weight): second resolve returns the same object. */
  resolveAtlas(family: string, weight?: number): Promise<LoadedFontAtlas>;
  /** Synchronous cache peek (returns undefined when not yet resolved). */
  peekAtlas(family: string, weight?: number): LoadedFontAtlas | undefined;
  dispose(): void;
}

// ── Server atlas bake API (criterion 27) ───────────────────────────────────
// GET /api/prism/fonts                      → { fonts: FontManifestEntry[] }
// GET /api/prism/fonts/atlas?family&weight  → MsdfFontData JSON
//       (+ `&asset=png` → the atlas PNG binary)
//       Response header `x-prism-font-cache: hit|miss` proves the cache.
// Server implementation: `src/server/fonts/atlas-gen.ts` (server-only),
// disk cache under `.prism-font-cache/` at the kid-kode-landing root.
export const FONTS_API_BASE = '/api/prism/fonts';

// ── AI texture-fill (criterion 28 path; INV-11) ────────────────────────────
// The masking path is REAL in this build: any texture (procedural or
// generated) is poured into the MSDF glyph coverage; letterforms are
// untouched. The cloud generation endpoint is a FLAGGED HOOK (no FAL key in
// this environment): `src/server/text-fill/generate.ts` exposes the contract
// and returns `{ wired: false }` until the harness-side endpoint lands.
export interface TextFillSuggestion {
  /** Display label ("Molten Gold #1"). */
  label: string;
  /** Texture URL (local procedural bake or generated asset). */
  url: string;
  /** Where it came from — 'procedural-local' today; 'generated' once wired. */
  source: 'procedural-local' | 'generated';
}
