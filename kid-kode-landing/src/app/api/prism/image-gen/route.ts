// P3 ASSETS (C) — POST /api/prism/image-gen
//
// AI image generation endpoint for the Add Object pipeline. Body:
// { prompt: string, count?: number }. Delegates to the FLAGGED hook
// src/server/image-gen/generate.ts, which returns { wired: false, images: [] }
// until the fal.ai FLUX-family prompt→image endpoint is wired (re-verify the
// current best model id at wiring time — see the hook's header). Generated
// assets land in a node's `visual.sourceAsset`, same as uploads and URLs.
//
// Errors are honest (same style as the text-fill route): 400 for a missing
// or malformed prompt/count; the flagged hook itself cannot fail.

import { generateImages } from '@/server/image-gen/generate';

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

  const result = await generateImages(prompt, countNum);
  return new Response(JSON.stringify(result), {
    headers: {
      'Content-Type': 'application/json',
      // Generation results (once wired) vary per call — never cache.
      'Cache-Control': 'no-store',
    },
  });
}
