// T07 unit — RETIRED (EDITOR-EXP NE-SC-14 / FP-NE-5).
//
// This file USED to verify VisualPreview's "Save & Verify" → regen-api
// contract (POST /api/prism/regen, action=verify-node). That was a SECOND,
// independent edit/save/build path. NE-SC-14 retires it: VisualPreview is now
// display-only and all editing routes through the single canonical
//   overlay (usePreviewStateStore) → Save (commitPreviewToSource)
//   → Build (rebuildNode)
// path. The original contract assertions were removed with the path; this file
// now just asserts the retirement so the dead path can't silently come back.
//
// (Original assertions preserved at T07.regen-api.test.ts.bak-* for history.)

import { describe, expect, it } from 'vitest';
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
  } as unknown as PrismNode;
}

describe('T07 saveAndVerify — RETIRED (NE-SC-14)', () => {
  it('performs NO network save/build and resolves to a retired result', async () => {
    let fetched = false;
    const fetchSpy = (async () => {
      fetched = true;
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    const r = await saveAndVerify(makeNode(), { fetch: fetchSpy });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('RETIRED');
    // Crucially: the retired stub does NOT hit the regen endpoint.
    expect(fetched).toBe(false);
  });
});
