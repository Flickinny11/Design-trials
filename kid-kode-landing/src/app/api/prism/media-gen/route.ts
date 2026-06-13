// CANVAS-FINAL — /api/prism/media-gen
//
// The unified Prism Media Generator endpoint the Change Artifact Prompt wizard
// (canvas-spec §12.2) drives.
//
//   GET  → { ok, catalog: PrismModelPublic[], meter }  (picker model list + credit meter)
//   POST → { kind, model, images?|meshUrl?|videoUrl?|compose?, credits, meter }
//
// POST body: { kind: 'image'|'edit'|'3d'|'video'|'code', prompt?, quality?,
//   count?, width?, height?, imageUrl?, imageUrls?, durationSeconds? }.
//
// All generation flows through src/server/media-gen/handle (one code path:
// budget guard → provider → persist → meter). The PROVIDER NAME is never in the
// payload — the client sees only Prism-branded model ids. FAL_KEY is never read
// or printed here.

import { handleGenerate, GenerateError, type GenerateKind } from '@/server/media-gen/handle';
import { publicCatalog } from '@/server/media-gen/catalog';
import { getCreditMeter } from '@/server/media-gen/credits';

export const runtime = 'nodejs';

const KINDS: ReadonlySet<string> = new Set(['image', 'edit', '3d', 'video', 'code']);

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function GET(): Promise<Response> {
  return new Response(
    JSON.stringify({ ok: true, catalog: publicCatalog(), meter: getCreditMeter() }),
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('invalid JSON body', 400);
  }
  if (!body || typeof body !== 'object') return jsonError('expected a JSON object body', 400);

  const b = body as Record<string, unknown>;
  const kind = b.kind;
  if (typeof kind !== 'string' || !KINDS.has(kind)) {
    return jsonError('Unknown generation type.', 400);
  }

  const imageUrls = Array.isArray(b.imageUrls)
    ? b.imageUrls.filter((u): u is string => typeof u === 'string').slice(0, 4)
    : undefined;

  try {
    const result = await handleGenerate({
      kind: kind as GenerateKind,
      prompt: typeof b.prompt === 'string' ? b.prompt : undefined,
      quality: b.quality === 'studio' ? 'studio' : b.quality === 'standard' ? 'standard' : undefined,
      count: typeof b.count === 'number' ? b.count : undefined,
      width: typeof b.width === 'number' ? b.width : undefined,
      height: typeof b.height === 'number' ? b.height : undefined,
      imageUrl: typeof b.imageUrl === 'string' ? b.imageUrl : undefined,
      imageUrls,
      durationSeconds: typeof b.durationSeconds === 'number' ? b.durationSeconds : undefined,
      purpose: 'change-artifact prompt wizard',
    });
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    if (e instanceof GenerateError) return jsonError(e.message, e.status);
    const msg = e instanceof Error ? e.message : 'Generation failed.';
    return jsonError(msg, 500);
  }
}
