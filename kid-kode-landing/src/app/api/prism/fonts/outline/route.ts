// PRISM 3D TEXT — GET /api/prism/fonts/outline?family=&weight=&chars=&italic=
//
// Server glyph-outline endpoint (contract-3d.ts, FONT_OUTLINE_API). Parses a
// real font TTF with opentype.js and returns the JSON-serializable subset of
// `LoadedFontOutlines` (the client fills the runtime-only `source` field). The
// 3D extruded-text builder turns these outlines into THREE.Shape →
// ExtrudeGeometry — never THREE.TextGeometry/typeface JSON (FP-02).
//
// Caching mirrors the atlas route: the downloaded TTF lands in the SAME
// .prism-font-cache/ttf/ store as the atlas bake, so the first outline request
// for an already-baked (family, weight) is a disk hit. The `x-prism-font-cache`
// header reports hit|miss for that source TTF.
//
// Errors are honest: 400 for missing/invalid params and unresolvable families
// (UnknownFontError), 502 when a legitimate parse/network fetch fails, with the
// real reason in the body.

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { generateFontOutlines, slugifyFamily, UnknownFontError } from '@/server/fonts/outline-gen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Whether the source TTF for (family, weight, italic) is already on disk —
 *  drives the `x-prism-font-cache` hit|miss header. Core families (local TTF,
 *  upright) and previously-fetched faces count as a hit. */
function isCachedTtf(family: string, weight: number, italic: boolean): boolean {
  const slug = slugifyFamily(family);
  if (slug === 'inter' && !italic) {
    return existsSync(join(process.cwd(), 'public', 'fonts', 'Inter-Variable.ttf'));
  }
  const base = `${slug}-${weight}${italic ? '-italic' : ''}`;
  return existsSync(join(process.cwd(), '.prism-font-cache', 'ttf', `${base}.ttf`));
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const family = url.searchParams.get('family');
  const weightRaw = url.searchParams.get('weight') ?? '400';
  const chars = url.searchParams.get('chars');
  const italicRaw = url.searchParams.get('italic');

  if (!family) {
    return jsonError('missing required query param: family', 400);
  }
  if (chars === null || chars.length === 0) {
    return jsonError('missing required query param: chars', 400);
  }
  const weight = Number(weightRaw);
  if (!Number.isInteger(weight) || weight < 1 || weight > 1000) {
    return jsonError(`invalid weight: ${weightRaw}`, 400);
  }
  const italic = italicRaw === '1' || italicRaw === 'true';

  // hit|miss is decided BEFORE generation (generateFontOutlines may write the
  // TTF on a miss), mirroring the atlas route's pre-bake cache check.
  const cache: 'hit' | 'miss' = isCachedTtf(family, weight, italic) ? 'hit' : 'miss';

  let wire;
  try {
    wire = await generateFontOutlines(family, weight, chars, italic);
  } catch (err) {
    if (err instanceof UnknownFontError) {
      return jsonError(err.message, 400);
    }
    const reason = err instanceof Error ? err.message : String(err);
    return jsonError(`outline generation failed for ${family}:${weight} — ${reason}`, 502);
  }

  return new Response(JSON.stringify(wire), {
    headers: {
      'x-prism-font-cache': cache,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
