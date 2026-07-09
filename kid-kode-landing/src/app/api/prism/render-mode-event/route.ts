// PRISM FLIGHT RECORDER — render-mode ingest route (W-2D).
//
// The 2d/3d hub-mode toggles originate in CLIENT chrome (the canvas camera
// HUD chip + the Hub Inspector Visual tab). "Server-side capture only" is
// honored the same way the catalog beacon does it: the toggle fires a minimal
// fire-and-forget BEACON here; ALL recording logic (consent, PII scrub, sink
// write) runs server-side inside `recordRenderMode`. Plain request/response
// POST — the same shape as every other /api/prism/* route, NOT a realtime
// channel (I-SSE intact). INGEST-ONLY: never returns recorded data.
// Fail-open: a bad beacon or recorder outage always 200s and never errors
// the toggle.

import { recordRenderMode } from '@/lib/flight-recorder';
import type { PrismRenderModeSurface } from '@/lib/flight-recorder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SURFACES: ReadonlySet<string> = new Set([
  'canvas-hud',
  'hub-inspector',
  'conductor',
  'template',
]);

const MODES: ReadonlySet<string> = new Set(['3d', '2d']);

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function mode(v: unknown): string | undefined {
  const s = str(v);
  return s && MODES.has(s) ? s : undefined;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const surface = (str(body.surface) ?? 'hub-inspector') as PrismRenderModeSurface;
    if (!SURFACES.has(surface as string)) {
      // Unknown surface — accept silently (ingest never rejects the toggle).
      return Response.json({ ok: true, recorded: false });
    }

    recordRenderMode({
      touchpoint: 'render-mode',
      actor: {
        projectId: str(body.projectId),
        userRef: str(body.userRef),
        // Client-supplied personal identifiers are NOT trusted for scrub; the
        // unconditional email/key patterns still redact any that appear in text.
      },
      surface,
      hub_ref: str(body.hub_ref),
      from_mode: mode(body.from_mode),
      to_mode: mode(body.to_mode),
      hub_hint: str(body.hub_hint),
      ok: typeof body.ok === 'boolean' ? body.ok : true,
      detail: str(body.detail),
    });

    return Response.json({ ok: true, recorded: true });
  } catch {
    // Fail-open: never surface a recorder error to the toggle.
    return Response.json({ ok: true, recorded: false });
  }
}
