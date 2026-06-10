// P1 TEXT SYSTEM (C) — POST /api/prism/text-fill
//
// AI texture-fill generation endpoint (contract.ts "AI texture-fill",
// criterion 28 path). Body: { prompt: string, count?: number }. Delegates to
// the FLAGGED hook src/server/text-fill/generate.ts, which returns
// { wired: false, suggestions: [] } until the FLUX-family prompt→texture
// endpoint is wired (canvas-spec §7.4 + §20 re-verify note). The fill is a
// TEXTURE poured into the MSDF glyph coverage — never letterforms (INV-11).
//
// Errors are honest (same style as the fonts atlas route): 400 for a missing
// or malformed prompt/count; the flagged hook itself cannot fail.

import { generateTextFills } from '@/server/text-fill/generate';

export const runtime = 'nodejs';

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
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

  const { prompt, count } = body as { prompt?: unknown; count?: unknown };
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

  const result = await generateTextFills(prompt, countNum);
  return new Response(JSON.stringify(result), {
    headers: {
      'Content-Type': 'application/json',
      // Generation results (once wired) vary per call — never cache.
      'Cache-Control': 'no-store',
    },
  });
}
