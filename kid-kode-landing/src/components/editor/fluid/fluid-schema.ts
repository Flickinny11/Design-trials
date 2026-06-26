'use client';

// PRISM PRIMITIVE SYSTEM — P-3 — THE FLUID SCHEMA (the living material's editable surface).
//
// A FLUID is a NODE whose realized form is a GPU-simulated flow field driving a
// surface (or volume) material — driven entirely by NUMBERS in this schema (spec
// §3). viscosity / flowSpeed / thickness / turbulence / IOR are LIVE schema edits;
// the sim + material re-read them every frame (no rebuild, no CPU round-trip).
//
// NODE LAW (spec §0): a FluidSchema maps 1:1 to a real PrismNode via `schemaToNode`.
// The lab graph store holds the schema as the source of truth and derives the
// PrismNode so the node-authorship gate sees a genuine backing node (its
// `hasRealArtifact` keys on `meshPrimitive`, which we always emit).
//
// Isolated editor-chrome — never the unified production graph scene. We REUSE the
// founder-approved chassis transmission-glass language so liquid glass MATCHES
// /toolbar-chassis + /material-lab by construction (a fluid is glass, now flowing).

import type {
  PrismNode,
  PrismIntent,
  MaterialSpec,
  MeshPrimitiveKind,
} from '@/lib/prism-graph/types';

// ── kinds (spec §3.1 — choose per element) ──────────────────────────────────────
//   surface — a flowing transmission-glass SURFACE (screen-space velocity field
//             advected on a plane). "Liquid glass." Runs on WebGPU AND the WebGL2
//             fallback → this is the verified-everywhere core.
//   volume  — an MLS-MPM PARTICLE fluid (volumetric). Real WebGPU compute only;
//             feature-gated off on the WebGL2 fallback (the surface stands in).
export type FluidKind = 'surface' | 'volume';

export const FLUID_KINDS: readonly FluidKind[] = Object.freeze(['surface', 'volume'] as const);

// The flow PATTERN the velocity field is forced with (spec §3.2 flowDirection/pattern).
export type FlowPattern = 'directional' | 'swirl' | 'turbulent' | 'radial';
export const FLOW_PATTERNS: readonly FlowPattern[] = Object.freeze([
  'directional',
  'swirl',
  'turbulent',
  'radial',
] as const);

// The editable customization surface (spec §3.2). One param bag covers both kinds;
// each kind reads the fields it needs and the Inspector shows the relevant faders.
export interface FluidParams {
  /** togetherness — how cohesively the fluid holds (low = splashy, high = syrupy). 0..1 */
  viscosity: number;
  /** how strongly the surface beads / pulls taut at edges. 0..1 */
  surfaceTension: number;
  /** advection rate — how fast the field flows. 0..2 */
  flowSpeed: number;
  /** flow heading (radians) for the directional pattern. 0..2π */
  flowDirection: number;
  /** the force field shape applied each step. */
  pattern: FlowPattern;
  /** depth/thickness of the slab — drives refraction depth + material thickness. 0.1..2.5 */
  thickness: number;
  /** agitation — curl-noise turbulence injected into the field. 0..1 */
  turbulence: number;
  /** index of refraction — how strongly the surface bends what's behind it. 1..2.4 */
  ior: number;
  /** body tint (hex) — the attenuation colour of the glass body. */
  tint: string;
  /** surface opacity / transmission balance. 0..1 (1 = fully clear transmission). */
  opacity: number;
  /** velocity dissipation per step — how quickly motion settles. 0..1 (1 = no decay). */
  damping: number;
  /** whether pointer/scroll injects velocity into the field (spec §3.2). */
  reactsToInteraction: boolean;
}

export interface FluidTransform {
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
}

export interface FluidSchema {
  nodeId: string;
  kind: FluidKind;
  caption: string;
  /** plane footprint (units) the surface fluid occupies / the volume bounds box. */
  width: number;
  height: number;
  params: FluidParams;
  transform: FluidTransform;
}

// ── defaults ─────────────────────────────────────────────────────────────────────
export const DEFAULT_TRANSFORM: FluidTransform = {
  x: 0,
  y: 0,
  z: 0,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
  scale: 1,
};

