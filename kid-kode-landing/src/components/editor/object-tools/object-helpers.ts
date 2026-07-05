// object-helpers.ts — pure helpers for the 3D Object toolbar group
// (canvas-spec §5 3D object tools; P4 Task B). PURE + node-testable: no
// React, no DOM, no store imports — tests/editor-build/P4-object-ui-helpers
// .test.ts exercises these directly (same discipline as image-tools/
// image-helpers.ts and text-tools/text-tool-helpers.ts).
//
// Exports:
//   - MESH_KINDS / meshKindLabel — the 7 primitive kinds in picker order with
//     their plain-language labels (Cube / Sphere / … — never a machine id).
//   - MESH_KIND_FADERS / faderConfigsFor — the per-kind dimension fader set
//     the Shape section renders: which params a kind exposes, with plain
//     labels and sane min/max/step bounds. Curved kinds also get a
//     "Smoothness" (segments) fader; boxy kinds (cube / plane) don't — their
//     tessellation is invisible.
//   - effectiveMeshParams — resolve a node's meshPrimitive params over the
//     frozen MESH_PRIMITIVE_DEFAULTS so the UI always renders defined faders.
//   - withMeshParamPatch — build the NEXT whole `meshPrimitive` object from
//     the current one plus a param patch (immutable; values clamped to the
//     kind's fader bounds; segments rounded to a whole number). Callers hand
//     it to `updateNode(nodeId, { meshPrimitive: next })` as a whole-object
//     replacement — the sanctioned toolbar write route. Reshaping is live:
//     the renderer's primitive handle rebuilds geometry from the new params.
//   - isMeshPrimitiveNode / isMeshBearingNode — the Shape / Material gates.
//   - materialSummary / pctLabel — the read-only Material chip row values
//     (base color swatch + metalness % + roughness %), resolved over
//     MATERIAL_SPEC_DEFAULT. The §11 Inspector Material tab stays the editor;
//     this is only a summary.

import {
  MATERIAL_SPEC_DEFAULT,
  MESH_PRIMITIVE_DEFAULTS,
  type MaterialSpec,
  type MeshPrimitive,
  type MeshPrimitiveKind,
  type PrismNode,
} from '@/lib/prism-graph/types';

// ── Kinds + plain-language labels ────────────────────────────────────────────

/** Picker order — boxy first, then rounds, then the novelty shapes. */
export const MESH_KINDS: readonly MeshPrimitiveKind[] = [
  'cube',
  'sphere',
  'plane',
  'cylinder',
  'cone',
  'torus',
  'capsule',
] as const;

export const MESH_KIND_LABEL: Record<MeshPrimitiveKind, string> = {
  cube: 'Cube',
  sphere: 'Sphere',
  plane: 'Plane',
  cylinder: 'Cylinder',
  cone: 'Cone',
  torus: 'Torus',
  capsule: 'Capsule',
};

export function meshKindLabel(kind: MeshPrimitiveKind): string {
  return MESH_KIND_LABEL[kind];
}

// ── Per-kind fader configs ───────────────────────────────────────────────────

export type MeshParamKey = keyof Required<NonNullable<MeshPrimitive['params']>>;

export interface MeshFaderConfig {
  param: MeshParamKey;
  /** Plain-language fader label (no machine ids, no spec citations). */
  label: string;
  min: number;
  max: number;
  step: number;
  /** Whole-number param (segments). Patches round before clamping. */
  integer?: boolean;
}

// Shared bounds (scene units — the spawn envelopes sit well inside these).
const DIM = { min: 0.05, max: 2.4, step: 0.01 } as const; // width/height/depth/length
const RAD = { min: 0.05, max: 1.2, step: 0.01 } as const; // radius
const TUBE = { min: 0.02, max: 0.6, step: 0.01 } as const; // torus ring thickness
const SEG = { min: 3, max: 96, step: 1 } as const; // tessellation

const f = (
  param: MeshParamKey,
  label: string,
  b: { min: number; max: number; step: number },
  integer?: boolean,
): MeshFaderConfig => ({ param, label, ...b, ...(integer ? { integer: true } : {}) });

/** The Shape section's fader set per kind (canvas-spec §5: cube w/h/d;
 *  sphere radius; cylinder/cone radius+height; torus radius+tube; capsule
 *  radius+length; plane w/h; + smoothness where tessellation shows). */
