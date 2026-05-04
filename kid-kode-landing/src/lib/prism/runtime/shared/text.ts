// MSDF font atlas loader — wires `three-msdf-text-webgpu` (and the build-time
// `msdf-bmfont-xml` atlas output) into the runtime so node modules can call
// `ctx.fontAtlas` to render crisp text at any zoom.
//
// Spec: PRISM-RENDERER-MIGRATION-SPEC.md §3 (Tech Stack) and §13 (Editor —
// Text rendering). Forbidden alternatives: THREE.TextGeometry, DOM text
// overlays, troika-three-text.

import type { Object3D, ColorRepresentation } from 'three';
import type { BMFontJSON } from 'three-msdf-text-webgpu';

export interface TextOpts {
  fontSize?: number;
  color?: ColorRepresentation;
  align?: 'left' | 'center' | 'right';
  maxWidthPx?: number;
  letterSpacingPx?: number;
}

export interface CreateFontAtlasOptions {
  /** Inject already-loaded atlas + font JSON (used for tests + offline builds). */
  preloaded?: {
    atlas: import('three').Texture;
    data: BMFontJSON;
  };
}

export interface FontAtlasHandle {
  /** True once `load()` resolves (or `preloaded` was provided). */
  readonly ready: boolean;
  /** Load the MSDF atlas PNG + BMFont JSON. Idempotent: a second call with
   *  the same URLs resolves immediately. */
  load(atlasUrl: string, fontJsonUrl: string): Promise<void>;
  /** Build a `THREE.Mesh<MSDFTextGeometry, MSDFTextNodeMaterial>` for the
   *  given content. Throws if not yet ready. */
  createText(content: string, opts?: TextOpts): Object3D;
  /** Dispose of the atlas texture and any cached materials. */
  dispose(): void;
}

export function createFontAtlas(
  _options?: CreateFontAtlasOptions,
): FontAtlasHandle {
  throw new Error('createFontAtlas: not implemented (T02)');
}
