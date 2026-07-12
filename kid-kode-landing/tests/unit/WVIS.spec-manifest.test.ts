// W-VIS D2 — spec-manifest completeness gate tests.
//
// The gate is the deterministic answer to W-BAKEB's dominant defect
// (MISSING_SPEC_ELEMENT x297): a generated module must end with a
// @spec-manifest comment mapping EVERY extracted L3 spec element to a code
// location that actually exists in the module. The judge protocol for this
// wave requires demonstrating that a SEEDED INCOMPLETE MANIFEST is rejected —
// that fixture is `SEEDED_INCOMPLETE_MODULE` below.

import { describe, expect, it } from 'vitest';
import {
  extractSpecElements,
  parseSpecManifest,
  checkSpecManifest,
  checkSpecManifestSource,
  buildSpecManifestPromptBlock,
  buildManifestRetryFeedback,
} from '@/lib/prism/codegen/spec-manifest';
import { verifyNodeModule } from '@/lib/prism/codegen/verifier';
import { buildCodegenPrompt } from '@/lib/prism/codegen/prompts';
import type { PrismNode } from '@/lib/prism-graph/types';

const NODE = {
  nodeId: 'wvis-d2-test-node',
  renderMode: 'plane',
  cinematicPrimitives: [{ name: 'orbit', params: {} }],
  intent: {
    caption: 'Test hero',
    behaviorSpec: { interactions: [{ on: 'click', do: 'pulse' }], apiCalls: [], dataBindings: [], emits: [], listens: [], triggersDownstream: [] },
    visualSpec: {
      textContent: [
        { text: 'Calibre NA-01', role: 'headline', typography: { fontSize: 68 } },
        { text: 'Machined in-house.', role: 'body', typography: { fontSize: 26 } },
      ],
      colors: { background: '#0b0b10', accent: '#ff2a38', gradientStops: [{ at: 0, hex: '#0b0b10' }] },
      effects: 'key+rim lighting, slow orbit',
    },
  },
} as unknown as PrismNode;

// A module whose manifest maps EVERY element to real code locations.
const COMPLETE_MODULE = `
import { Group } from 'three/webgpu';
export default function createNode(config, ctx) {
  const group = new Group();
  buildHeadline(group, ctx);
  buildBodyCopy(group, ctx);
  paintBackground(group);
  addAccentLight(group);
  buildGradientStage(group);
  applyOrbitPrimitive(group, ctx);
  wireClickPulse(group);
  group.userData.cleanup = () => {};
  return group;
}
function buildHeadline() {}
function buildBodyCopy() {}
function paintBackground() {}
function addAccentLight() {}
function buildGradientStage() {}
function applyOrbitPrimitive() {}
function wireClickPulse() {}
/* @spec-manifest
{"elements":[
 {"id":"text.headline.0","where":"buildHeadline"},
 {"id":"text.body.1","where":"buildBodyCopy"},
 {"id":"color.background","where":"paintBackground"},
 {"id":"color.accent","where":"addAccentLight"},
 {"id":"color.gradient","where":"buildGradientStage"},
 {"id":"effects.spec","where":"addAccentLight"},
 {"id":"interaction.0","where":"wireClickPulse"},
 {"id":"primitive.orbit","where":"applyOrbitPrimitive"}
]}
*/
`;

// SEEDED INCOMPLETE MANIFEST — the judge-protocol fixture. Two required
// elements are deliberately unmapped (color.accent, primitive.orbit) and one
// maps to a location that does not exist in the code (buildGhostSection).
const SEEDED_INCOMPLETE_MODULE = `
import { Group } from 'three/webgpu';
export default function createNode(config, ctx) {
  const group = new Group();
  buildHeadline(group, ctx);
  buildBodyCopy(group, ctx);
  paintBackground(group);
  group.userData.cleanup = () => {};
  return group;
}
function buildHeadline() {}
function buildBodyCopy() {}
function paintBackground() {}
/* @spec-manifest
{"elements":[
 {"id":"text.headline.0","where":"buildHeadline"},
 {"id":"text.body.1","where":"buildBodyCopy"},
 {"id":"color.background","where":"paintBackground"},
 {"id":"color.gradient","where":"buildGhostSection"},
 {"id":"effects.spec","where":"paintBackground"},
 {"id":"interaction.0","where":"buildHeadline"}
]}
*/
`;

describe('W-VIS D2 — extractSpecElements', () => {
  it('deterministically enumerates every L3 spec element', () => {
    const els = extractSpecElements(NODE);
    const ids = els.map((e) => e.id);
    expect(ids).toEqual([
      'text.headline.0',
      'text.body.1',
      'color.background',
      'color.accent',
      'color.gradient',
      'effects.spec',
      'interaction.0',
      'primitive.orbit',
    ]);
  });

  it('returns [] for a node without visual spec (gate stays silent)', () => {
    const els = extractSpecElements({ nodeId: 'x' } as unknown as PrismNode);
    expect(els).toEqual([]);
  });
});

