// P4-object-ui-helpers — 3D Object toolbar group pure helpers (canvas-spec §5
// 3D object tools; P4 Task B).
//
// Covers:
//   1. MESH_KINDS / labels — all 7 frozen primitive kinds, each with a plain
//      human label (no machine ids, no raw kind strings leaking into copy).
//   2. MESH_KIND_FADERS per-kind fader sets match the P4 scope (cube w/h/d;
//      sphere radius; cylinder/cone radius+height; torus radius+tube; capsule
//      radius+length; plane w/h) plus a whole-number Smoothness (segments)
//      fader on the curved kinds only; every config has sane bounds and the
//      frozen MESH_PRIMITIVE_DEFAULTS value sits inside them.
//   3. effectiveMeshParams defaulting (absent params → frozen defaults;
//      partial params override only their own key; input untouched).
//   4. withMeshParamPatch whole-object replacement semantics: fresh object,
//      inputs untouched, kind preserved, clamping to the kind's fader bounds,
//      segments rounded to whole numbers, only kind-relevant params kept,
//      off-kind patch keys ignored (forward-compat).
//   5. isMeshPrimitiveNode / isMeshBearingNode gates.
//   6. materialSummary resolution over MATERIAL_SPEC_DEFAULT + pctLabel.

import { describe, expect, it } from 'vitest';
import type { MeshPrimitive, PrismNode } from '@/lib/prism-graph/types';
import {
  MATERIAL_SPEC_DEFAULT,
  MESH_PRIMITIVE_DEFAULTS,
} from '@/lib/prism-graph/types';
import {
  MESH_KINDS,
  MESH_KIND_FADERS,
  MESH_KIND_LABEL,
  effectiveMeshParams,
  faderConfigsFor,
  isMeshBearingNode,
  isMeshPrimitiveNode,
  materialSummary,
  meshKindLabel,
  pctLabel,
  withMeshParamPatch,
} from '@/components/editor/object-tools/object-helpers';

function makeNode(over: Partial<PrismNode> = {}): PrismNode {
  return {
    nodeId: 'node-obj-1',
    parentHubId: 'hub-1',
    subtype: 'object',
    serviceTag: 'main',
    intent: {
      caption: 'New Cube',
      behaviorSpec: {
        interactions: [], apiCalls: [], dataBindings: [],
        emits: [], listens: [], triggersDownstream: [],
      },
      stateEffects: [],
      visualSpec: { textContent: [], layers: [] },
      contracts: { inputs: {}, outputs: {} },
    },
    codeRef: '',
    backendRef: null,
    ...over,
  } as PrismNode;
}

// ── 1. Kinds + labels ────────────────────────────────────────────────────────

describe('MESH_KINDS / labels', () => {
  it('covers exactly the 7 frozen primitive kinds', () => {
    expect([...MESH_KINDS].sort()).toEqual(
      ['capsule', 'cone', 'cube', 'cylinder', 'plane', 'sphere', 'torus'],
    );
    expect(MESH_KINDS).toHaveLength(7);
    // Same set the frozen defaults table covers — no orphan kind either way.
    expect([...MESH_KINDS].sort()).toEqual(
      Object.keys(MESH_PRIMITIVE_DEFAULTS).sort(),
    );
  });

  it('labels every kind in plain language (capitalized word, not the raw kind string)', () => {
    for (const kind of MESH_KINDS) {
      const label = meshKindLabel(kind);
      expect(label).toBe(MESH_KIND_LABEL[kind]);
      expect(label).toMatch(/^[A-Z][a-z]+$/); // one human word: 'Cube', 'Sphere', …
      expect(label.toLowerCase()).toBe(kind); // honest — names the same shape
    }
  });
});

// ── 2. Per-kind fader configs ────────────────────────────────────────────────

