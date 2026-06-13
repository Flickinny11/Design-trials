// CANVAS-FINAL — POST /api/prism/image-gen
//
// WIRED (was a flagged stub). The Add Object / Image flyout's "Generate" calls
// this with { prompt, count?, quality?, width?, height? }. It runs through the
// Prism Media Generator (src/server/media-gen) → persists each image through
// the content-hash asset store → returns the wired shape the flyout expects:
//   { wired: true, url, width, height, images: [{url,width,height}], credits, meter }
// Backward-compatible: the legacy flyout reads `wired` + top-level `url`.
//
// Honest errors: 400 for a missing prompt; 503 when the build generation budget
// is spent (BudgetExceededError → plain-language pause, never faked output).
// FAL_KEY is never read or printed here (server-only provider owns it).

import { handleGenerate, GenerateError } from '@/server/media-gen/handle';

export const runtime = 'nodejs';

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, wired: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
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
  const { prompt, count, quality, width, height } = body as {
    prompt?: unknown; count?: unknown; quality?: unknown; width?: unknown; height?: unknown;
  };
  if (typeof prompt !== 'string' || prompt.trim() === '') {
    return jsonError('Describe the picture you want.', 400);
  }

  try {
    const result = await handleGenerate({
      kind: 'image',
      prompt,
      count: typeof count === 'number' ? count : undefined,
      quality: quality === 'studio' ? 'studio' : quality === 'standard' ? 'standard' : undefined,
      width: typeof width === 'number' ? width : undefined,
      height: typeof height === 'number' ? height : undefined,
      purpose: 'image flyout generate',
    });
    const first = result.images?.[0];
    return new Response(
      JSON.stringify({
        ok: true,
        wired: true,
        url: first?.url,
        width: first?.width,
        height: first?.height,
        images: result.images,
        model: result.model,
        credits: result.credits,
        meter: result.meter,
      }),
      { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    if (e instanceof GenerateError) return jsonError(e.message, e.status);
    const msg = e instanceof Error ? e.message : 'Generation failed.';
    return jsonError(msg, 500);
  }
}
