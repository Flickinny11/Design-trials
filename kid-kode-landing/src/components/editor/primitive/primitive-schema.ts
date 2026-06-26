'use client';

// PRISM PRIMITIVE SYSTEM — the schema (the atom's editable surface).
//
// A PRIMITIVE is a NODE whose realized form is a PARAMETRIC geometry + a MATERIAL,
// both driven by NUMBERS in this schema (spec §1). Reshape / resize / thickness /
// corner-radius / cutouts are LIVE schema edits — the geometry rebuilds instantly
// from these params (never a baked GLB, never a re-download; spec §1.1 / F-3).
//
// NODE LAW (spec §0): a PrimitiveSchema maps 1:1 to a real PrismNode via
// `schemaToNode`. The lab graph store holds the schema as the source of truth and
// derives the PrismNode so the node-authorship gate sees a genuine backing node
// (its `hasRealArtifact` keys on `meshPrimitive`, which we always emit).
//
// Isolated editor-chrome — never the unified three/webgpu graph scene. We REUSE
// the founder-approved chassis glass + worn-alloy material language (so a primitive
// MATCHES /toolbar-chassis + /keyframe-editor by construction).

import type {
  PrismNode,
  PrismIntent,
  MaterialSpec,
  MeshPrimitiveKind,
} from '@/lib/prism-graph/types';

// ── kinds ────────────────────────────────────────────────────────────────────
// P-1 ships the three foundational geometric atoms. The taxonomy (spec §8) grows
// in later phases; the engine here is kind-agnostic (schema numbers → geometry).
export type PrimitiveKind = 'pane' | 'cube' | 'sphere';

export const PRIMITIVE_KINDS: readonly PrimitiveKind[] = Object.freeze([
  'pane',
  'cube',
  'sphere',
] as const);

