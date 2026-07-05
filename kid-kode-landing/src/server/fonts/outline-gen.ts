import 'server-only';

// PRISM 3D TEXT — server-side glyph-outline source.
//
// Contract (src/lib/prism/text/contract-3d.ts, FONT_OUTLINE_API): the 3D
// extruded-text builder needs REAL font outlines (opentype.js → THREE.Shape →
// ExtrudeGeometry), never THREE.TextGeometry/typeface JSON (FP-02) and never
// diffusion-drawn letterforms (INV-11). This module parses a TTF with
// opentype.js and emits the JSON-serializable subset of `LoadedFontOutlines`
// (the client fills the runtime-only `source` field).
//
// Resolution + caching MIRRORS src/server/fonts/atlas-gen.ts exactly:
//   - Core families (Inter) read the LOCAL public/fonts/Inter-Variable.ttf.
//     opentype.js@1.3.4 parses the default instance of a variable font — that
//     is the upright/regular master, which is fine here (no axis instancing).
//   - Other families reuse the css2-with-curl-UA RAW .ttf fetch + the SAME
//     .prism-font-cache/ttf/ disk cache, so a TTF downloaded for the atlas bake
//     is reused for outlines (and vice-versa) when weight matches. Italic faces
//     are keyed + fetched separately (css2 `:ital,wght@1,<weight>`).
//
// Coordinate convention (documented for the client normalizer):
//   glyph.getPath(0, 0, font.unitsPerEm) scales glyph units by
//   `1 / unitsPerEm * fontSize` = 1, so command coords come out in RAW FONT
//   UNITS. opentype negates Y in getPath (`-cmd.y`): the design-space outline is
//   Y-up (baseline = 0, ascenders POSITIVE) but the emitted commands are
//   Y-DOWN (baseline = 0, ascenders NEGATIVE — the 'A' apex lands at y≈-1490 for
//   Inter's 2048 em). This is opentype's standard canvas-style space. The client
//   builder normalizes to em-space via emScale = 1 / unitsPerEm and, for a Y-up
//   THREE.Shape, must FLIP Y (multiply Y by -emScale, or negate the whole shape
//   on Y). Metrics (ascender/descender/underlinePosition) stay in the native
//   Y-up design space — sign them consistently with the flipped outline space at
//   layout time.

import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import opentype, { type Glyph as OpentypeGlyph } from 'opentype.js';

import type {
  GlyphOutline,
  GlyphOutlineCommand,
  LoadedFontOutlines,
} from '@/lib/prism/text/contract-3d';

/** Wire subset of LoadedFontOutlines — the runtime-only `source` is set by the
 *  client registry, never on the wire. */
export type FontOutlinesWire = Omit<LoadedFontOutlines, 'source'>;

/** Client asked for a family/weight we cannot resolve (empty family, no css2
 *  truetype url, etc.). The route maps this to a 400 (vs 502 for a real parse/
 *  network failure). Mirrors atlas-gen's UnknownFontError split. */
export class UnknownFontError extends Error {
  readonly name = 'UnknownFontError';
}

/** 'Playfair Display' → 'playfair-display'. Same rule as atlas-gen.ts,
 *  font-registry.ts, and the bake scripts — the slug IS the on-disk contract. */
export function slugifyFamily(family: string): string {
  return family
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Same cache root as atlas-gen.ts so a TTF downloaded for either path is
 *  shared. Upright weights key `<slug>-<weight>.ttf` (atlas-gen's exact key, so
 *  the file is literally reused); italic faces key `<slug>-<weight>-italic.ttf`
 *  to avoid colliding with the upright atlas TTF. */
function ttfCacheDir(): string {
  return join(process.cwd(), '.prism-font-cache', 'ttf');
}

function ttfCacheKey(family: string, weight: number, italic: boolean): string {
  const base = `${slugifyFamily(family)}-${weight}`;
  return italic ? `${base}-italic` : base;
}

/** Core families parsed from a committed local TTF (no network). Inter ships at
 *  public/fonts/Inter-Variable.ttf (the MSDF build input). */
const LOCAL_TTF: Record<string, string> = {
  inter: join(process.cwd(), 'public', 'fonts', 'Inter-Variable.ttf'),
};

/** css2 with a non-browser UA returns a single @font-face whose src is a .ttf
 *  url (no woff2/unicode-range splitting). Only gstatic urls from that response
 *  are ever fetched — never client-supplied URLs. Mirrors atlas-gen.fetchTtf,
 *  extended for italic (`:ital,wght@1,<weight>`). */
async function fetchTtf(family: string, weight: number, italic: boolean): Promise<Buffer> {
  const axis = italic ? `ital,wght@1,${weight}` : `wght@${weight}`;
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:${axis}`;
  const res = await fetch(cssUrl, { headers: { 'User-Agent': 'curl/8' } });
  if (!res.ok) throw new Error(`css2 HTTP ${res.status} for ${family}:${weight}${italic ? ' italic' : ''}`);
  const css = await res.text();
  const m = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/);
  if (!m) {
    throw new UnknownFontError(
      `no truetype url in css2 response for ${family}:${weight}${italic ? ' italic' : ''}`,
    );
  }
  const ttfRes = await fetch(m[1]);
  if (!ttfRes.ok) throw new Error(`ttf HTTP ${ttfRes.status} for ${family}:${weight}${italic ? ' italic' : ''}`);
  return Buffer.from(await ttfRes.arrayBuffer());
}

/** Resolve the on-disk TTF for (family, weight, italic): local file for core
 *  families, else css2-fetched + atomically cached (tmp + rename), mirroring
 *  atlas-gen.resolveTtfPath. */
async function resolveTtfPath(family: string, weight: number, italic: boolean): Promise<string> {
  const local = LOCAL_TTF[slugifyFamily(family)];
  // The local Inter is the upright variable file; only serve it for upright.
  if (local && !italic && existsSync(local)) return local;

  const dir = ttfCacheDir();
  const cached = join(dir, `${ttfCacheKey(family, weight, italic)}.ttf`);
  if (!existsSync(cached)) {
    await fs.mkdir(dir, { recursive: true });
    const bytes = await fetchTtf(family, weight, italic);
    const tmp = `${cached}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmp, bytes);
    await fs.rename(tmp, cached);
  }
  return cached;
}

