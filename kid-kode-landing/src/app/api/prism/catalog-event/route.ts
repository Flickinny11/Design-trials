// PRISM FLIGHT RECORDER — template-catalog ingest route (W-TPL, D6).
//
// The "new hub from template" and "drop a section" actions originate in CLIENT
// chrome (the galaxy picker on `/`). "Server-side capture only" is honored the
// same way the edit-event beacon does it (flight-recorder/route.ts): the picker
// fires a minimal fire-and-forget BEACON here; ALL recording logic (consent, PII
// scrub, sink write) runs server-side inside `recordCatalog`. Plain
// request/response POST — the same shape as every other /api/prism/* route, NOT
// a realtime channel (I-SSE intact). INGEST-ONLY: never returns recorded data.
// Fail-open: a bad beacon or recorder outage always 200s and never errors the
// picker.

import { recordCatalog } from '@/lib/flight-recorder';
import type { PrismCatalogStage } from '@/lib/flight-recorder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STAGES: ReadonlySet<string> = new Set([
  'browse',
  'instantiate-hub',
  'drop-section',
]);

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function numOrU(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const stage = (str(body.stage) ?? 'browse') as PrismCatalogStage;
    if (!STAGES.has(stage as string)) {
      // Unknown stage — accept silently (ingest never rejects the picker).
      return Response.json({ ok: true, recorded: false });
    }

    recordCatalog({
      touchpoint: 'catalog',
      actor: {
        projectId: str(body.projectId),
        userRef: str(body.userRef),
        // Client-supplied personal identifiers are NOT trusted for scrub; the
        // unconditional email/key patterns still redact any that appear in text.
      },
      stage,
      template_slug: str(body.template_slug),
      archetype: str(body.archetype),
      primary_family: str(body.primary_family),
      section_slug: str(body.section_slug),
      section_kind: str(body.section_kind),
      route: str(body.route),
      node_count: numOrU(body.node_count),
      hub_ref: str(body.hub_ref),
      query: str(body.query),
      ok: typeof body.ok === 'boolean' ? body.ok : true,
      detail: str(body.detail),
    });

    return Response.json({ ok: true, recorded: true });
  } catch {
    // Fail-open: never surface a recorder error to the picker.
    return Response.json({ ok: true, recorded: false });
  }
}
