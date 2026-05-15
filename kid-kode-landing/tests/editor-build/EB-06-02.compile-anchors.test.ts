// EB-06-02 — compile-anchors.ts deterministic rule table.
//
// Spec refs:
//   §6 SC-031  "Per-node anchor rules: a deterministic rule table maps
//               (node.subtype, node.intent, node.serviceTag) → uiAnchor.
//               Rules live in
//               kid-kode-landing/src/lib/prism-graph/compile-anchors.ts."
//   §8 INV-17  Non-destructive compile (rule fn is pure, read-only).
//   §8 FP-04   No destructive writes from compile* functions.
//
// haltCheck:
//   "compile-anchors.ts exports a deterministic rule fn (subtype, intent,
//    serviceTag) → uiAnchor; unit tests cover at least 6 subtypes; ambiguous
//    cases fall through to a documented default."
//
// UiAnchor enum (gap-analysis editor-build-gap-analysis.md:245):
//   'world' | 'viewport' | 'scroll' | 'hybrid' | 'sticky' | 'parallax'
//   | 'camera-locked'

import { describe, expect, it } from 'vitest';

import {
  type UiAnchor,
  UI_ANCHOR_VALUES,
  UI_ANCHOR_DEFAULT,
  pickUiAnchor,
} from '@/lib/prism-graph/compile-anchors';
import type { PrismIntent } from '@/lib/prism-graph/types';

// --- Fixtures ------------------------------------------------------------

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

// --- Type-level: the canonical UiAnchor union has exactly 7 members. ----

type ExpectedUiAnchor =
  | 'world'
  | 'viewport'
  | 'scroll'
  | 'hybrid'
  | 'sticky'
  | 'parallax'
  | 'camera-locked';

type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _uiAnchorUnionIsCanonical: Equals<UiAnchor, ExpectedUiAnchor> = true;

// --- Tests ---------------------------------------------------------------

describe('EB-06-02 pickUiAnchor (compile-anchors)', () => {
  it('SC-031: the canonical UiAnchor value set has exactly 7 members', () => {
    const expected: readonly UiAnchor[] = [
      'world',
      'viewport',
      'scroll',
      'hybrid',
      'sticky',
      'parallax',
      'camera-locked',
    ];
    expect([...UI_ANCHOR_VALUES].sort()).toEqual([...expected].sort());
    expect(UI_ANCHOR_VALUES).toHaveLength(7);
  });

  it('SC-031: meshes anchor in world-space', () => {
    expect(pickUiAnchor('hero-mesh', makeIntent(), 'content')).toBe('world');
    expect(pickUiAnchor('product-mesh', makeIntent(), 'content')).toBe('world');
    expect(pickUiAnchor('callout-mesh', makeIntent(), 'content')).toBe('world');
  });

  it('SC-031: parallax subtypes anchor in parallax mode', () => {
    expect(pickUiAnchor('parallax-decor', makeIntent(), 'decor')).toBe('parallax');
    expect(pickUiAnchor('grid-parallax', makeIntent(), 'content')).toBe('parallax');
    expect(pickUiAnchor('form-parallax', makeIntent(), 'content')).toBe('parallax');
    expect(pickUiAnchor('headline-parallax', makeIntent(), 'content')).toBe('parallax');
  });

  it('SC-031: CTA / action subtypes anchor as sticky', () => {
    expect(pickUiAnchor('cta-sprite', makeIntent(), 'action')).toBe('sticky');
    expect(pickUiAnchor('hero-cta', makeIntent(), 'action')).toBe('sticky');
  });

  it('SC-031: card / thumbnail / tier subtypes anchor in scroll-timeline', () => {
    expect(pickUiAnchor('card-plane', makeIntent(), 'content')).toBe('scroll');
    expect(pickUiAnchor('card-sprite', makeIntent(), 'content')).toBe('scroll');
    expect(pickUiAnchor('feature-card', makeIntent(), 'content')).toBe('scroll');
    expect(pickUiAnchor('thumbnail-plane', makeIntent(), 'content')).toBe('scroll');
    expect(pickUiAnchor('tier-sprite', makeIntent(), 'content')).toBe('scroll');
  });

  it('SC-031: social / hud subtypes pin to viewport', () => {
    expect(pickUiAnchor('social-sprite', makeIntent(), 'hud')).toBe('viewport');
  });

  it('SC-031: an intent flag marking camera-locked overrides subtype rules', () => {
    const camera = makeIntent({ visualSpec: { textContent: [], layers: [], cameraLocked: true } });
    // A subtype that would otherwise resolve to `world` is overridden by an
    // explicit intent flag — the intent input matters per the rule signature.
    expect(pickUiAnchor('product-mesh', camera, 'content')).toBe('camera-locked');
  });

  it('SC-031: ambiguous cases fall through to the documented default (viewport)', () => {
    // An unknown subtype with a generic serviceTag exercises the fallback.
    expect(pickUiAnchor('unknown-subtype-xyz', makeIntent(), 'misc')).toBe(UI_ANCHOR_DEFAULT);
    expect(UI_ANCHOR_DEFAULT).toBe('viewport');
  });

  it('SC-031: the rule fn is deterministic (same input → same output)', () => {
    const intent = makeIntent();
    const a = pickUiAnchor('card-plane', intent, 'content');
    const b = pickUiAnchor('card-plane', intent, 'content');
    expect(b).toBe(a);
  });

  it('INV-17 / FP-04: the rule fn does not mutate its inputs', () => {
    const intent = makeIntent({
      behaviorSpec: {
        interactions: [{ event: 'click', effect: 'navigate' }],
        apiCalls: [],
        dataBindings: [],
        emits: [],
        listens: [],
        triggersDownstream: [],
      },
    });
    const before = JSON.stringify(intent);
    pickUiAnchor('card-plane', intent, 'content');
    expect(JSON.stringify(intent)).toBe(before);
  });

  it('SC-031: subtype dispatch covers the canonical mock-app set (≥6 distinct subtypes)', () => {
    // Sanity coverage to satisfy the haltCheck "≥6 subtypes" requirement.
    const cases: Array<[string, string, UiAnchor]> = [
      ['hero-mesh', 'content', 'world'],
      ['grid-parallax', 'content', 'parallax'],
      ['cta-sprite', 'action', 'sticky'],
      ['card-plane', 'content', 'scroll'],
      ['social-sprite', 'hud', 'viewport'],
      ['parallax-decor', 'decor', 'parallax'],
      ['headline-parallax', 'content', 'parallax'],
    ];
    const distinct = new Set(cases.map(([s]) => s));
    expect(distinct.size).toBeGreaterThanOrEqual(6);
    for (const [subtype, serviceTag, expected] of cases) {
      expect(pickUiAnchor(subtype, makeIntent(), serviceTag)).toBe(expected);
    }
  });
});
