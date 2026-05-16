// EB-10-02 — preview-app renderer + route-like navigation.
//
// Spec refs:
//   §10 SC-054  "preview-app mode renders all hubs in order with route-like
//                navigation (URL or hash route maps to active hub)."
//   §8  INV-17  Non-destructive compile (the routing surface MUST NOT mutate
//                hubs/nodes/world either).
//   §8  INV-20  Selection state survives every transition through any subset of
//                the five canonical view modes.
//
// haltCheck:
//   "viewMode='preview-app' renders the compiled app; navigation between hubs
//    reflects in URL hash or pathname; back/forward browser-like nav works
//    within the preview surface."
//
// This module covers the pure-data routing helpers that drive the preview-app
// surface. The DOM/history side of the wire (popstate, pushState) is exercised
// by the verify-editor-runtimes snapshot in scripts/verify-editor-runtimes.mjs;
// these tests pin the deterministic parsing/serialization/navigation contract.

import { describe, expect, it } from 'vitest';

import { compileAppToPreview } from '@/lib/prism-graph/compile-app';
import {
  PREVIEW_APP_HASH_PREFIX,
  getNextHubId,
  getPrevHubId,
  parsePreviewAppHash,
  resolveActiveHubId,
  serializePreviewAppHash,
} from '@/lib/prism-graph/preview-app-routing';
import type {
  PrismHub,
  PrismIntent,
  PrismNode,
} from '@/lib/prism-graph/types';
import type { PrismRootNode } from '@/lib/prism-graph/root-node';

// --- Fixtures (mirror EB-10-01) -----------------------------------------

function makeIntent(overrides: Partial<PrismIntent> = {}): PrismIntent {
  return {
    caption: 'fixture',
    behaviorSpec: {
      interactions: [],
      apiCalls: [],
      dataBindings: [],
      emits: [],
      listens: [],
      triggersDownstream: [],
    },
    stateEffects: [],
    visualSpec: { textContent: [], layers: [] },
    contracts: { inputs: {}, outputs: {} },
    ...overrides,
  };
}

function makeHub(hubId: string): PrismHub {
  return {
    hubId,
    title: `${hubId} title`,
    layout: {
      viewportWidth: 1440,
      viewportHeight: 900,
      contentHeight: 2400,
      backgroundColor: '#080808',
      mockupUrl: null,
    },
  };
}

function makeNode(id: string, parentHubId: string): PrismNode {
  return {
    nodeId: id,
    subtype: 'product-mesh',
    parentHubId,
    serviceTag: 'content',
    visual: {
      transform: { x: 10, y: 20, width: 300, height: 200, z: 0 },
    },
    intent: makeIntent(),
    codeRef: `code-${id}`,
    backendRef: null,
  };
}

function makeWorld(): PrismRootNode {
  return {
    appNameWorldId: 'app-name-world-routing',
    spec: { name: 'Routing App' },
    designSpec: {},
    buildPlan: {},
    memoryLog: [],
    hubRegistry: [
      { hubId: 'hub-alpha' },
      { hubId: 'hub-bravo' },
      { hubId: 'hub-charlie' },
    ],
    nodeRegistry: [],
    globalDependencies: [],
    validationRules: [],
    aiRoutingRules: [],
  };
}

function makeApp() {
  const hubs: PrismHub[] = [
    makeHub('hub-alpha'),
    makeHub('hub-bravo'),
    makeHub('hub-charlie'),
  ];
  const nodes: PrismNode[] = [
    makeNode('a1', 'hub-alpha'),
    makeNode('b1', 'hub-bravo'),
    makeNode('c1', 'hub-charlie'),
  ];
  const world = makeWorld();
  return { hubs, nodes, world, view: compileAppToPreview(world, hubs, nodes) };
}

// --- Tests --------------------------------------------------------------

