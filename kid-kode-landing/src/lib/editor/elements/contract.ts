// Prebuilt element library — the FROZEN cluster contract (PRISM-CANVAS-EDITOR-
// SPEC.md §13). A library entry is a parameterized "element-cluster": a named,
// captioned set of member nodes (positions / materials / lighting / default
// animationBindings) plus a hover-preview hint and a builtSnapshot poster.
// Drag-to-place instantiates the cluster as a `groupId` subtree in the live
// graph, every member tethered to the current hub (criterion 21, INV-7).
//
// CONTRACT-FIRST: this file is the single typed surface the library UI (Phase 1)
// and every element definition (Phase 2) build against. It is ADDITIVE-ONLY
// (INV-8 / INV-18): it introduces no new graph field — a cluster member is just
// a template that produces a valid `useGraphSourceStore.addNode` input (the
// exact shape `create-element-node.ts` already returns). Nothing here mutates
// graph topology or the node system (INV-1).
//
// A placed member flows through the EXISTING build path unchanged: createNode /
// default-factory assembles it, `computeNodeContentHash` keys its builtSnapshot,
// editing one member rebuilds only that member (criterion 23). The library adds
// no special snapshot handling — it only creates real nodes.
//
// Home: `src/lib/editor/**` (editor scope) — NOT `src/lib/prism/**` (runtime
// scope), so `@/` alias imports of the schema are permitted (same as
// node-content-hash.ts / rebuild-node.ts / clone-commit.ts).

import type {
  AnimationBinding,
  CinematicPrimitiveRef,
  DepthLayer,
  ImageSpec,
  LightingSpec,
  LightingTier,
  LightingTierPreference,
  MaterialSpec,
  MeshPrimitive,
  PrismVec3,
  RenderMode,
  ScenePosition,
  ScrollBinding,
  TextSpec,
} from '@/lib/prism-graph/types';

// ── Categories (span of spec §13 + the "many more UI enhancers" mandate) ────
// The §13-named five come first; the rest are the UI-enhancer expansion. The
// browser groups tiles by this label. Adding a category here is additive.
export const ELEMENT_CATEGORIES = [
  'carousel',
  'wheel',
  'slider',
  'hero',
  'banner',
  'gallery',
  'card-stack',
  'navigation',
  'showcase',
  'marquee',
  'feature-grid',
  'testimonial',
  'pricing',
  'stat-counter',
  'cta',
  'logo-cloud',
] as const;
export type ElementCategory = (typeof ELEMENT_CATEGORIES)[number];

/** Plain-language section title for a category (browser group header). */
export const ELEMENT_CATEGORY_LABEL: Record<ElementCategory, string> = {
  carousel: 'Carousels',
  wheel: 'Wheels',
  slider: 'Sliders',
  hero: 'Heroes',
  banner: 'Banners',
  gallery: 'Galleries',
  'card-stack': 'Card Stacks',
  navigation: 'Navigation',
  showcase: 'Showcases',
  marquee: 'Marquees',
  'feature-grid': 'Feature Grids',
  testimonial: 'Testimonials',
  pricing: 'Pricing',
  'stat-counter': 'Stat Counters',
  cta: 'Calls to Action',
  'logo-cloud': 'Logo Clouds',
};

// ── A cluster member template ───────────────────────────────────────────────
// Lean by design: `buildClusterNodeInputs` (instantiate.ts) flares this into a
// full, valid `addNode` input — filling the `intent` boilerplate, the
// `visual.transform` envelope from `footprint`, and re-minting binding ids.
// Every look/behavior field below is a real, editable PrismNode field, so a
// placed member is customizable exactly like any hand-authored node (Phase 3).
export interface ClusterMemberTemplate {
  /** Unique key within the cluster (stable; used for captions + preview). */
  localId: string;
  /** PrismNode.subtype (e.g. 'element', 'card', 'text'). */
  subtype: string;
  /** PrismNode.serviceTag. Default 'decor'. */
  serviceTag?: string;
  /** Seed for intent.caption (the living spec, §15.2). */
  caption: string;
  /** How this member renders (mesh / plane / parallax-plane / text / sprite). */
  renderMode: RenderMode;
  /** LOCAL pose relative to the cluster origin. The instantiator adds the drop
   *  anchor to x/y/z; rotation/scale carry through unchanged. */
  pose: ScenePosition;
  /** Selection-envelope footprint in scene units (drives visual.transform
   *  width/height — the marquee/selection-ring sizes from max(w,h), mirroring
   *  AssembledSceneNode). */
  footprint: { width: number; height: number };

