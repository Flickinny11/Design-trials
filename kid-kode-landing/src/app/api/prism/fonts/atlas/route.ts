// P1 TEXT SYSTEM (A2) — GET /api/prism/fonts/atlas?family=&weight=&asset=json|png
//
// On-demand MSDF atlas endpoint (contract.ts "Server atlas bake API",
// criterion 27). First request for a (family, weight) bakes via
// src/server/fonts/atlas-gen.ts and caches under .prism-font-cache/atlases/;
// every response carries `x-prism-font-cache: hit|miss` so the cache is
// provable from the network side.
//
// Errors are honest: 400 for families/weights the committed manifest does not
// list (UnknownFontError), 502 when a legitimate bake fails (network/TTF/
// generator), with the real reason in the body.

import { promises as fs } from 'node:fs';

import { generateOrGetAtlas, UnknownFontError } from '@/server/fonts/atlas-gen';

export const runtime = 'nodejs';

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const family = url.searchParams.get('family');
  const weightRaw = url.searchParams.get('weight') ?? '400';
  const asset = url.searchParams.get('asset') ?? 'json';

  if (!family) {
    return jsonError('missing required query param: family', 400);
  }
  const weight = Number(weightRaw);
  if (!Number.isInteger(weight) || weight < 1 || weight > 1000) {
    return jsonError(`invalid weight: ${weightRaw}`, 400);
  }
  if (asset !== 'json' && asset !== 'png') {
    return jsonError(`invalid asset: ${asset} (expected json|png)`, 400);
  }

  let result;
  try {
    result = await generateOrGetAtlas(family, weight);
  } catch (err) {
    if (err instanceof UnknownFontError) {
      return jsonError(err.message, 400);
    }
    const reason = err instanceof Error ? err.message : String(err);
    return jsonError(`atlas generation failed for ${family}:${weight} — ${reason}`, 502);
  }

  // Criterion 27 proof: hit|miss on EVERY success response.
  const cacheHeader = { 'x-prism-font-cache': result.cache };

  if (asset === 'png') {
    const bytes = await fs.readFile(result.pngPath);
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...cacheHeader,
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  return new Response(JSON.stringify(result.json), {
    headers: {
      ...cacheHeader,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
