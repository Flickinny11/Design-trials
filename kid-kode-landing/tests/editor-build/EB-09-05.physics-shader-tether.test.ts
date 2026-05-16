// EB-09-05 — Physics/shader integration on tether fire (SC-051, INV-12).
//
// Spec refs:
//   §6 SC-051 (verbatim): "Physics/shader integration available for tether
//     interactions where target node's `cinematicPrimitives` declares it
//     (e.g., `displacement-transition` shader applied on tether fire)."
//   §7 INV-12 (verbatim): "Cinematic primitives are a curated fixed library
//     of exactly 9 primitives (orbit, depth-rotate, dissolve-morph,
//     displacement-transition, parallax-scroll, magnetic-cursor,
//     particle-emerge, fly-through, kinetic-text)."
//   Renderer-migration INV-11 (binding throughout the editor build): TSL
//     only — shaders authored through `three/tsl`, never raw GLSL.
//
// haltCheck (ralph-state.json EB-09-05):
//   "Target nodes with displacement-transition (or similar primitive)
//    declared apply the shader on tether fire; baseline implementation uses
//    TSL only (INV-11); snapshot shows shader visible during fire."
//
// Strategy: pin the public contract of two NEW surfaces on the tether-fire
// module, plus an INV-11 structural assertion on the shader primitive that
// SC-051 names by example.
//
//   1. `SHADER_PRIMITIVES` — readonly tuple of the cinematic-primitive names
//      whose runtime carries a TSL shader / physics integration. Must be a
//      subset of `CinematicPrimitiveName` (INV-12). The example named in
//      SC-051 — `displacement-transition` — is present; the non-shader
//      primitives (e.g. `orbit`) are absent.
//
//   2. `resolveTetherFirePrimitiveActivations(resolvedTarget, fire)` — pure
//      function that, given an EB-09-03 `TetherFireResolvedTarget` and the
//      `TetherFireEvent`, returns the subset of (primitive, target, edge)
//      activations the renderer should run. A primitive participates iff its
//      `name` is in `SHADER_PRIMITIVES`. The returned record carries the
//      target node id, the originating edge, the primitive ref, and the
//      `firedAt` timestamp so downstream code can sequence multiple
//      simultaneous fires deterministically. Pure: no input mutation, no
//      clock, no RNG, no DOM.
//
//   3. `applyTetherFirePrimitives(activations, primitivesAPI, lookupObject3D)`
//      — runtime adapter that invokes `primitivesAPI[name](target, params)`
//      for each activation, after resolving the target nodeId to a
//      `THREE.Object3D` via the supplied lookup function. Returns the
//      `PrimitiveResult[]` (timelines + cleanups) so the caller can sequence
//      and dispose. DI'd through `primitivesAPI` + `lookupObject3D` so the
//      test can verify the call shape without a Three.js renderer. When a
//      lookup returns `null` (target node not mounted), the activation is
//      skipped (no throw).
//
//   4. INV-11 structural — `displacement-transition.ts` imports from
//      `three/tsl` and does NOT mention raw `vertexShader:` / `fragmentShader:`
//      property keys or `ShaderMaterial`. (Renderer-migration §; FP forbids
//      raw GLSL.)
//
// This test MUST FAIL on commit; implementation in Step 7 makes it pass.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Object3D } from 'three';
import type { PrismEdge, PrismNode } from '@/lib/prism-graph/types';
import type {
  CinematicPrimitiveName,
  CinematicPrimitiveRef,
} from '@/lib/prism-graph/cinematic-primitives';
import {
  resolveTetherFireTargets,
  resolveTetherFirePrimitiveActivations,
  applyTetherFirePrimitives,
  SHADER_PRIMITIVES,
  type TetherFireEvent,
  type TetherFirePrimitiveActivation,
} from '@/lib/prism-graph/tether-fire';

// ----- fixtures ---------------------------------------------------------

function mkNode(
  nodeId: string,
  overrides: Partial<PrismNode> = {},
): PrismNode {
  return {
    nodeId,
    parentHubId: 'hub-a',
    subtype: 'generic',
    ...(overrides as object),
  } as unknown as PrismNode;
}

const DISPLACEMENT_PRIMITIVE: CinematicPrimitiveRef = {
  name: 'displacement-transition',
  params: { intensity: 0.4, duration: 1.2 },
  trigger: 'click',
};

const DISSOLVE_PRIMITIVE: CinematicPrimitiveRef = {
  name: 'dissolve-morph',
  params: { duration: 0.8 },
  trigger: 'hover',
};

const ORBIT_PRIMITIVE: CinematicPrimitiveRef = {
  name: 'orbit',
  params: { radius: 1.0, period: 4.0 },
  trigger: 'load',
};

// ----- SHADER_PRIMITIVES (INV-12 subset) -------------------------------