describe('W-VIS D2 — manifest parse + gate', () => {
  it('accepts a complete manifest mapping every element to real code', () => {
    const res = checkSpecManifest(COMPLETE_MODULE, NODE);
    expect(res.ok).toBe(true);
    expect(res.unmapped).toEqual([]);
    expect(res.mapped).toHaveLength(8);
  });

  it('REJECTS the seeded incomplete manifest (judge-protocol fixture)', () => {
    const res = checkSpecManifest(SEEDED_INCOMPLETE_MODULE, NODE);
    expect(res.ok).toBe(false);
    const unmappedIds = res.unmapped.map((e) => e.id);
    // color.accent + primitive.orbit have no entry; color.gradient maps to a
    // location absent in the code.
    expect(unmappedIds).toContain('color.accent');
    expect(unmappedIds).toContain('primitive.orbit');
    expect(unmappedIds).toContain('color.gradient');
    const feedback = buildManifestRetryFeedback(res);
    expect(feedback).toContain('color.accent');
    expect(feedback).toContain('primitive.orbit');
  });

  it('rejects a module with no manifest at all', () => {
    const res = checkSpecManifest('export default function createNode(){}', NODE);
    expect(res.ok).toBe(false);
    expect(res.manifestPresent).toBe(false);
  });

  it('rejects a manifest with unparseable JSON', () => {
    const src = 'export default function createNode(){}\n/* @spec-manifest\n{not json\n*/';
    const parse = parseSpecManifest(src);
    expect(parse.present).toBe(true);
    expect(parse.parseError).toBeTruthy();
    const res = checkSpecManifest(src, NODE);
    expect(res.ok).toBe(false);
  });

  it('flags unknown manifest ids without failing the gate for them', () => {
    const res = checkSpecManifestSource(COMPLETE_MODULE.replace(
      '{"id":"primitive.orbit","where":"applyOrbitPrimitive"}',
      '{"id":"primitive.orbit","where":"applyOrbitPrimitive"},{"id":"made.up","where":"buildHeadline"}',
    ), extractSpecElements(NODE));
    expect(res.ok).toBe(true);
    expect(res.unknown).toContain('made.up');
  });
});

describe('W-VIS D2 — verifier integration (additive)', () => {
  it('verifyNodeModule fires SPEC_MANIFEST_INCOMPLETE only when specElements supplied', () => {
    const noCtx = verifyNodeModule(SEEDED_INCOMPLETE_MODULE, { renderMode: 'plane' });
    expect(noCtx.violations.map((v) => v.rule)).not.toContain('SPEC_MANIFEST_INCOMPLETE');

    const withCtx = verifyNodeModule(SEEDED_INCOMPLETE_MODULE, {
      renderMode: 'plane',
      specElements: extractSpecElements(NODE),
    });
    const rules = withCtx.violations.map((v) => v.rule);
    expect(rules).toContain('SPEC_MANIFEST_INCOMPLETE');
    expect(withCtx.ok).toBe(false);
  });

  it('complete manifest passes the verifier rule', () => {
    const res = verifyNodeModule(COMPLETE_MODULE, {
      renderMode: 'plane',
      specElements: extractSpecElements(NODE),
    });
    expect(res.violations.map((v) => v.rule)).not.toContain('SPEC_MANIFEST_INCOMPLETE');
  });
});

describe('W-VIS D2 — prompt wiring (additive)', () => {
  it('buildCodegenPrompt appends the manifest block for spec-bearing nodes', () => {
    const p = buildCodegenPrompt(NODE, { parent: null, siblings: [], children: [] }, { atlasIndex: 0, x: 0, y: 0, width: 1, height: 1 });
    expect(p.user).toContain('--- SPEC MANIFEST ---');
    expect(p.user).toContain('text.headline.0');
    expect(p.user).toContain('primitive.orbit');
  });

  it('nodes without spec elements get a byte-identical (pre-D2) prompt tail', () => {
    const bare = { nodeId: 'bare', renderMode: 'sprite' } as unknown as PrismNode;
    const p = buildCodegenPrompt(bare, { parent: null, siblings: [], children: [] }, { atlasIndex: 0, x: 0, y: 0, width: 1, height: 1 });
    expect(p.user).not.toContain('--- SPEC MANIFEST ---');
  });

  it('prompt block lists every element id', () => {
    const block = buildSpecManifestPromptBlock(extractSpecElements(NODE));
    for (const id of ['text.headline.0', 'color.accent', 'effects.spec', 'interaction.0']) {
      expect(block).toContain(id);
    }
  });
});