// Premium liquid-glass out of the box — a thick, slow, cohesive cool-blue body that
// reads as the approved transmission glass, now flowing (never cartoonish/plastic).
function defaultParams(kind: FluidKind): FluidParams {
  if (kind === 'volume') {
    return {
      viscosity: 0.45,
      surfaceTension: 0.5,
      flowSpeed: 0.9,
      flowDirection: Math.PI * 0.5,
      pattern: 'turbulent',
      thickness: 1.4,
      turbulence: 0.55,
      ior: 1.33,
      tint: '#bfe3ea',
      opacity: 0.92,
      damping: 0.96,
      reactsToInteraction: true,
    };
  }
  return {
    viscosity: 0.72,
    surfaceTension: 0.6,
    flowSpeed: 0.6,
    flowDirection: Math.PI * 0.5,
    pattern: 'swirl',
    thickness: 1.6,
    turbulence: 0.32,
    ior: 1.45,
    tint: '#bfe3ea',
    opacity: 1,
    damping: 0.985,
    reactsToInteraction: true,
  };
}

// Stable monotonic id minting (per kind). No Math.random — deterministic ids make
// the authorship gate + headless verification reproducible.
const counters: Record<FluidKind, number> = { surface: 0, volume: 0 };
export function mintNodeId(kind: FluidKind): string {
  counters[kind] += 1;
  return `fluid-${kind}-${counters[kind]}`;
}
export function resetMintCounters() {
  counters.surface = 0;
  counters.volume = 0;
}

const KIND_LABEL: Record<FluidKind, string> = {
  surface: 'Liquid Glass',
  volume: 'Fluid Volume',
};

// Deterministic, non-overlapping placement slots (left/center stage band; the right
// side x ≳ 5 is reserved for the docked Inspector panel).
const SLOTS_X = [-0.4, -4.2, 2.6, -7.6];
const ROW_Y = [0.4, -2.4];
export function slotFor(index: number): { x: number; y: number } {
  const col = index % SLOTS_X.length;
  const row = Math.floor(index / SLOTS_X.length) % ROW_Y.length;
  return { x: SLOTS_X[col], y: ROW_Y[row] };
}

// Create a fresh schema for a kind (spec §5.1 — schema cloned from the template).
export function makeSchema(kind: FluidKind, overrides?: Partial<FluidSchema>): FluidSchema {
  const nodeId = overrides?.nodeId ?? mintNodeId(kind);
  return {
    nodeId,
    kind,
    caption: overrides?.caption ?? `${KIND_LABEL[kind]} ${nodeId.split('-').pop()}`,
    width: overrides?.width ?? (kind === 'volume' ? 2.6 : 3.4),
    height: overrides?.height ?? (kind === 'volume' ? 2.6 : 2.4),
    params: { ...defaultParams(kind), ...(overrides?.params ?? {}) },
    transform: { ...DEFAULT_TRANSFORM, ...(overrides?.transform ?? {}) },
  };
}

// ── NODE LAW: schema → PrismNode (spec §0) ──────────────────────────────────────
// Every fluid schema produces a genuine PrismNode carrying `meshPrimitive` +
// `materialSpec` so it is a real graph artifact (the gate's hasRealArtifact passes)
// and round-trips through the same typed surface the production graph uses. A
// surface fluid maps to the `plane` meshPrimitive marker; a volume to `cube` (its
// bounds box). The full fluid detail lives in the lab schema the renderer reads. We
// DO NOT modify the production types (additive zero — INV-18).
const KIND_TO_MESH: Record<FluidKind, MeshPrimitiveKind> = {
  surface: 'plane',
  volume: 'cube',
};

// The fluid's material is transmission glass (the approved look), tinted by the
// fluid body colour and depth — so the typed graph node carries a real glass
// materialSpec the production renderer could honour.
function materialSpecFor(p: FluidParams): MaterialSpec {
  return {
    baseColor: '#ffffff',
    metalness: 0,
    roughness: 0.05,
    transmission: p.opacity,
    ior: p.ior,
    dispersion: 1.0,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    iridescence: 0,
    iridescenceIOR: 1.3,
    thickness: p.thickness,
    normalScale: 1,
    envMapIntensity: 1.05,
    emissive: '#000000',
    emissiveIntensity: 0,
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

export const LAB_HUB_ID = 'fluid-lab-hub';

export function schemaToNode(s: FluidSchema): PrismNode {
  const kind = KIND_TO_MESH[s.kind];
  return {
    nodeId: s.nodeId,
    subtype: `fluid-${s.kind}`,
    parentHubId: LAB_HUB_ID,
    serviceTag: 'ui-3d',
    visual: {
      transform: { x: s.transform.x, y: s.transform.y, width: s.width, height: s.height, z: s.transform.z },
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
        width: s.width,
        height: s.height,
        depth: s.params.thickness,
        radius: 0,
        segments: 1,
      },
    },
    materialSpec: materialSpecFor(s.params),
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
