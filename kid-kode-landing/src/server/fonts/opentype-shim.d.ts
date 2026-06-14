// Minimal ambient types for opentype.js@1.3.4 — @types/opentype.js is NOT
// installed and the package ships no bundled .d.ts. This declares ONLY the
// members src/server/fonts/outline-gen.ts uses (parse + the glyph/path/font
// surface for outline extraction). Keep it minimal and accurate; if more of the
// API is needed later, extend rather than widen to `any`.
//
// opentype.js is CommonJS (dist/opentype.js). Under esModuleInterop the default
// import resolves to the module namespace, so `opentype.parse(buffer)`,
// `opentype.Font`, etc. are all reachable off the default export.

declare module 'opentype.js' {
  /** One raw path command in font units (opentype Path.commands). */
  export interface PathCommand {
    type: 'M' | 'L' | 'C' | 'Q' | 'Z';
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }

  export interface Path {
    commands: PathCommand[];
  }

  export interface Glyph {
    index: number;
    advanceWidth?: number;
    /** Scales glyph units by `1 / unitsPerEm * fontSize` and flips Y. */
    getPath(x?: number, y?: number, fontSize?: number): Path;
  }

  export interface PostTable {
    underlinePosition?: number;
    underlineThickness?: number;
  }

  export interface FontTables {
    post?: PostTable;
    [table: string]: unknown;
  }

  export interface Font {
    unitsPerEm: number;
    ascender: number;
    descender: number;
    tables: FontTables;
    charToGlyph(c: string): Glyph;
    /** Accepts Glyph objects or glyph indices; returns font-unit kerning. */
    getKerningValue(leftGlyph: Glyph | number, rightGlyph: Glyph | number): number;
  }

  /** Parse an in-memory TrueType/OpenType buffer (ArrayBuffer). */
  export function parse(buffer: ArrayBuffer): Font;

  interface OpenType {
    parse(buffer: ArrayBuffer): Font;
  }

  const opentype: OpenType;
  export default opentype;
}
