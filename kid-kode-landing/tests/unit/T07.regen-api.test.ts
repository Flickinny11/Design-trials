// T07 unit — saveAndVerify contract.
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §13 L477 (Visual tab Save &
// Verify integrates with regen API). halt-check (ralph-state.json T07):
// "Save & Verify integrates with regen API".

import { describe, expect, it, vi } from 'vitest';
import { saveAndVerify } from '@/components/editor/panels/visual-preview/regen-api';
import type { PrismNode } from '@/lib/prism-graph/types';

function makeNode(): PrismNode {
  return {
    nodeId: 'n1',
    subtype: 'card',
    parentHubId: 'home',
    serviceTag: 'demo',
    visual: { sourceAsset: 'a.png', transform: { x: 0, y: 0, width: 100, height: 100, z: 0 } },
    intent: {
      caption: 'x',
      behaviorSpec: { interactions: [], apiCalls: [], dataBindings: [], emits: [], listens: [], triggersDownstream: [] },
      stateEffects: [],
      visualSpec: { textContent: [], layers: [] },
      contracts: { inputs: {}, outputs: {} },
    },
    codeRef: 'x.js',
    backendRef: null,
    renderMode: 'sprite',
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

describe('T07 saveAndVerify', () => {
  it('POSTs to /api/prism/regen by default', async () => {
    const fetchSpy = vi.fn<FetchFn>(async () => jsonResponse({ ok: true, verifierStatus: 'clean' }));
    await saveAndVerify(makeNode(), { fetch: fetchSpy as unknown as typeof fetch });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0]!;
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    expect(url).toContain('/api/prism/regen');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('wraps the node under action=verify-node per plan §P6', async () => {
    const fetchSpy = vi.fn<FetchFn>(async () => jsonResponse({ ok: true, verifierStatus: 'clean' }));
    await saveAndVerify(makeNode(), { fetch: fetchSpy as unknown as typeof fetch });
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.action).toBe('verify-node');
    expect(body.node.nodeId).toBe('n1');
    expect(body.node.renderMode).toBe('sprite');
  });

  it('forwards opts.codeModule when provided', async () => {
    const fetchSpy = vi.fn<FetchFn>(async () => jsonResponse({ ok: true, verifierStatus: 'clean' }));
    await saveAndVerify(makeNode(), {
      fetch: fetchSpy as unknown as typeof fetch,
      codeModule: 'export default function createNode() {}',
    });
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(typeof body.codeModule).toBe('string');
    expect(body.codeModule).toContain('createNode');
  });

  it('omits codeModule when not provided', async () => {
    const fetchSpy = vi.fn<FetchFn>(async () => jsonResponse({ ok: true, verifierStatus: 'clean' }));
    await saveAndVerify(makeNode(), { fetch: fetchSpy as unknown as typeof fetch });
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect('codeModule' in body).toBe(false);
  });

  it('returns ok: true and verifierStatus on success', async () => {
    const fetchSpy = vi.fn<FetchFn>(async () => jsonResponse({ ok: true, verifierStatus: 'clean', regeneratedAt: '2026-05-05T00:00:00Z' }));
    const r = await saveAndVerify(makeNode(), { fetch: fetchSpy as unknown as typeof fetch });
    expect(r.ok).toBe(true);
    expect(r.verifierStatus).toBe('clean');
    expect(r.regeneratedAt).toBe('2026-05-05T00:00:00Z');
  });

  it('returns ok: false with error on non-200 response', async () => {
    const fetchSpy = vi.fn<FetchFn>(async () => new Response('boom', { status: 500 }));
    const r = await saveAndVerify(makeNode(), { fetch: fetchSpy as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('honours a custom endpoint', async () => {
    const fetchSpy = vi.fn<FetchFn>(async () => jsonResponse({ ok: true, verifierStatus: 'clean' }));
    await saveAndVerify(makeNode(), { fetch: fetchSpy as unknown as typeof fetch, endpoint: '/custom/regen' });
    expect(fetchSpy.mock.calls[0]![0] as string).toContain('/custom/regen');
  });

  it('handles network errors', async () => {
    const fetchSpy = vi.fn<FetchFn>(async () => { throw new Error('offline'); });
    const r = await saveAndVerify(makeNode(), { fetch: fetchSpy as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('offline');
  });
});
