// P1 TEXT SYSTEM (C) — POST /api/prism/text-fill
//
// AI texture-fill generation endpoint (contract.ts "AI texture-fill",
// criterion 28 path). Two body shapes:
//   - { probe: true } → CHEAP capability check: returns { wired } reflecting
//     whether cloud texture-fill is configured on the server. No generation,
//     no fal call. (Wired-ness is resolved by the server-only generate module
//     via isTextFillWired, so FAL_KEY is never read in this route — INV-19 /
//     FP-07.)
//   - { prompt: string, count?: number } → delegates to
//     src/server/text-fill/generate.ts, which generates seamless tileable
//     MATERIAL textures via the shared media-gen fal wrapper (fal-ai/flux-2)
//     and returns { wired: true, suggestions } (or { wired: false,
//     suggestions: [] } when FAL_KEY is absent or every candidate failed).
// The fill is a TEXTURE poured into the MSDF glyph coverage — never
// letterforms (INV-11).
//
// Errors are honest (same style as the fonts atlas / assets routes): 400 for a
// missing or malformed prompt/count; any generation failure degrades to
// { wired: false, suggestions: [] } rather than 500-ing the picker.

import { generateTextFills, isTextFillWired } from '@/server/text-fill/generate';

export const runtime = 'nodejs';
// Capability probe + generation both vary per request / per environment — never
// statically optimized or cached (mirrors the assets route's no-store policy).
export const dynamic = 'force-dynamic';

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      // Generation results vary per call; the probe reflects live env — never cache.
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('invalid JSON body', 400);
  }
  if (!body || typeof body !== 'object') {
    return jsonError('expected a JSON object body', 400);
  }

  const { prompt, count, probe } = body as {
    prompt?: unknown;
    count?: unknown;
    probe?: unknown;
  };

  // Cheap capability probe: report wired-ness without generating anything.
  if (probe === true) {
    return json({ wired: isTextFillWired() });
  }

  if (typeof prompt !== 'string' || prompt.trim() === '') {
    return jsonError('missing required field: prompt (non-empty string)', 400);
  }
  let countNum: number | undefined;
  if (count !== undefined) {
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
      return jsonError(`invalid count: ${String(count)} (expected positive integer)`, 400);
    }
    countNum = count;
  }

  try {
    const result = await generateTextFills(prompt, countNum);
    return json(result);
  } catch {
    // Any unexpected failure degrades to the unwired shape the FillEditor reads
    // (it then falls back to local procedural swatches) — never a 500 here.
    return json({ wired: false, suggestions: [] });
  }
}