describe('EB-09-05 — SHADER_PRIMITIVES (INV-12 subset)', () => {
  it('lists the example primitive named in SC-051 ("displacement-transition")', () => {
    expect(SHADER_PRIMITIVES).toContain('displacement-transition');
  });

  it('every entry is one of the 9 fixed cinematic primitives (INV-12)', () => {
    const NINE: ReadonlyArray<CinematicPrimitiveName> = [
      'orbit',
      'depth-rotate',
      'dissolve-morph',
      'displacement-transition',
      'parallax-scroll',
      'magnetic-cursor',
      'particle-emerge',
      'fly-through',
      'kinetic-text',
    ];
    for (const name of SHADER_PRIMITIVES) {
      expect(NINE).toContain(name);
    }
  });

  it('excludes pure scene-graph animation primitives (e.g. "orbit")', () => {
    expect(SHADER_PRIMITIVES).not.toContain('orbit');
  });

  it('is immutable (frozen) so callers cannot widen the shader set at runtime', () => {
    expect(Object.isFrozen(SHADER_PRIMITIVES)).toBe(true);
  });
});

// ----- resolveTetherFirePrimitiveActivations (SC-051 core) -------------

describe('EB-09-05 — resolveTetherFirePrimitiveActivations (SC-051)', () => {
  const source = mkNode('src');
  const targetWithShader = mkNode('tgt-shader', {
    cinematicPrimitives: [DISPLACEMENT_PRIMITIVE, ORBIT_PRIMITIVE],
  });
  const targetSceneOnly = mkNode('tgt-scene', {
    cinematicPrimitives: [ORBIT_PRIMITIVE],
  });
  const targetBare = mkNode('tgt-bare');
  const edges: PrismEdge[] = [
    { from: 'src', to: 'tgt-shader', type: 'triggers' },
    { from: 'src', to: 'tgt-scene', type: 'triggers' },
    { from: 'src', to: 'tgt-bare', type: 'triggers' },
  ];
  const fire: TetherFireEvent = { sourceNodeId: 'src', firedAt: 42 };

  it('returns only the shader-capable primitives declared on the target', () => {
    const [resolvedShader] = resolveTetherFireTargets(
      [source, targetWithShader],
      [{ from: 'src', to: 'tgt-shader', type: 'triggers' }],
      fire,
    );
    const activations = resolveTetherFirePrimitiveActivations(resolvedShader, fire);
    expect(activations).toHaveLength(1);
    expect(activations[0].primitive).toEqual(DISPLACEMENT_PRIMITIVE);
    expect(activations[0].targetNodeId).toBe('tgt-shader');
  });

  it('skips targets whose declared primitives are all scene-only (no shader)', () => {
    const [resolvedSceneOnly] = resolveTetherFireTargets(
      [source, targetSceneOnly],
      [{ from: 'src', to: 'tgt-scene', type: 'triggers' }],
      fire,
    );
    const activations = resolveTetherFirePrimitiveActivations(
      resolvedSceneOnly,
      fire,
    );
    expect(activations).toEqual([]);
  });

  it('returns an empty array for a target with no cinematicPrimitives', () => {
    const [resolvedBare] = resolveTetherFireTargets(
      [source, targetBare],
      [{ from: 'src', to: 'tgt-bare', type: 'triggers' }],
      fire,
    );
    const activations = resolveTetherFirePrimitiveActivations(resolvedBare, fire);
    expect(activations).toEqual([]);
  });

  it('carries the originating edge and firedAt timestamp on every activation', () => {
    const edge: PrismEdge = {
      from: 'src',
      to: 'tgt-shader',
      type: 'triggers',
      event: 'click',
    };
    const [resolved] = resolveTetherFireTargets(
      [source, targetWithShader],
      [edge],
      fire,
    );
    const [activation] = resolveTetherFirePrimitiveActivations(resolved, fire);
    expect(activation.edge).toEqual(edge);
    expect(activation.firedAt).toBe(42);
  });

  it('preserves both shader-capable primitives when a target declares multiple', () => {
    const dual = mkNode('tgt-dual', {
      cinematicPrimitives: [DISPLACEMENT_PRIMITIVE, DISSOLVE_PRIMITIVE],
    });
    const [resolved] = resolveTetherFireTargets(
      [source, dual],
      [{ from: 'src', to: 'tgt-dual', type: 'triggers' }],
      fire,
    );
    const activations = resolveTetherFirePrimitiveActivations(resolved, fire);
    expect(activations.map((a) => a.primitive.name).sort()).toEqual(
      ['dissolve-morph', 'displacement-transition'].sort(),
    );
  });

  it('is a pure function: same input → identical output, no input mutation', () => {
    const [resolved] = resolveTetherFireTargets(
      [source, targetWithShader],
      [{ from: 'src', to: 'tgt-shader', type: 'triggers' }],
      fire,
    );
    const snapshot = JSON.parse(JSON.stringify(resolved.boundPrimitives));
    const a1 = resolveTetherFirePrimitiveActivations(resolved, fire);
    const a2 = resolveTetherFirePrimitiveActivations(resolved, fire);
    expect(a2).toEqual(a1);
    expect(resolved.boundPrimitives).toEqual(snapshot);
  });
});

// ----- applyTetherFirePrimitives (runtime adapter) ---------------------