export const MESH_KIND_FADERS: Record<MeshPrimitiveKind, MeshFaderConfig[]> = {
  cube: [
    f('width', 'Width', DIM),
    f('height', 'Height', DIM),
    f('depth', 'Depth', DIM),
  ],
  sphere: [
    f('radius', 'Radius', RAD),
    f('segments', 'Smoothness', SEG, true),
  ],
  plane: [
    f('width', 'Width', DIM),
    f('height', 'Height', DIM),
  ],
  cylinder: [
    f('radius', 'Radius', RAD),
    f('height', 'Height', DIM),
    f('segments', 'Smoothness', SEG, true),
  ],
  cone: [
    f('radius', 'Base radius', RAD),
    f('height', 'Height', DIM),
    f('segments', 'Smoothness', SEG, true),
  ],
  torus: [
    f('radius', 'Ring radius', RAD),
    f('tube', 'Ring thickness', TUBE),
    f('segments', 'Smoothness', SEG, true),
  ],
  capsule: [
    f('radius', 'Radius', RAD),
    f('length', 'Length', DIM),
    f('segments', 'Smoothness', SEG, true),
  ],
};

export function faderConfigsFor(kind: MeshPrimitiveKind): MeshFaderConfig[] {
  return MESH_KIND_FADERS[kind];
}

// ── Effective params (read over the frozen defaults) ─────────────────────────

export type EffectiveMeshParams = Required<NonNullable<MeshPrimitive['params']>>;

/** Resolve a meshPrimitive's params over MESH_PRIMITIVE_DEFAULTS[kind] so
 *  every fader has a defined value. Read-only — never mutates the input;
 *  undefined entries in `params` fall through to the default. */
export function effectiveMeshParams(prim: MeshPrimitive): EffectiveMeshParams {
  const out: EffectiveMeshParams = { ...MESH_PRIMITIVE_DEFAULTS[prim.kind] };
  const p = prim.params;
  if (p) {
    for (const key of Object.keys(out) as MeshParamKey[]) {
      const v = p[key];
      if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
    }
  }
  return out;
}

// ── Immutable whole-object patch builder ─────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Build the NEXT whole `meshPrimitive` object from the current one plus a
 *  param patch. Pure + immutable: the returned object is fresh and the input
 *  is untouched — callers hand it to `updateNode(nodeId, { meshPrimitive:
 *  next })` as a whole-object replacement (the sanctioned toolbar write
 *  route, same shape imageSpec writes use).
 *
 *  Semantics:
 *    - `kind` is preserved.
 *    - The result's params carry ONLY the kind's fader params (the keys that
 *      mean something for this shape), each resolved current-over-default
 *      then overridden by the patch.
 *    - Patched values are clamped to the kind's fader bounds; segments are
 *      rounded to a whole number first.
 *    - Patch keys that aren't faders for this kind are ignored
 *      (forward-compat, mirrors the schema's unknown-keys-ignored note). */
export function withMeshParamPatch(
  current: MeshPrimitive,
  patch: Partial<Record<MeshParamKey, number>>,
): MeshPrimitive {
  const effective = effectiveMeshParams(current);
  const configs = MESH_KIND_FADERS[current.kind];
  const params: NonNullable<MeshPrimitive['params']> = {};
  for (const cfg of configs) {
    let v = effective[cfg.param];
    const patched = patch[cfg.param];
    if (typeof patched === 'number' && Number.isFinite(patched)) {
      v = patched;
    }
    if (cfg.integer) v = Math.round(v);
    params[cfg.param] = clamp(v, cfg.min, cfg.max);
  }
  return { kind: current.kind, params };
}

// ── Gates ────────────────────────────────────────────────────────────────────

/** True when `node` carries a primitive mesh the Shape faders may reshape. */
export function isMeshPrimitiveNode(node: PrismNode | null | undefined): boolean {
  const kind = node?.meshPrimitive?.kind;
  return typeof kind === 'string' && (MESH_KINDS as readonly string[]).includes(kind);
}

/** True when `node` renders as a lit 3D surface the Material summary / jump
 *  key applies to: a primitive mesh, or a GLB mesh (renderMode 'mesh'). */
export function isMeshBearingNode(node: PrismNode | null | undefined): boolean {
  if (!node) return false;
  return isMeshPrimitiveNode(node) || node.renderMode === 'mesh';
}

// ── Material summary (read-only chip row) ────────────────────────────────────

export interface MaterialSummary {
  /** Resolved base/albedo color (hex) for the swatch chip. */
  baseColor: string;
  /** Resolved 0..1 values for the % chips. */
  metalness: number;
  roughness: number;
}

/** Resolve the three summary values over MATERIAL_SPEC_DEFAULT. Read-only —
 *  the §11 Inspector Material tab stays the single material editor; this row
 *  only reports what's set so the flyout feels complete. */
export function materialSummary(spec?: MaterialSpec | null): MaterialSummary {
  return {
    baseColor: spec?.baseColor ?? MATERIAL_SPEC_DEFAULT.baseColor ?? '#c8ccd8',
    metalness: spec?.metalness ?? MATERIAL_SPEC_DEFAULT.metalness ?? 0,
    roughness: spec?.roughness ?? MATERIAL_SPEC_DEFAULT.roughness ?? 0.5,
  };
}

/** "37%" formatting for the summary chips (and fader readouts). */
export function pctLabel(v: number): string {
  return `${Math.round(clamp(v, 0, 1) * 100)}%`;
}
