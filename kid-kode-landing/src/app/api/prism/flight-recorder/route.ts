// PRISM FLIGHT RECORDER — additive ingest route (W-FR, deviation D2).
//
// The editor's accept (keep) / undo / regen / self-heal actions originate in
// CLIENT chrome (node-agent-controller). "Server-side capture only" is honored
// by having the controller fire a minimal fire-and-forget BEACON here; ALL
// recording logic (validation, consent, PII scrub, sink write) runs server-side
// inside this route. This is a plain request/response POST — the same shape as
// every other /api/prism/* route — NOT a realtime channel (I-SSE intact). The
// route is INGEST-ONLY: it never returns recorded data (the dev ledger reads via
// a separate dev-only surface). Fail-open: a bad beacon or recorder outage never
// errors the editor (it always 200s).

import { recordEditEvent } from '@/lib/flight-recorder';
import type { PrismTouchpoint, PrismUserDecision } from '@/lib/flight-recorder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BeaconKind = 'keep' | 'accept' | 'undo' | 'regen' | 'self-heal';

const DECISION: Record<BeaconKind, PrismUserDecision> = {
  keep: 'keep',
  accept: 'accept',
  undo: 'undo',
  regen: 'regen',
  'self-heal': 'accept',
};

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const kind = (typeof body.kind === 'string' ? body.kind : '') as BeaconKind;
    if (!(kind in DECISION)) {
      // Unknown beacon — accept silently (ingest never rejects the editor).
      return Response.json({ ok: true, recorded: false });
    }
    const nodeIds = asStringArray(body.nodeIds);
    const touchpoint: PrismTouchpoint = kind === 'self-heal' ? 'self-heal' : 'node-edit';

    recordEditEvent({
      touchpoint,
      actor: {
        projectId: typeof body.projectId === 'string' ? body.projectId : undefined,
        userRef: typeof body.userRef === 'string' ? body.userRef : undefined,
        // We do NOT trust client-supplied personal identifiers for scrub; the
        // unconditional email/key patterns still redact any that appear in text.
      },
      plan_ref: typeof body.planRef === 'string' ? body.planRef : undefined,
      applied_count: typeof body.appliedCount === 'number' ? body.appliedCount : undefined,
      before: (body.before ?? undefined) as Record<string, unknown> | undefined,
      after: (body.after ?? undefined) as Record<string, unknown> | undefined,
      prism: {
        'prism.user.decision': DECISION[kind],
        'prism.node.id': nodeIds[0],
        'prism.edit.instruction': typeof body.instruction === 'string' ? body.instruction : undefined,
        'prism.edit.fields': asStringArray(body.fields),
        'prism.verify.judge': kind === 'self-heal' ? 'automated' : undefined,
      },
    });

    return Response.json({ ok: true, recorded: true });
  } catch {
    // Fail-open: never surface a recorder error to the editor.
    return Response.json({ ok: true, recorded: false });
  }
}
