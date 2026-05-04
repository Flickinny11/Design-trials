// MSDF font atlas loader — wires `three-msdf-text-webgpu` (and the build-time
// `msdf-bmfont-xml` atlas output) into the runtime so node modules can call
// `ctx.fontAtlas` to render crisp text at any zoom.
//
// Spec: PRISM-RENDERER-MIGRATION-SPEC.md §3 (Tech Stack) and §13 (Editor —
// Text rendering). Forbidden alternatives: THREE.TextGeometry, DOM text
// overlays, troika-three-text. Implemented in T02.

export interface FontAtlasHandle {
  // Anticipated surface (T02):
  //   load(atlasUrl: string, fontJsonUrl: string): Promise<void>
  //   createText(content: string, opts?: TextOpts): Object3D
  //   dispose(): void
  readonly __t01Stub: true;
}

export function createFontAtlas(): FontAtlasHandle {
  throw new Error('createFontAtlas: not implemented (T02)');
}