/** Read a TTF file into an ArrayBuffer slice (opentype.parse needs an
 *  ArrayBuffer, not a Node Buffer — slice to the exact view). */
async function readTtfArrayBuffer(path: string): Promise<ArrayBuffer> {
  const buf = await fs.readFile(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** Map an opentype glyph's path to the contract's command array. getPath at
 *  fontSize = unitsPerEm keeps coords in raw font units (scale 1); opentype
 *  negates Y, so emitted outlines are Y-DOWN (ascenders negative) — the client
 *  flips Y when building the Y-up THREE.Shape (see file header). */
function glyphToOutline(glyph: OpentypeGlyph, unitsPerEm: number): GlyphOutline {
  const path = glyph.getPath(0, 0, unitsPerEm);
  const commands: GlyphOutlineCommand[] = path.commands.map((c) => {
    const out: GlyphOutlineCommand = { type: c.type };
    if (c.x !== undefined) out.x = c.x;
    if (c.y !== undefined) out.y = c.y;
    if (c.x1 !== undefined) out.x1 = c.x1;
    if (c.y1 !== undefined) out.y1 = c.y1;
    if (c.x2 !== undefined) out.x2 = c.x2;
    if (c.y2 !== undefined) out.y2 = c.y2;
    return out;
  });
  return { advanceWidth: glyph.advanceWidth ?? 0, commands };
}

/** Parse outlines for every UNIQUE char in `chars` (plus a guaranteed space),
 *  with metrics + nonzero pair kerning. Returns the wire subset; the client
 *  fills `source`. */
export async function generateFontOutlines(
  family: string,
  weight: number,
  chars: string,
  italic = false,
): Promise<FontOutlinesWire> {
  const slug = slugifyFamily(family);
  if (!slug) throw new UnknownFontError('empty font family');

  const ttfPath = await resolveTtfPath(family, weight, italic);
  const font = opentype.parse(await readTtfArrayBuffer(ttfPath));

  const unitsPerEm = font.unitsPerEm;

  // Unique chars, space always included (whitespace = advance only).
  const unique = Array.from(new Set([' ', ...Array.from(chars)]));

  const glyphs: Record<string, GlyphOutline> = {};
  for (const ch of unique) {
    glyphs[ch] = glyphToOutline(font.charToGlyph(ch), unitsPerEm);
  }

  // Adjacent-pair kerning across the REQUESTED string (order matters); keep
  // only nonzero values. Keyed "<a><b>" per the contract.
  const kerning: Record<string, number> = {};
  const seq = Array.from(chars);
  for (let i = 0; i < seq.length - 1; i += 1) {
    const a = seq[i];
    const b = seq[i + 1];
    const key = `${a}${b}`;
    if (key in kerning) continue;
    const value = font.getKerningValue(font.charToGlyph(a), font.charToGlyph(b));
    if (value) kerning[key] = value;
  }

  const post = font.tables.post;

  const wire: FontOutlinesWire = {
    family,
    weight,
    italic,
    unitsPerEm,
    ascender: font.ascender,
    descender: font.descender,
    underlinePosition: post?.underlinePosition ?? Math.round(-0.1 * unitsPerEm),
    underlineThickness: post?.underlineThickness ?? Math.round(0.05 * unitsPerEm),
    glyphs,
  };
  if (Object.keys(kerning).length > 0) wire.kerning = kerning;
  return wire;
}