describe('EB-10-02 preview-app routing helpers (SC-054)', () => {
  it('SC-054: PREVIEW_APP_HASH_PREFIX is the documented "#hub=" prefix', () => {
    expect(PREVIEW_APP_HASH_PREFIX).toBe('#hub=');
  });

  it('SC-054: serializePreviewAppHash(hubId) is round-trippable through parsePreviewAppHash', () => {
    const { view } = makeApp();
    const hash = serializePreviewAppHash('hub-bravo');
    expect(hash.startsWith(PREVIEW_APP_HASH_PREFIX)).toBe(true);
    expect(parsePreviewAppHash(hash, view)).toBe('hub-bravo');
  });

  it('SC-054: parsePreviewAppHash decodes URI-encoded hub ids', () => {
    const { view } = makeApp();
    // Author a hash by hand the way a browser might present `location.hash`.
    const hash = `${PREVIEW_APP_HASH_PREFIX}${encodeURIComponent('hub-charlie')}`;
    expect(parsePreviewAppHash(hash, view)).toBe('hub-charlie');
  });

  it('SC-054: parsePreviewAppHash returns null for an empty / non-matching hash', () => {
    const { view } = makeApp();
    expect(parsePreviewAppHash('', view)).toBeNull();
    expect(parsePreviewAppHash('#', view)).toBeNull();
    expect(parsePreviewAppHash('#other=x', view)).toBeNull();
  });

  it('SC-054: parsePreviewAppHash returns null for a hubId not present in the compiled view', () => {
    const { view } = makeApp();
    expect(parsePreviewAppHash(`${PREVIEW_APP_HASH_PREFIX}ghost`, view)).toBeNull();
  });

  it('SC-054: resolveActiveHubId falls back to the first compiled hub when the hash is missing/invalid', () => {
    const { view } = makeApp();
    // Compiled hubs are sorted by hubId so the first is `hub-alpha`.
    expect(resolveActiveHubId('', view)).toBe('hub-alpha');
    expect(resolveActiveHubId('#hub=ghost', view)).toBe('hub-alpha');
    expect(resolveActiveHubId(`${PREVIEW_APP_HASH_PREFIX}hub-bravo`, view))
      .toBe('hub-bravo');
  });

  it('SC-054: resolveActiveHubId returns null for an empty compiled view (no hubs)', () => {
    const empty = compileAppToPreview(makeWorld(), [], []);
    expect(resolveActiveHubId('', empty)).toBeNull();
  });

  it('SC-054: getNextHubId walks forward through compiled hub order, wrapping at the end', () => {
    const { view } = makeApp();
    expect(getNextHubId(view, 'hub-alpha')).toBe('hub-bravo');
    expect(getNextHubId(view, 'hub-bravo')).toBe('hub-charlie');
    expect(getNextHubId(view, 'hub-charlie')).toBe('hub-alpha');
  });

  it('SC-054: getPrevHubId walks backward through compiled hub order, wrapping at the start', () => {
    const { view } = makeApp();
    expect(getPrevHubId(view, 'hub-alpha')).toBe('hub-charlie');
    expect(getPrevHubId(view, 'hub-bravo')).toBe('hub-alpha');
    expect(getPrevHubId(view, 'hub-charlie')).toBe('hub-bravo');
  });

  it('SC-054: getNextHubId / getPrevHubId return null for an unknown current hub', () => {
    const { view } = makeApp();
    expect(getNextHubId(view, 'ghost')).toBeNull();
    expect(getPrevHubId(view, 'ghost')).toBeNull();
  });

  it('SC-054: navigation order matches CompiledAppView.hubs order exactly', () => {
    const { view } = makeApp();
    const order = view.hubs.map((h) => h.hubId);
    let current = order[0];
    const walked: string[] = [current];
    for (let i = 0; i < order.length - 1; i += 1) {
      const next = getNextHubId(view, current);
      expect(next).not.toBeNull();
      current = next!;
      walked.push(current);
    }
    expect(walked).toEqual(order);
  });

  it('INV-17: routing helpers never mutate the compiled view or its inputs', () => {
    const { hubs, nodes, world, view } = makeApp();
    const beforeHubs = JSON.stringify(hubs);
    const beforeNodes = JSON.stringify(nodes);
    const beforeWorld = JSON.stringify(world);
    const beforeView = JSON.stringify(view);

    serializePreviewAppHash('hub-alpha');
    parsePreviewAppHash('#hub=hub-bravo', view);
    resolveActiveHubId('#hub=hub-bravo', view);
    getNextHubId(view, 'hub-alpha');
    getPrevHubId(view, 'hub-alpha');

    expect(JSON.stringify(hubs)).toBe(beforeHubs);
    expect(JSON.stringify(nodes)).toBe(beforeNodes);
    expect(JSON.stringify(world)).toBe(beforeWorld);
    expect(JSON.stringify(view)).toBe(beforeView);
  });
});