// A rounded-rect hole milled through a pane (spec §1.2 — parametric cutouts, NOT
// CSG; F-8). x/y are the hole CENTER in pane-local units; w/h its size; r corner.
export interface Cutout {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

// The editable geometry surface (spec §1.3). A single param bag covers all three
// kinds — each kind reads the fields it needs; the Inspector shows only those.
export interface PrimitiveParams {
  /** pane width / cube width (units). */
  width: number;
  /** pane height / cube height (units). */
  height: number;
  /** pane THICKNESS / cube DEPTH — the through-axis extent (units). */
  depth: number;
  /** pane outer corner radius / cube corner radius (units). */
  cornerRadius: number;
  /** pane front/back edge bevel — the milled-glass rim (units). */
  bevel: number;
  /** sphere radius (units). */
  radius: number;
  /** tessellation: sphere segments / pane curve segments. */
  segments: number;
  /** pane-only: rounded-rect holes milled through the glass. */
  cutouts: Cutout[];
}

// ── materials (spec §2 families — P-1 ships the approved chassis set) ──────────
// glass-* reuse the GlassPane transmission look; worn-* reuse applyWornMaterial +
// the 5 generated jewel-tone PBR sets. This is exactly the locked aesthetic.
export type MaterialKind =
  | 'glass-clear'
  | 'glass-smoke'
  | 'glass-tinted'
  | 'worn-emerald'
  | 'worn-sapphire'
  | 'worn-bronze'
  | 'worn-oxblood'
  | 'worn-gunmetal';

export const MATERIAL_KINDS: readonly MaterialKind[] = Object.freeze([
  'glass-clear',
  'glass-smoke',
  'glass-tinted',
  'worn-emerald',
  'worn-sapphire',
  'worn-bronze',
  'worn-oxblood',
  'worn-gunmetal',
] as const);

export function isGlass(kind: MaterialKind): boolean {
  return kind.startsWith('glass');
}

// Map a worn material kind → its generated PBR set key (chassis textureKey).
export const WORN_KEY: Record<string, string> = {
  'worn-emerald': 'emerald',
  'worn-sapphire': 'sapphire',
  'worn-bronze': 'bronze',
  'worn-oxblood': 'oxblood',
  'worn-gunmetal': 'gunmetal',
};

// P-2: a primitive references a library material by REGISTRY ID (spec §2.5) plus
// optional per-instance PBR param overrides. `kind` is retained for P-1 back-compat
// (legacy schemas without a materialId resolve via LEGACY_KIND_TO_ID). `materialId`
// is the source of truth when present.
export interface PrimitiveMaterial {
  kind: MaterialKind;
  /** P-2 registry id (e.g. 'metal.gold', 'gem.ruby'). When set, wins over `kind`. */
  materialId?: string;
  /** per-instance PBR param overrides applied over the registry def (P-2 tuning). */
  overrides?: Record<string, number | string | [number, number]>;
  /** hex tint multiplied over the worn albedo / smoke-glass attenuation. */
  tint: string;
  /** 0.5..1.5 — pushes roughness/clearcoat contrast (the "polish" amount). */
  contrast: number;
}

export interface PrimitiveTransform {
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
}

export interface PrimitiveSchema {
  nodeId: string;
  kind: PrimitiveKind;
  caption: string;
  params: PrimitiveParams;
  material: PrimitiveMaterial;
  transform: PrimitiveTransform;
}

// ── defaults ───────────────────────────────────────────────────────────────────
export const DEFAULT_TRANSFORM: PrimitiveTransform = {
  x: 0,
  y: 0,
  z: 0,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
  scale: 1,
};

function defaultParams(kind: PrimitiveKind): PrimitiveParams {
  switch (kind) {
    case 'pane':
      return {
        width: 3.2,
        height: 2.2,
        depth: 0.4,
        cornerRadius: 0.34,
        bevel: 0.05,
        radius: 0.38,
        segments: 24,
        cutouts: [],
      };
    case 'cube':
      return {
        width: 1.4,
        height: 1.4,
        depth: 1.4,
        cornerRadius: 0.16,
        bevel: 0.05,
        radius: 0.38,
        segments: 6,
        cutouts: [],
      };
    case 'sphere':
      return {
        width: 1.4,
        height: 1.4,
        depth: 1.4,
        cornerRadius: 0.16,
        bevel: 0.05,
        radius: 0.9,
        segments: 48,
        cutouts: [],
      };
  }
}

function defaultMaterial(kind: PrimitiveKind): PrimitiveMaterial {
  // Panes default to clear glass (the chassis pane); cubes to worn sapphire (a
  // worn-alloy button); spheres to worn bronze — all on-aesthetic out of the box.
  if (kind === 'pane') return { kind: 'glass-clear', tint: '#dbe8f2', contrast: 1 };
  if (kind === 'cube') return { kind: 'worn-sapphire', tint: '#ffffff', contrast: 1 };
  return { kind: 'worn-bronze', tint: '#ffffff', contrast: 1 };
}

// Stable monotonic id minting (per kind). No Math.random — deterministic ids make
// the authorship gate + verification reproducible.
const counters: Record<PrimitiveKind, number> = { pane: 0, cube: 0, sphere: 0 };
export function mintNodeId(kind: PrimitiveKind): string {
  counters[kind] += 1;
  return `prim-${kind}-${counters[kind]}`;
}
export function resetMintCounters() {
  counters.pane = 0;
  counters.cube = 0;
  counters.sphere = 0;
}

const KIND_LABEL: Record<PrimitiveKind, string> = {
  pane: 'Pane',
  cube: 'Cube',
  sphere: 'Sphere',
};

// Create a fresh schema for a kind (spec §5.1 — schema cloned from the template).
export function makeSchema(kind: PrimitiveKind, overrides?: Partial<PrimitiveSchema>): PrimitiveSchema {
  const nodeId = overrides?.nodeId ?? mintNodeId(kind);
  return {
    nodeId,
    kind,
    caption: overrides?.caption ?? `${KIND_LABEL[kind]} ${nodeId.split('-').pop()}`,
    params: { ...defaultParams(kind), ...(overrides?.params ?? {}) },
    material: { ...defaultMaterial(kind), ...(overrides?.material ?? {}) },
    transform: { ...DEFAULT_TRANSFORM, ...(overrides?.transform ?? {}) },
  };
}

// ── NODE LAW: schema → PrismNode (spec §0) ──────────────────────────────────────
// Every primitive schema produces a genuine PrismNode carrying `meshPrimitive` +
// `materialSpec` so it is a real graph artifact (the gate's hasRealArtifact passes)
// and round-trips through the same typed surface the production graph uses. The
// pane maps to the existing `plane` meshPrimitive marker (a thick rounded plate);
// the full parametric detail (cutouts / bevel / cornerRadius) lives in the lab
// schema the renderer reads. We DO NOT modify the production types (additive zero).
const KIND_TO_MESH: Record<PrimitiveKind, MeshPrimitiveKind> = {
  pane: 'plane',
  cube: 'cube',
  sphere: 'sphere',
};

function materialSpecFor(m: PrimitiveMaterial): MaterialSpec {
  if (isGlass(m.kind)) {
    return {
      baseColor: m.tint,
      metalness: 0,
      roughness: 0.05,
      transmission: 1,
      ior: 1.5,
      clearcoat: 1,
      clearcoatRoughness: 0.17 * m.contrast,
      thickness: 0.7,
      envMapIntensity: 1.05,
      opacity: 1,
    };
  }
  return {
    baseColor: '#ffffff',
    metalness: 1,
    roughness: 1,
    transmission: 0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.65,
    envMapIntensity: 0.95,
    normalScale: 1.35,
    opacity: 1,
  };
}

function emptyIntent(caption: string): PrismIntent {
  return {
    caption,
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
  };
}

export const LAB_HUB_ID = 'lab-hub';

export function schemaToNode(s: PrimitiveSchema): PrismNode {
  const kind = KIND_TO_MESH[s.kind];
  return {
    nodeId: s.nodeId,
    subtype: `primitive-${s.kind}`,
    parentHubId: LAB_HUB_ID,
    serviceTag: 'ui-3d',
    visual: {
      transform: { x: s.transform.x, y: s.transform.y, width: s.params.width, height: s.params.height, z: s.transform.z },
      shape: 'rounded',
    },
    intent: emptyIntent(s.caption),
    codeRef: '',
    backendRef: null,
    renderMode: 'mesh',
    contentType: '3d-object',
    meshPrimitive: {
      kind,
      params: {
        width: s.params.width,
        height: s.params.height,
        depth: s.params.depth,
        radius: s.params.radius,
        segments: s.params.segments,
      },
    },
    materialSpec: materialSpecFor(s.material),
    scenePosition: {
      x: s.transform.x,
      y: s.transform.y,
      z: s.transform.z,
      rotationX: s.transform.rotX,
      rotationY: s.transform.rotY,
      rotationZ: s.transform.rotZ,
      scaleX: s.transform.scale,
      scaleY: s.transform.scale,
      scaleZ: s.transform.scale,
    },
  };
}
