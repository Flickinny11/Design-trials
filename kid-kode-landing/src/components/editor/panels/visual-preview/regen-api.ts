// T07 / HL06 — Save & Verify integration with the regen API.
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §13 L477 (Visual tab Save &
// Verify) + §17 L538. Plan §P6 widens the wire format to a discriminated
// action body so a single endpoint can serve both `verify-node` (this
// caller) and `persist` (useGraphSourceStore.saveToServer).
//
// Pure TypeScript — no React, no fetch polyfill. Accepts an injected fetch
// implementation so the same code paths can run in:
//   - the editor (browser fetch)
//   - vitest unit tests (mocked fetch)
//   - the Playwright harness (browser fetch hitting the harness server)

import type { PrismNode } from '@/lib/prism-graph/types';
import type { VerifierViolation } from '@/lib/prism/codegen/verifier';

export interface RegenApiResult {
  ok: boolean;
  verifierStatus?: 'clean' | 'warning' | 'error';
  regeneratedAt?: string;
  violations?: VerifierViolation[];
  error?: string;
  callCount?: number;
}

export interface SaveAndVerifyOptions {
  fetch?: typeof fetch;
  endpoint?: string;
  /** Optional generated module source. When provided, the route runs the
   *  static verifier (§10) against it in addition to the plan-level checks. */
  codeModule?: string;
}

const DEFAULT_ENDPOINT = '/api/prism/regen';

export async function saveAndVerify(
  node: PrismNode,
  opts: SaveAndVerifyOptions = {},
): Promise<RegenApiResult> {
  const fetchFn = opts.fetch ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!fetchFn) {
    return { ok: false, error: 'no fetch implementation available' };
  }
  const endpoint = opts.endpoint ?? DEFAULT_ENDPOINT;

  const requestBody: { action: 'verify-node'; node: PrismNode; codeModule?: string } = {
    action: 'verify-node',
    node,
  };
  if (typeof opts.codeModule === 'string' && opts.codeModule.length > 0) {
    requestBody.codeModule = opts.codeModule;
  }

  let res: Response;
  try {
    res = await fetchFn(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch { /* ignore */ }
    return { ok: false, error: `HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}` };
  }

  let json: unknown;
  try { json = await res.json(); } catch (err) {
    return { ok: false, error: `invalid JSON: ${(err as Error).message}` };
  }

  const j = json as Partial<RegenApiResult>;
  return {
    ok: j.ok === true,
    verifierStatus: j.verifierStatus,
    regeneratedAt: j.regeneratedAt,
    violations: j.violations,
    callCount: j.callCount,
    error: j.ok === true ? undefined : (j.error ?? 'regen returned ok=false'),
  };
}
