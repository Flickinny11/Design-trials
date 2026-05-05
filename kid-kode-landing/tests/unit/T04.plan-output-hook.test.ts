// T04 — Plan-output hook: ensures every node leaving the planner has a
// concrete `renderMode` and `cinematicPrimitives` array, so the codegen
// prompt template (§9.B) and the verifier's structural rules (§10.C "All
// modes → iterate cinematicPrimitives") can fire deterministically.
//
// Spec §6 L166: "Plan generation UNCHANGED + assigns renderMode per node".
// Spec §6 L171: "Knowledge graph construction … populates renderMode/
// cinematicPrimitives from plan".
// Spec §7 L203: "No node ships without at least one cinematic primitive
// applied unless explicitly flagged as `cinematicPrimitives: []` in the plan."
// Migration rules: defaults are 'sprite' / null / null / [] / identity.

import { describe, expect, it } from 'vitest';
import {
  applyPlanRendererDefaults,
  validatePlanRendererFields,
} from '@/lib/prism/codegen/plan-output-hook';
import type { PrismNode } from '@/lib/prism-graph/types';

describe('applyPlanRendererDefaults', () => {
  it('sets renderMode to "sprite" when missing', () => {
    const out = applyPlanRendererDefaults({});
    expect(out.renderMode).toBe('sprite');
  });

  it('preserves an explicit renderMode', () => {
    const out = applyPlanRendererDefaults({ renderMode: 'mesh' });
    expect(out.renderMode).toBe('mesh');
  });

  it('sets cinematicPrimitives to [] when undefined (§7 L203 default branch)', () => {
    const out = applyPlanRendererDefaults({});
    expect(out.cinematicPrimitives).toEqual([]);
  });

  it('preserves an explicit empty cinematicPrimitives (§7 L203 explicit-flag branch)', () => {
    const out = applyPlanRendererDefaults({ cinematicPrimitives: [] });
    expect(out.cinematicPrimitives).toEqual([]);
  });

  it('preserves a populated cinematicPrimitives array', () => {
    const refs = [
      { name: 'orbit' as const, params: { speed: 1 }, trigger: 'load' as const },
    ];
    const out = applyPlanRendererDefaults({ cinematicPrimitives: refs });
    expect(out.cinematicPrimitives).toEqual(refs);
  });

  it('populates depthMapUrl/meshUrl as null defaults', () => {
    const out = applyPlanRendererDefaults({});
    expect(out.depthMapUrl).toBeNull();
    expect(out.meshUrl).toBeNull();
  });

  it('populates scenePosition with identity defaults', () => {
    const out = applyPlanRendererDefaults({});
    expect(out.scenePosition).toMatchObject({
      x: 0,
      y: 0,
      z: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1,
    });
  });

  it('does not mutate the input object', () => {
    const input: Partial<PrismNode> = {};
    applyPlanRendererDefaults(input);
    expect(input.renderMode).toBeUndefined();
    expect(input.cinematicPrimitives).toBeUndefined();
  });
});

describe('validatePlanRendererFields', () => {
  it('flags renderMode "parallax-plane" without depthMapUrl (§5 + §6 9.5)', () => {
    const violations = validatePlanRendererFields({
      renderMode: 'parallax-plane',
      depthMapUrl: null,
      meshUrl: null,
      cinematicPrimitives: [],
    });
    expect(
      violations.find((v) => v.rule === 'PARALLAX_REQUIRES_DEPTH_MAP'),
    ).toBeTruthy();
  });

  it('flags renderMode "mesh" without meshUrl (§5 + §6 9.6)', () => {
    const violations = validatePlanRendererFields({
      renderMode: 'mesh',
      depthMapUrl: null,
      meshUrl: null,
      cinematicPrimitives: [],
    });
    expect(
      violations.find((v) => v.rule === 'MESH_REQUIRES_MESH_URL'),
    ).toBeTruthy();
  });

  it('flags an unknown primitive name (§7 fixed library)', () => {
    const violations = validatePlanRendererFields({
      renderMode: 'sprite',
      depthMapUrl: null,
      meshUrl: null,
      cinematicPrimitives: [
        { name: 'wave-warp' as any, params: {}, trigger: 'load' },
      ],
    });
    expect(
      violations.find((v) => v.rule === 'UNKNOWN_PRIMITIVE'),
    ).toBeTruthy();
  });

  it('passes a valid sprite node with one known primitive', () => {
    const violations = validatePlanRendererFields({
      renderMode: 'sprite',
      depthMapUrl: null,
      meshUrl: null,
      cinematicPrimitives: [
        { name: 'orbit', params: { speed: 1 }, trigger: 'load' },
      ],
    });
    expect(violations).toEqual([]);
  });
});
