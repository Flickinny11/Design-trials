// EB-02-06 — POST /api/prism/vault/resolve
//
// Dev-preview endpoint for the inspector's Capabilities surface. Accepts a
// CapabilityRef-shaped probe ({ scope, ref, callerNodeId? }) and exercises
// the server-only vault. The response is REDACTED — never carries the raw
// value, only resolution metadata: { ok, scope, ref, at, status }.
//
// Spec refs:
//   - §6 Phase 2 SC-009 / SC-011: vault resolve is audited; capability refs
//     bind graph data to server-resolved secrets without exposing values.
//   - §7 INV-19: raw secret values never enter the client bundle or the
//     visible graph. The redacted response shape is the gate that enforces
//     this from the network side.
//
// The vault module imports `server-only` (vault.ts:1); this route file
// transitively inherits that constraint and lives under src/app/api/** so
// Next.js builds it into the server bundle, not the client.

import {
  audit as vaultAudit,
  resolve as vaultResolve,
  type VaultResolveResult,
} from '@/server/secrets/vault';

export const runtime = 'nodejs';

interface VaultResolveRequestBody {
  scope?: unknown;
  ref?: unknown;
  callerNodeId?: unknown;
}

interface VaultResolveRedactedResponse {
  ok: boolean;
  scope: string;
  ref: string;
  at: string;
  status: 'resolved' | 'not-found' | 'scope-mismatch';
  // INV-19: NEVER include the raw secret value here. The redact() helper
  // below strips it from the vault result before serialization.
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function redact(
  scope: string,
  ref: string,
  at: string,
  result: VaultResolveResult,
): VaultResolveRedactedResponse {
  // Build the response by hand instead of spreading `result` — spreading
  // would risk leaking `result.value` if the vault contract grows new
  // success-branch fields. Explicit construction keeps INV-19 enforced.
  if (result.ok === true) {
    return { ok: true, scope, ref, at, status: 'resolved' };
  }
  return { ok: false, scope, ref, at, status: (result as { ok: false; reason: 'not-found' | 'scope-mismatch' }).reason };
}

function jsonResponse(body: VaultResolveRedactedResponse | { ok: false; error: string }, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid JSON body' }, 400);
  }
  if (!isPlainObject(body)) {
    return jsonResponse({ ok: false, error: 'body must be a JSON object' }, 400);
  }
  const { scope, ref, callerNodeId } = body as VaultResolveRequestBody;
  if (typeof scope !== 'string' || scope.length === 0) {
    return jsonResponse({ ok: false, error: 'scope must be a non-empty string' }, 400);
  }
  if (typeof ref !== 'string' || ref.length === 0) {
    return jsonResponse({ ok: false, error: 'ref must be a non-empty string' }, 400);
  }
  const callerId = typeof callerNodeId === 'string' ? callerNodeId : null;

  const result = vaultResolve(scope, ref, callerId);

  // SC-011: every resolve writes an audit entry. The vault did that. The
  // last entry's timestamp surfaces in the redacted response so the picker
  // can show the user when the call was logged — without exposing the value.
  const log = vaultAudit();
  const lastAt = log.length > 0 ? log[log.length - 1].at : new Date().toISOString();

  return jsonResponse(redact(scope, ref, lastAt, result));
}
