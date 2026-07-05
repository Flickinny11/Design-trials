// PRISM SHELL — DOMAIN MONITOR WEBHOOK (SHELL W5B / E16, 2026-07-05)
//
// POST /api/prism/domains/webhook — the unauthenticated endpoint Entri Monitor
// posts DNS/domain state changes to. It is UNAUTHENTICATED (no session — the
// caller is Entri) but AUTHENTICATED by an HMAC signature over the payload; the
// deploy is resolved via the global domain index and only its domainStatus is
// touched (I11 wall via the tenant store). A bad signature or unknown deploy →
// a clean 202 that reveals nothing (webhooks must not leak existence).

import {
  domainWebhookEnvelopeSchema,
} from '../../../../../../packages/shared-interfaces/src/prism-domains';
import { recordMonitorWebhook } from '../../../../../server/domains/domain-service';

export async function POST(req: Request) {
  let envelope: unknown;
  try {
    envelope = await req.json();
  } catch {
    return Response.json({ received: true }, { status: 202 });
  }
  const parsed = domainWebhookEnvelopeSchema.safeParse(envelope);
  if (!parsed.success) {
    return Response.json({ received: true }, { status: 202 });
  }
  const result = await recordMonitorWebhook(parsed.data.payload, parsed.data.signature);
  // Always 202 to the webhook caller; the recorded status is internal.
  return Response.json(
    { received: true, recorded: Boolean(result?.ok) },
    { status: 202 },
  );
}