describe('MESH_KIND_FADERS', () => {
  it('exposes the per-kind dimension sets the P4 scope names', () => {
    const paramsOf = (kind: keyof typeof MESH_KIND_FADERS) =>
      MESH_KIND_FADERS[kind].map((c) => c.param);
    expect(paramsOf('cube')).toEqual(['width', 'height', 'depth']);
    expect(paramsOf('plane')).toEqual(['width', 'height']);
    expect(paramsOf('sphere')).toEqual(['radius', 'segments']);
    expect(paramsOf('cylinder')).toEqual(['radius', 'height', 'segments']);
    expect(paramsOf('cone')).toEqual(['radius', 'height', 'segments']);
    expect(paramsOf('torus')).toEqual(['radius', 'tube', 'segments']);
    expect(paramsOf('capsule')).toEqual(['radius', 'length', 'segments']);
  });

  it('puts a whole-number Smoothness fader on curved kinds only', () => {
    for (const kind of MESH_KINDS) {
      const seg = MESH_KIND_FADERS[kind].find((c) => c.param === 'segments');
      if (kind === 'cube' || kind === 'plane') {
        expect(seg).toBeUndefined(); // tessellation is invisible on boxy kinds
      } else {
        expect(seg).toBeDefined();
        expect(seg!.integer).toBe(true);
        expect(seg!.step).toBe(1);
        expect(seg!.label).toBe('Smoothness');
      }
    }
  });

  it('every fader has sane bounds, a plain label, and contains the frozen default', () => {
    for (const kind of MESH_KINDS) {
      for (const cfg of faderConfigsFor(kind)) {
        expect(cfg.min).toBeLessThan(cfg.max);
        expect(cfg.step).toBeGreaterThan(0);
        // Plain language: starts with a capital, no underscores/ids.
        expect(cfg.label).toMatch(/^[A-Z][A-Za-z ]+$/);
        const dflt = MESH_PRIMITIVE_DEFAULTS[kind][cfg.param];
        expect(dflt).toBeGreaterThanOrEqual(cfg.min);
        expect(dflt).toBeLessThanOrEqual(cfg.max);
      }
    }
  });
});

// ── 3. effectiveMeshParams ───────────────────────────────────────────────────

describe('effectiveMeshParams', () => {
  it('falls back to the frozen per-kind defaults when params are absent', () => {
    expect(effectiveMeshParams({ kind: 'sphere' })).toEqual(
      MESH_PRIMITIVE_DEFAULTS.sphere,
    );
    expect(effectiveMeshParams({ kind: 'cube', params: {} })).toEqual(
      MESH_PRIMITIVE_DEFAULTS.cube,
    );
  });

  it('overrides only the keys the params set (undefined falls through)', () => {
    const eff = effectiveMeshParams({
      kind: 'torus',
      params: { radius: 0.5, segments: undefined },
    });
    expect(eff.radius).toBe(0.5);
    expect(eff.tube).toBe(MESH_PRIMITIVE_DEFAULTS.torus.tube);
    expect(eff.segments).toBe(MESH_PRIMITIVE_DEFAULTS.torus.segments);
  });

  it('never mutates the input and returns a fresh object', () => {
    const prim: MeshPrimitive = { kind: 'cylinder', params: { radius: 0.4 } };
    const before = JSON.parse(JSON.stringify(prim));
    const eff = effectiveMeshParams(prim);
    eff.radius = 99;
    expect(prim).toEqual(before);
    expect(effectiveMeshParams(prim)).not.toBe(eff);
  });
});

// ── 4. withMeshParamPatch ────────────────────────────────────────────────────

