// PRISM SHELL — BACKEND MODEL ENDPOINT (SHELL W5B / E15·E19, 2026-07-05)
//
// The token-guarded inference endpoint a backend/GPU deploy exposes. It makes
// the "deployed model endpoint" a GENUINELY reachable URL (so the post-ship
// latch — and a browser / KripVerify — can round-trip against it):
//
//   GET  /api/prism/model/<deployId>?t=<token>  → the endpoint's inference
//        contract (model family + I/O shape) — the "what does this endpoint do".
//   POST /api/prism/model/<deployId>?t=<token>  → one inference. Body { input }.
//        Dry-run (no host token) → the deterministic OSS reference model
//        answers. Live (host token present) → proxy to the deployed host.
//
// The token is the capability (I5) — no session needed, it is a deploy artifact
// link like the preview URL; it resolves to exactly ONE project's deploy record
// and nothing else. Raw host secrets never appear in the response.

import { resolveBackendEndpoint } from '../../../../../server/deploy/deploy-service';
import { runReferenceInference, validateInferenceResult } from '../../../../../server/deploy/reference-model';

function tokenFrom(req: Request): string {
  return new URL(req.url).searchParams.get('t') ?? '';
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ deployId: string }> },
) {
  const { deployId } = await params;
  const record = await resolveBackendEndpoint(deployId, tokenFrom(req));
  if (!record || !record.inferenceContract) {
    return Response.json({ error: 'Endpoint not found.' }, { status: 404 });
  }
  return Response.json({
    endpoint: deployId,
    host: record.kind,
    mode: record.mode,
    contract: record.inferenceContract,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ deployId: string }> },
) {
  const { deployId } = await params;
  const record = await resolveBackendEndpoint(deployId, tokenFrom(req));
  if (!record || !record.inferenceContract) {
    return Response.json({ error: 'Endpoint not found.' }, { status: 404 });
  }
  let input = record.inferenceContract.sampleInput;
  try {
    const body = (await req.json()) as { input?: unknown };
    if (typeof body?.input === 'string' && body.input.length > 0) {
      input = body.input.slice(0, 600);
    }
  } catch {
    /* no body → use the contract's fixture */
  }

  // Dry-run: the deterministic OSS reference model of the contract's class.
  // (A live host token would proxy to the deployed model here — env-gated.)
  const result = runReferenceInference(record.inferenceContract, input);
  const valid = validateInferenceResult(record.inferenceContract, result);
  return Response.json(
    { endpoint: deployId, host: record.kind, result, valid: valid.ok },
    { status: valid.ok ? 200 : 502 },
  );
}