describe('EB-09-05 — applyTetherFirePrimitives (runtime adapter)', () => {
  function makeFakeObject3D(name: string): Object3D {
    return { name, userData: {} } as unknown as Object3D;
  }

  function makeFakePrimitivesAPI() {
    const calls: Array<{
      name: CinematicPrimitiveName;
      target: Object3D;
      params: unknown;
    }> = [];
    const fakeResult = (label: string) => {
      const timeline = { label, play: () => undefined, kill: () => undefined };
      return {
        timeline,
        cleanup: () => undefined,
      };
    };
    const handler = (name: CinematicPrimitiveName) =>
      (target: Object3D, params: unknown) => {
        calls.push({ name, target, params });
        return fakeResult(name);
      };
    return {
      api: new Proxy(
        {},
        {
          get: (_t, prop) => handler(prop as CinematicPrimitiveName),
        },
      ) as unknown as Record<
        CinematicPrimitiveName,
        (t: Object3D, p: unknown) => { timeline: unknown; cleanup: () => void }
      >,
      calls,
    };
  }

  it('invokes the named primitive for each activation with target+params', () => {
    const obj = makeFakeObject3D('tgt-shader');
    const lookup = (id: string): Object3D | null =>
      id === 'tgt-shader' ? obj : null;
    const { api, calls } = makeFakePrimitivesAPI();

    const activations: TetherFirePrimitiveActivation[] = [
      {
        targetNodeId: 'tgt-shader',
        edge: { from: 'src', to: 'tgt-shader', type: 'triggers' },
        primitive: DISPLACEMENT_PRIMITIVE,
        firedAt: 1,
      },
    ];

    const results = applyTetherFirePrimitives(activations, api, lookup);
    expect(results).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('displacement-transition');
    expect(calls[0].target).toBe(obj);
    expect(calls[0].params).toEqual(DISPLACEMENT_PRIMITIVE.params);
  });

  it('silently skips activations whose target is not mounted (lookup returns null)', () => {
    const lookup = () => null;
    const { api, calls } = makeFakePrimitivesAPI();
    const activations: TetherFirePrimitiveActivation[] = [
      {
        targetNodeId: 'ghost',
        edge: { from: 'src', to: 'ghost', type: 'triggers' },
        primitive: DISPLACEMENT_PRIMITIVE,
        firedAt: 0,
      },
    ];
    const results = applyTetherFirePrimitives(activations, api, lookup);
    expect(results).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('returns results in the same order as the input activations (determinism)', () => {
    const objA = makeFakeObject3D('a');
    const objB = makeFakeObject3D('b');
    const lookup = (id: string): Object3D | null =>
      id === 'a' ? objA : id === 'b' ? objB : null;
    const { api, calls } = makeFakePrimitivesAPI();
    const activations: TetherFirePrimitiveActivation[] = [
      {
        targetNodeId: 'a',
        edge: { from: 'src', to: 'a', type: 'triggers' },
        primitive: DISPLACEMENT_PRIMITIVE,
        firedAt: 1,
      },
      {
        targetNodeId: 'b',
        edge: { from: 'src', to: 'b', type: 'triggers' },
        primitive: DISSOLVE_PRIMITIVE,
        firedAt: 2,
      },
    ];
    applyTetherFirePrimitives(activations, api, lookup);
    expect(calls.map((c) => c.name)).toEqual([
      'displacement-transition',
      'dissolve-morph',
    ]);
  });
});

// ----- INV-11 structural assertion on the shader primitive ------------

describe('EB-09-05 — displacement-transition primitive is TSL-only (INV-11)', () => {
  const PRIMITIVE_PATH = path.resolve(
    __dirname,
    '..',
    '..',
    'src',
    'lib',
    'prism',
    'runtime',
    'shared',
    'primitives',
    'displacement-transition.ts',
  );
  const SHADER_PATH = path.resolve(
    __dirname,
    '..',
    '..',
    'src',
    'lib',
    'prism',
    'runtime',
    'shared',
    'shaders',
    'displacement.tsl.ts',
  );

  it('imports from three/tsl (TSL-only authoring)', () => {
    const src = readFileSync(PRIMITIVE_PATH, 'utf8');
    expect(src).toMatch(/from\s+['"]three\/tsl['"]/);
  });

  it('does not declare raw GLSL via vertexShader:/fragmentShader: or ShaderMaterial', () => {
    const src = readFileSync(PRIMITIVE_PATH, 'utf8');
    expect(src).not.toMatch(/vertexShader\s*:/);
    expect(src).not.toMatch(/fragmentShader\s*:/);
    expect(src).not.toMatch(/\bShaderMaterial\b/);
  });

  it('the companion displacement TSL shader is sourced through tslFn helpers', () => {
    const src = readFileSync(SHADER_PATH, 'utf8');
    expect(src).toMatch(/tslFn/);
    expect(src).not.toMatch(/vertexShader\s*:/);
    expect(src).not.toMatch(/fragmentShader\s*:/);
    expect(src).not.toMatch(/\bShaderMaterial\b/);
  });
});
