// P1 TEXT SYSTEM (C) — criterion-26 textSpec round-trip at the DATA layer.
//
// The graph save/reload path (verified against the live code, 2026-06-10):
//   SAVE — useGraphSourceStore.saveToServer() (src/stores/useGraphSourceStore.ts
//     ~L392) builds a HomeHubJson { schemaVersion: '0.1.0', hub, nodes, edges,
//     rootNodes } where nodes are filtered to the hub and the editor-transient
//     `dirty` flag is stripped via `({ dirty: _dirty, ...n }) => n`, then
//     JSON.stringify({ action: 'persist', graph }) goes over the wire. There is
//     no other serialize helper — saveToServer inlines the shape, so this test
//     replicates it field-for-field.
//   LOAD — loadFromHomeHub (src/lib/prism-graph/loader.ts) IS the pure
//     deserializer: both store.load() and the eager live-graph init route
//     through it. The round-trip here goes through THAT, not bare JSON.parse
//     alone.
//
// Covered here (data layer only):
//   - a fully-populated TextSpec (every field) survives persist→load with deep
//     equality, including '\n' content, non-core family, weight 700, and the
//     ai-texture fill with a resolved url;
//   - every TextFill kind round-trips;
//   - absent textSpec resolves to TEXT_SPEC_DEFAULT via the same merge the
//     runtime uses ({ ...TEXT_SPEC_DEFAULT, ...node.textSpec });
//   - TEXT_SPEC_DEFAULT itself is frozen-shape (inline snapshot + key set).
//
// NOT duplicated here: setSpec instant-refont / same-Group-identity / dispose
// behavior — tests/text/text-object.test.ts already covers the scene-object
// half of criterion 26.

import { describe, it, expect } from 'vitest';

import { loadFromHomeHub } from '@/lib/prism-graph/loader';
import {
  TEXT_SPEC_DEFAULT,
  type GraphSource,
  type HomeHubJson,
  type PrismHub,
  type PrismNode,
  type TextFill,
  type TextSpec,
} from '@/lib/prism-graph/types';

// ── Fixtures ────────────────────────────────────────────────────────────────

/** Every TextSpec field populated, every optional sub-field set. Non-default
 *  values throughout so a silent fallback-to-default cannot pass. */
const FULL_TEXT_SPEC: TextSpec = {
  content: 'PRISM\nTEXT SYSTEM', // multi-line via '\n' (types.ts contract)
  fontFamily: 'Playfair Display', // non-core — resolves via on-demand bake
  fontSize: 0.62,
  fontWeight: 700,
  letterSpacing: 0.05,
  lineHeight: 1.35,
  align: 'right',
  fill: {
    kind: 'ai-texture',
    prompt: 'molten gold',
    url: '/prism-assets/fills/molten-gold-1.png', // resolved, not pending
  },
  outline: { color: '#3a2f1d', width: 0.25 },
  glow: { color: '#ffd27a', intensity: 1.6 },
  shadow: { color: '#000000', offsetX: 0.04, offsetY: -0.06, opacity: 0.5 },
  opacity: 0.85,
  decompose: 'word',
};

const HUB: PrismHub = {
  hubId: 'home',
  title: 'Home',
  layout: {
    viewportWidth: 1440,
    viewportHeight: 900,
    contentHeight: 2400,
    backgroundColor: '#101014',
  },
};

function makeNode(overrides: Partial<PrismNode> = {}): PrismNode {
  return {
    nodeId: 'text-hero',
    subtype: 'text',
    parentHubId: HUB.hubId,
    serviceTag: 'demo',
    visual: { transform: { x: 0, y: 0, width: 320, height: 80, z: 2 } },
    intent: {
      caption: 'hero headline',
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
    },
    codeRef: 'text-hero.js',
    backendRef: null,
    renderMode: 'sprite',
    ...overrides,
  };
}

// ── The store's persist→load path, replicated field-for-field ──────────────

/** Mirror of saveToServer's wire payload (useGraphSourceStore.ts ~L404-420):
 *  hub-filtered nodes, `dirty` stripped, rootNodes threaded. */
function persistWirePayload(nodes: PrismNode[]): string {
  const graph: HomeHubJson = {
    schemaVersion: '0.1.0',
    hub: HUB,
    nodes: nodes
      .filter((n) => n.parentHubId === HUB.hubId)
      .map(({ dirty: _dirty, ...n }) => n as PrismNode),
    edges: [],
    rootNodes: [],
  };
  return JSON.stringify({ action: 'persist', graph });
}

/** Full round-trip: store persist shape → wire JSON → parse → the SAME pure
 *  deserializer the load path uses (loadFromHomeHub). */