describe('withMeshParamPatch', () => {
  it('returns a fresh whole meshPrimitive, preserving kind, inputs untouched', () => {
    const current: MeshPrimitive = { kind: 'cube', params: { width: 0.8 } };
    const before = JSON.parse(JSON.stringify(current));
    const next = withMeshParamPatch(current, { height: 1.1 });
    expect(next).not.toBe(current);
    expect(next.params).not.toBe(current.params);
    expect(current).toEqual(before);
    expect(next.kind).toBe('cube');
    expect(next.params?.width).toBe(0.8); // kept from current
    expect(next.params?.height).toBe(1.1); // patched
    expect(next.params?.depth).toBe(MESH_PRIMITIVE_DEFAULTS.cube.depth); // defaulted
  });

  it('clamps patched values to the kind fader bounds', () => {
    const widthCfg = MESH_KIND_FADERS.cube.find((c) => c.param === 'width')!;
    const low = withMeshParamPatch({ kind: 'cube' }, { width: -5 });
    expect(low.params?.width).toBe(widthCfg.min);
    const high = withMeshParamPatch({ kind: 'cube' }, { width: 999 });
    expect(high.params?.width).toBe(widthCfg.max);
  });

  it('rounds segments to a whole number before clamping', () => {
    const next = withMeshParamPatch({ kind: 'sphere' }, { segments: 23.6 });
    expect(next.params?.segments).toBe(24);
    const segCfg = MESH_KIND_FADERS.sphere.find((c) => c.param === 'segments')!;
    const floor = withMeshParamPatch({ kind: 'sphere' }, { segments: 0.2 });
    expect(floor.params?.segments).toBe(segCfg.min);
  });

  it('keeps only the kind-relevant params and ignores off-kind patch keys', () => {
    const next = withMeshParamPatch({ kind: 'sphere' }, { depth: 2, tube: 0.4 });
    expect(Object.keys(next.params ?? {}).sort()).toEqual(['radius', 'segments']);
    expect(next.params?.radius).toBe(MESH_PRIMITIVE_DEFAULTS.sphere.radius);
  });

  it('ignores non-finite patch values', () => {
    const next = withMeshParamPatch({ kind: 'capsule' }, { radius: Number.NaN });
    expect(next.params?.radius).toBe(MESH_PRIMITIVE_DEFAULTS.capsule.radius);
  });
});

// ── 5. Gates ─────────────────────────────────────────────────────────────────

describe('isMeshPrimitiveNode / isMeshBearingNode', () => {
  it('isMeshPrimitiveNode requires a meshPrimitive with a known kind', () => {
    expect(isMeshPrimitiveNode(null)).toBe(false);
    expect(isMeshPrimitiveNode(makeNode())).toBe(false);
    expect(
      isMeshPrimitiveNode(makeNode({ meshPrimitive: { kind: 'torus' } })),
    ).toBe(true);
    expect(
      isMeshPrimitiveNode(
        makeNode({ meshPrimitive: { kind: 'blob' as never } }),
      ),
    ).toBe(false);
  });

  it('isMeshBearingNode also admits GLB meshes (renderMode mesh) but not planes', () => {
    expect(isMeshBearingNode(makeNode({ renderMode: 'mesh' }))).toBe(true);
    expect(
      isMeshBearingNode(makeNode({ meshPrimitive: { kind: 'cube' } })),
    ).toBe(true);
    expect(isMeshBearingNode(makeNode({ renderMode: 'sprite' }))).toBe(false);
    expect(isMeshBearingNode(null)).toBe(false);
  });
});

// ── 6. Material summary ──────────────────────────────────────────────────────

describe('materialSummary / pctLabel', () => {
  it('resolves absent specs over MATERIAL_SPEC_DEFAULT', () => {
    const s = materialSummary(undefined);
    expect(s.baseColor).toBe(MATERIAL_SPEC_DEFAULT.baseColor);
    expect(s.metalness).toBe(MATERIAL_SPEC_DEFAULT.metalness);
    expect(s.roughness).toBe(MATERIAL_SPEC_DEFAULT.roughness);
  });

  it('reads set values through and leaves unset ones defaulted', () => {
    const s = materialSummary({ baseColor: '#ff8800', metalness: 0.9 });
    expect(s.baseColor).toBe('#ff8800');
    expect(s.metalness).toBe(0.9);
    expect(s.roughness).toBe(MATERIAL_SPEC_DEFAULT.roughness);
  });

  it('pctLabel formats and clamps to 0–100%', () => {
    expect(pctLabel(0)).toBe('0%');
    expect(pctLabel(0.375)).toBe('38%');
    expect(pctLabel(1)).toBe('100%');
    expect(pctLabel(-1)).toBe('0%');
    expect(pctLabel(2)).toBe('100%');
  });
});
