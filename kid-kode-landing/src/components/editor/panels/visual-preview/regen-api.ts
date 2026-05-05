// T07 — Save & Verify integration with the regen API.
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §13 L477 (Visual tab Save &
// Verify) + §17 L538. The Visual tab's Save & Verify button serializes the
// edited PrismNode and POSTs it to the renderer's regen endpoint, which
// re-runs the verifier (§10) and returns the verifier status.
//
// Pure TypeScript — no React, no fetch polyfill. Accepts an injected fetch
// implementation so the same code paths can run in:
//   - the editor (browser fetch)
//   - vitest unit tests (mocked fetch)
//   - the Playwright harness (browser fetch hitting the harness server)

import type { PrismNode } from '@/lib/prism-graph/types';

export interface RegenApiResult {
  ok: boolean;
  verifierStatus?: 'clean' | 'warning' | 'error';
  regeneratedAt?: string;
  error?: string;
  callCount?: number;
}

export interface SaveAndVerifyOptions {
  fetch?: typeof fetch;
  endpoint?: string;
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

  let res: Response;
  try {
    res = await fetchFn(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(node),
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
    callCount: j.callCount,
    error: j.ok === true ? undefined : (j.error ?? 'regen returned ok=false'),
  };
}