function roundTrip(nodes: PrismNode[]): GraphSource {
  const wire = JSON.parse(persistWirePayload(nodes)) as { graph: HomeHubJson };
  return loadFromHomeHub(wire.graph);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('textSpec round-trip (criterion 26, data layer)', () => {
  it('a fully-populated textSpec survives persist→loadFromHomeHub with deep equality', () => {
    const node = makeNode({ textSpec: structuredClone(FULL_TEXT_SPEC), dirty: true });
    const loaded = roundTrip([node]);

    expect(loaded.nodes).toHaveLength(1);
    const back = loaded.nodes[0];
    expect(back.textSpec).toStrictEqual(FULL_TEXT_SPEC);
    // Spot-check the lossy-prone bits explicitly.
    expect(back.textSpec?.content).toBe('PRISM\nTEXT SYSTEM');
    expect(back.textSpec?.fontWeight).toBe(700);
    expect(back.textSpec?.fill).toStrictEqual({
      kind: 'ai-texture',
      prompt: 'molten gold',
      url: '/prism-assets/fills/molten-gold-1.png',
    });
    // The save path strips the transient `dirty` flag — and ONLY that.
    expect(back.dirty).toBeUndefined();
    expect(back.nodeId).toBe('text-hero');
  });

  const fills: [string, TextFill][] = [
    ['solid', { kind: 'solid', color: '#10b3a1' }],
    ['gradient', { kind: 'gradient', from: '#ff6a00', to: '#220033', angleDeg: 45 }],
    ['texture', { kind: 'texture', url: '/prism-assets/fills/brushed-brass.png' }],
    ['ai-texture (pending, no url)', { kind: 'ai-texture', prompt: 'hairy moss' }],
    [
      'ai-texture (resolved url)',
      { kind: 'ai-texture', prompt: 'molten gold', url: '/prism-assets/fills/molten-gold-1.png' },
    ],
  ];
  it.each(fills)('fill kind %s round-trips exactly', (_label, fill) => {
    const node = makeNode({ textSpec: { ...FULL_TEXT_SPEC, fill } });
    const back = roundTrip([node]).nodes[0];
    expect(back.textSpec?.fill).toStrictEqual(fill);
  });

  it('absent textSpec resolves to TEXT_SPEC_DEFAULT via the runtime merge', () => {
    const node = makeNode(); // no textSpec
    const back = roundTrip([node]).nodes[0];
    expect(back.textSpec).toBeUndefined();

    // The exact merge the runtime applies (text-object.ts resolveSpec is the
    // spread of TEXT_SPEC_DEFAULT under the node's spec).
    const resolved: TextSpec = { ...TEXT_SPEC_DEFAULT, ...back.textSpec };
    expect(resolved).toStrictEqual(TEXT_SPEC_DEFAULT);
  });

  it('partial textSpec merge keeps defaults for unset fields', () => {
    const node = makeNode({ textSpec: { content: 'Hi', fontWeight: 700 } });
    const back = roundTrip([node]).nodes[0];
    const resolved: TextSpec = { ...TEXT_SPEC_DEFAULT, ...back.textSpec };
    expect(resolved.content).toBe('Hi');
    expect(resolved.fontWeight).toBe(700);
    expect(resolved.fontFamily).toBe(TEXT_SPEC_DEFAULT.fontFamily);
    expect(resolved.fill).toStrictEqual(TEXT_SPEC_DEFAULT.fill);
    expect(resolved.decompose).toBe(TEXT_SPEC_DEFAULT.decompose);
  });
});

describe('TEXT_SPEC_DEFAULT — frozen shape', () => {
  it('matches the frozen snapshot', () => {
    expect(TEXT_SPEC_DEFAULT).toMatchInlineSnapshot(`
      {
        "align": "center",
        "content": "Text",
        "decompose": "glyph",
        "fill": {
          "color": "#e8e4da",
          "kind": "solid",
        },
        "fontFamily": "Inter",
        "fontSize": 0.4,
        "fontWeight": 400,
        "letterSpacing": 0,
        "lineHeight": 1,
        "opacity": 1,
      }
    `);
  });

  it('declares exactly the expected key set (additive growth is a conscious change)', () => {
    expect(Object.keys(TEXT_SPEC_DEFAULT).sort()).toEqual([
      'align',
      'content',
      'decompose',
      'fill',
      'fontFamily',
      'fontSize',
      'fontWeight',
      'letterSpacing',
      'lineHeight',
      'opacity',
    ]);
  });

  it('itself survives a JSON round-trip (no undefined / non-JSON values)', () => {
    expect(JSON.parse(JSON.stringify(TEXT_SPEC_DEFAULT))).toStrictEqual(TEXT_SPEC_DEFAULT);
  });
});