  // ── Look + behavior (all editable post-place; safe-defaulted when absent) ──
  /** Procedural geometry (cube/sphere/cylinder/cone/torus/capsule/plane). A
   *  member carrying this is born Populated — the geometry IS its artifact. */
  meshPrimitive?: MeshPrimitive;
  /** PBR material params (MeshPhysicalNodeMaterial). Consumed for meshes and
   *  opted-in lit planes. */
  materialSpec?: MaterialSpec;
  /** Per-element lighting override (local lights / env / tier). */
  lightingSpec?: LightingSpec;
  /** Whether this member participates in scene lighting. Absent → derived per
   *  renderMode (planes unlit, meshes lit) via receivesLightingDefault. */
  receivesLighting?: boolean;
  /** Real MSDF text contract for renderMode:'text' members (INV-11). */
  textSpec?: TextSpec;
  /** Image presentation (fit/crop/cornerRadius/opacity) for image planes. */
  imageSpec?: ImageSpec;
  /** Image artifact URL → visual.sourceAsset (upload/url/generated all resolve
   *  to a URL). Premium hero imagery from the Prism Media Generator lands here. */
  sourceAsset?: string;
  /** GLB mesh artifact URL → meshUrl (generated/imported geometry). */
  meshUrl?: string | null;
  /** Depth map for parallax-plane members. */
  depthMapUrl?: string | null;
  /** The member's INTEGRATED animation: catalog-primitive bindings (the ~406
   *  Animatable registry) + driver + param overrides. Ids are re-minted per
   *  placed node by the instantiator. This is what makes the element move
   *  out-of-the-box; it stays fully swappable via the Animation Picker (§8.3). */
  animationBindings?: AnimationBinding[];
  /** Per-element scroll choreography (scroll-timeline coordinate space). */
  scrollBinding?: ScrollBinding[];
  /** Cinematic primitive refs (the curated 9) where a member uses one. */
  cinematicPrimitives?: CinematicPrimitiveRef[];
  /** Layer bucket for the depth compositor. Absent → 'content'. */
  depthLayer?: DepthLayer;
}

// ── Hover-preview contract ───────────────────────────────────────────────────
// The library tile renders the REAL cluster (member nodes assembled via the
// same node-build path Canvas uses) with its integrated animation looping —
// richer than the single-subject primitive tiles. The preview spec is the hint
// the shared-rig preview renderer (Phase 1) consumes to frame + play it.
export interface ClusterPreviewSpec {
  /** Orbit framing for the preview camera around the cluster centroid. */
  camera?: {
    distance?: number;
    /** Polar angle (radians from +Y). */
    polar?: number;
    /** Azimuth angle (radians). */
    azimuth?: number;
    target?: PrismVec3;
  };
  /** The integrated-animation phase (0..1) the tile FREEZES at when not
   *  hovered — pick the most legible still. Default 0.45. */
  frozenPhase?: number;
  /** Loop length (seconds) for the integrated preview animation. Default 4. */
  loopSeconds?: number;
  /** Lighting tier the preview renders at. Default 'T1'. */
  tier?: LightingTier;
  /** Optional pre-rendered poster (instant gallery load + the library entry's
   *  builtSnapshot, §13). Absent → the live shared-rig render is the preview. */
  posterUrl?: string;
}

// ── The FROZEN library-entry definition ──────────────────────────────────────
export interface ElementClusterDefinition {
  /** Stable registry id, kebab-case (e.g. 'carousel-photoreal-ring'). */
  id: string;
  /** Human label for the tile + report gallery. */
  label: string;
  category: ElementCategory;
  /** The library entry's own caption (§13). */
  caption: string;
  /** One-line tile description. */
  description: string;
  /** The member templates — one PrismNode per member at place time. */
  members: ClusterMemberTemplate[];
  /** Hover-preview hint. */
  preview: ClusterPreviewSpec;
  /** Optional scene-lighting recommendation applied at place time (to the
   *  members; never forces a hub-wide change unless the placement opts in). */
  sceneLighting?: LightingSpec;
  /** DESIGN-REFERENCES.md entries this element visibly uses — drives the
   *  dependency-usage table in the report (run OUTPUT). */
  designRefs: string[];
  /** Full-fidelity capability tier (INV-9). The element MUST still read well
   *  degraded to T0 (clean fallback, never broken). */
  tier: LightingTierPreference;
  /** Flagship ordering hint for the browser (featured first). */
  featured?: boolean;
}

/** Default preview values (applied when a definition omits a field). */
export const CLUSTER_PREVIEW_DEFAULT: Required<Omit<ClusterPreviewSpec, 'camera' | 'posterUrl'>> = {
  frozenPhase: 0.45,
  loopSeconds: 4,
  tier: 'T1',
};
