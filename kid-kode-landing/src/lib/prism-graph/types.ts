// Canonical TypeScript shape of `home-hub.json`. The editor reads through this
// surface so that the Inspector, GraphScene, and downstream tooling all agree
// on a single typed view of the mock-app graph.
//
// Plan ref: /Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md §Phase 1.
//
// The eight 2026-04-27 caption-enrichment fields are first-class: samHints,
// alphaCutout, animationSpec, visualNeighbors, interactionNeighbors,
// responsiveSizing, visibility, and visualSpec.layers. Hub-level: hub.caption
// and hub.responsiveBreakpoints.
//
// Renderer-migration additions (PRISM-RENDERER-MIGRATION-SPEC.md §4): five
// fields on PrismNode — renderMode, depthMapUrl, meshUrl, cinematicPrimitives,
// scenePosition — are additive and optional. Legacy graphs without them
// render in 'sprite' mode at the identity pose with no primitives applied.

import type { CinematicPrimitiveRef } from './cinematic-primitives.ts';
import type { CapabilityRef, PrismRootNode } from './root-node.ts';
import type { UiAnchor } from './compile-anchors.ts';

export type { CinematicPrimitiveRef } from './cinematic-primitives.ts';
export type { CapabilityRef, PrismRootNode } from './root-node.ts';
export type { UiAnchor } from './compile-anchors.ts';

export type RenderMode = 'sprite' | 'plane' | 'parallax-plane' | 'mesh';

export interface ScenePosition {
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

export const RENDER_MODE_DEFAULT: RenderMode = 'sprite';

export const SCENE_POSITION_DEFAULT: ScenePosition = {
  x: 0,
  y: 0,
  z: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
};

// EB-05-03 / §6 Phase 5 SC-025, Phase 8 SC-041, SC-042 (INV-18 additive).
// Shape mirrors ScenePosition so the canvas-mode gizmo can drive every axis
// (translate/rotate/scale) without colliding with the renderer-migration
// `scenePosition` runtime field. The canvas-transform-gizmo helper owns the
// math + cancel-restore semantics; this type is the persisted record.
export interface CanvasTransform {
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

// EB-08-01 / §8 SC-041 (INV-18 additive). The hub-world-mode per-node pose
// the Inspector + selection-driven gizmos write to. Shape mirrors
// ScenePosition so the Phase 8 transform editor can drive every axis without
// disturbing the renderer-migration `scenePosition` runtime field (SC-042).
export type EditorTransform = ScenePosition;

export const EDITOR_TRANSFORM_DEFAULT: EditorTransform = {
  x: 0,
  y: 0,
  z: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
};

// EB-08-01 / §8 (INV-18 additive). The resolved final pose written by
// non-destructive compile passes (compile-anchors / compile-hub / preview*).
// Cached, non-canonical: source-of-truth remains `editorTransform` +
// `canvasTransform` + the anchor rule table. Consumers MAY re-derive at any
// time; compile functions read source fields and write only here (INV-17 /
// FP-04 still forbid writes to scenePosition/editorTransform/canvasTransform).
export type CompiledTransform = ScenePosition;

export const COMPILED_TRANSFORM_DEFAULT: CompiledTransform = {
  x: 0,
  y: 0,
  z: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
};

// EB-08-01 / §8 (INV-18 additive). The layered scene-graph layer assignment
// for a node. Mirrors the editor-build gap-analysis §3 schema delta. The
// runtime layer compositor (Phase 7) groups nodes into these six z-buckets;
// `content` is the default for legacy graphs that pre-date this field.
export type DepthLayer =
  | 'environment'
  | 'background'
  | 'midground'
  | 'content'
  | 'foreground-FX'
  | 'overlay';

export const DEPTH_LAYER_VALUES: readonly DepthLayer[] = Object.freeze([
  'environment',
  'background',
  'midground',
  'content',
  'foreground-FX',
  'overlay',
] as const);

export const DEPTH_LAYER_DEFAULT: DepthLayer = 'content';

// ===========================================================================
// Material + Lighting subsystem (PRISM-CANVAS-EDITOR-SPEC §10/§11, INV-8/INV-9).
// All fields below are ADDITIVE-ONLY with safe defaults (INV-18). They round-trip
// through save/reload exactly like scenePosition/canvasTransform. No existing
// shared-interface field is renamed or removed.
// ===========================================================================

// §10 capability tiers (INV-9). `T0` = IBL + ambient (all devices incl. mobile);
// `T1` = dynamic key/fill/rim + point/spot + soft shadows (workhorse); `T2` =
// T1 + screen-space GI/AO (+ optional SSR/TRAA), WebGPU desktop only. `'auto'`
// asks the runtime capability detector to pick the highest tier the device can
// hold. Heavy effects are NEVER the default path — `'auto'` degrades to T0/T1.
export type LightingTier = 'T0' | 'T1' | 'T2';
export type LightingTierPreference = LightingTier | 'auto';

export const LIGHTING_TIER_VALUES: readonly LightingTier[] = Object.freeze([
  'T0',
  'T1',
  'T2',
] as const);

// §10 light types. `rim` is a back-positioned directional preset (edge light).
export type PrismLightType =
  | 'ambient'
  | 'hemisphere'
  | 'directional'
  | 'point'
  | 'spot'
  | 'rim';

export interface PrismVec3 {
  x: number;
  y: number;
  z: number;
}

// §10 / §5 Lighting group — one configurable scene light. `id` + `type` required;
// everything else optional with runtime defaults so the editor can add a light
// with a single click and tune it incrementally. Additive only (INV-18).
export interface PrismLight {
  id: string;
  type: PrismLightType;
  /** Hex color, e.g. '#ffffff'. */
  color?: string;
  /** Secondary/ground color for `hemisphere` lights. */
  groundColor?: string;
  intensity?: number;
  position?: PrismVec3;
  /** Aim point for directional/spot/rim lights. */
  target?: PrismVec3;
  /** point/spot falloff distance (0 = infinite). */
  distance?: number;
  /** point/spot physical decay. */
  decay?: number;
  /** spot cone half-angle in radians. */
  angle?: number;
  /** spot edge softness 0..1. */
  penumbra?: number;
  /** Whether this light casts shadows (honored at T1+). */
  castShadow?: boolean;
}

// §10 per-hub AND per-element lighting configuration (decision 5). Additive with
// safe defaults; an empty/absent spec falls back to the runtime default rig.
export interface LightingSpec {
  /** Tier preference; `'auto'` lets capability detection choose (INV-9). */
  tier?: LightingTierPreference;
  /** Configurable light list. Absent/empty → runtime default 3-point rig. */
  lights?: PrismLight[];
  /** IBL/env-map URL override. `null`/absent → procedural studio IBL (PMREM). */
  envMapUrl?: string | null;
  /** Environment (IBL) reflection intensity. */
  envIntensity?: number;
  /** Global ambient floor intensity. */
  ambientIntensity?: number;
  /** Soft-shadow radius 0..1 (0 = crisp, 1 = very soft). Maps to PCFSoft/VSM. */
  shadowSoftness?: number;
}

export const LIGHTING_SPEC_DEFAULT: LightingSpec = {
  tier: 'auto',
  lights: [],
  envMapUrl: null,
  envIntensity: 1,
  ambientIntensity: 0.25,
  shadowSoftness: 0.5,
};

// §11 per-node material (decision 4) — `MeshPhysicalNodeMaterial` params. All
// optional; the material system fills unset fields from MATERIAL_SPEC_DEFAULT.
// Only meshes/splats consume this for visible PBR; image-planes ignore it unless
// `receivesLighting` opts them in. Additive only (INV-18).
export interface MaterialSpec {
  /** Base/albedo color, hex. */
  baseColor?: string;
  metalness?: number;
  roughness?: number;
  /** 0 = opaque, 1 = fully transmissive (glass). */
  transmission?: number;
  /** Index of refraction (1.0 air … ~2.4 diamond). */
  ior?: number;
  /** Chromatic dispersion strength (Abbe-style), 0 = none. */
  dispersion?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  /** Thin-film iridescence 0..1 (soap-bubble / oil-slick look). */
  iridescence?: number;
  iridescenceIOR?: number;
  /** Refraction slab thickness (transmission depth). */
  thickness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  /** Normal-map influence. */
  normalScale?: number;
  /** Displacement-map influence. */
  displacementScale?: number;
  /** IBL/env reflection strength on this material. */
  envMapIntensity?: number;
  /** 0..1 surface opacity (independent of transmission). */
  opacity?: number;
  /** Optional texture URLs (loaded via ctx loaders, cached). */
  normalMapUrl?: string | null;
  displacementMapUrl?: string | null;
}

export const MATERIAL_SPEC_DEFAULT: MaterialSpec = {
  baseColor: '#c8ccd8',
  metalness: 0,
  roughness: 0.5,
  transmission: 0,
  ior: 1.5,
  dispersion: 0,
  clearcoat: 0,
  clearcoatRoughness: 0.1,
  iridescence: 0,
  iridescenceIOR: 1.3,
  thickness: 0.5,
  emissive: '#000000',
  emissiveIntensity: 0,
  normalScale: 1,
  displacementScale: 0,
  envMapIntensity: 1,
  opacity: 1,
  normalMapUrl: null,
  displacementMapUrl: null,
};

// ── Canvas-spec §7 Text System (INV-8 additive, INV-11) ────────────────────
// `TextSpec` is the per-node text contract: real-font MSDF letterforms only —
// the fill may be AI-generated TEXTURE, the letter SHAPES never are (INV-11).
// All fields optional; the text system fills unset fields from
// TEXT_SPEC_DEFAULT. Round-trips through save/reload (criterion 26).

/** How a text fill paints the glyph coverage. The MSDF coverage is ALWAYS the
 *  mask — every fill kind pours pigment into real letterforms (INV-11). */
export type TextFill =
  | { kind: 'solid'; color: string }
  | {
      kind: 'gradient';
      from: string;
      to: string;
      /** Gradient angle in degrees over the text block (0 = left→right). */
      angleDeg?: number;
    }
  | { kind: 'texture'; url: string }
  | {
      kind: 'ai-texture';
      /** Natural-language look description ("molten gold", "hairy moss"). */
      prompt: string;
      /** Resolved texture URL once generated; absent while pending. */
      url?: string;
    };

export interface TextOutlineSpec {
  color?: string;
  /** Outline width as a fraction of the MSDF distance range, 0..1. */
  width?: number;
}

export interface TextGlowSpec {
  color?: string;
  /** 0 = off. Drives emissiveIntensity on the glyph material. */
  intensity?: number;
}

export interface TextShadowSpec {
  color?: string;
  /** Offset in em units (fraction of fontSize). */
  offsetX?: number;
  offsetY?: number;
  opacity?: number;
}

export interface TextSpec {
  /** The literal string (line breaks via '\n'). */
  content?: string;
  /** Font family name as listed by the font manifest (e.g. 'Inter'). */
  fontFamily?: string;
  /** Em height in scene units. */
  fontSize?: number;
  /** Numeric weight (400, 700, …) — must exist in the family's atlas set. */
  fontWeight?: number;
  /** Extra inter-glyph advance in em units (fraction of fontSize). */
  letterSpacing?: number;
  /** Line height multiplier (1 = font default). */
  lineHeight?: number;
  align?: 'left' | 'center' | 'right';
  fill?: TextFill;
  outline?: TextOutlineSpec;
  glow?: TextGlowSpec;
  shadow?: TextShadowSpec;
  /** 0..1 whole-object opacity. */
  opacity?: number;
  /** Animation unit granularity for text-animation primitives (§7.5). */
  decompose?: 'glyph' | 'word' | 'line';
}

export const TEXT_SPEC_DEFAULT: TextSpec = {
  content: 'Text',
  fontFamily: 'Inter',
  fontSize: 0.4,
  fontWeight: 400,
  letterSpacing: 0,
  lineHeight: 1,
  align: 'center',
  fill: { kind: 'solid', color: '#e8e4da' },
  opacity: 1,
  decompose: 'glyph',
};

// §10 decision 7 / §10 `receivesLighting` SAFE DEFAULT. Image-bearing render
// modes default UNLIT so the diffusion-baked look is preserved pixel-identical;
// generated geometry (mesh) defaults LIT. `'sprite'` and `'parallax-plane'`
// are image planes → unlit. Text opts in elsewhere (textSpec), default unlit.
// Splats are lit by default but have no `RenderMode` literal yet (mesh-routed).
export function receivesLightingDefault(renderMode?: RenderMode): boolean {
  return renderMode === 'mesh';
}

export interface PrismHubLayout {
  viewportWidth: number;
  viewportHeight: number;
  contentHeight: number;
  backgroundColor: string;
  // Spec amendment 0002 — URL of the rendered hub mockup image; runtime
  // composes it as a backdrop plane behind nodes; editor textures the
  // hub-hull sphere with the same image. null = no mockup yet (Stage 0).
  mockupUrl?: string | null;
}

export interface PrismHubResponsiveBreakpoint {
  maxWidth: number;
  scale: number;
}

export interface PrismHubResponsiveBreakpoints {
  mobile?: PrismHubResponsiveBreakpoint;
  tablet?: PrismHubResponsiveBreakpoint;
  desktop?: PrismHubResponsiveBreakpoint;
  [key: string]: PrismHubResponsiveBreakpoint | undefined;
}

// Phase 7 / §7 SC-036 — attachment vocabulary for a hub's background layer
// stack. The five members are the canonical set; mirrored by
// `CompiledHubAttachment` in `compiled-view.ts` so the compile path consumes
// source layers without rename. `'viewport-fixed'` pins the layer to the
// viewport during scroll (SC-033). `'camera-locked'` welds it to the camera
// (HUD-style backdrops). `'parallax'` scrolls at a depth-derived rate.
// `'world'` anchors in hub-scene world space. `'infinite-environment'`
// reserves for skybox-style infinite-distance environments.
export type PrismHubBackgroundAttachment =
  | 'viewport-fixed'
  | 'camera-locked'
  | 'parallax'
  | 'world'
  | 'infinite-environment';

// §7 SC-036 — source-graph background layer. `id` and `attachment` are
// required; `sourceUrl`, `z`, `opacity`, and `parallaxDepth` are optional and
// default at compile time. Additive only (INV-18).
export interface PrismHubBackgroundLayer {
  id: string;
  attachment: PrismHubBackgroundAttachment;
  sourceUrl?: string | null;
  z?: number;
  opacity?: number;
  parallaxDepth?: number;
}

export interface PrismHub {
  hubId: string;
  title: string;
  caption?: string;
  layout: PrismHubLayout;
  responsiveBreakpoints?: PrismHubResponsiveBreakpoints;
  // §7 SC-037 — optional multi-layer background stack. Legacy
  // `layout.mockupUrl` is retained as the single-layer reader; when
  // `background` is present the compile path may prefer it. Optional per
  // INV-18 (additive schema growth).
  background?: PrismHubBackgroundLayer[];
  // §10 decision 5 (INV-8 additive). Per-HUB lighting configuration: the light
  // list, env/IBL, shadow softness, and tier preference for this page. Absent →
  // the runtime default 3-point rig + procedural studio IBL. A node's own
  // `lightingSpec` (per-element) overrides this for that node.
  lightingSpec?: LightingSpec;
}

export interface PrismVisualTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
}

export interface PrismVisual {
  sourceAsset?: string;
  transform: PrismVisualTransform;
  shape?: 'rect' | 'rounded' | 'circle' | 'pill' | string;
  shapeRadius?: number;
  alpha?: number;
  overlayRegions?: string[];
  frameCount?: number;
  transformByBreakpoint?: Record<string, Partial<PrismVisualTransform>>;
  visibleAtBreakpoints?: string[];
}

export interface PrismTextContent {
  text: string;
  role: string;
  renderMethod: string;
  typography?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    color?: string;
    [k: string]: unknown;
  };
  position?: {
    x?: number;
    y?: number;
    anchor?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export interface PrismLayer {
  id: string;
  type: 'sprite' | 'overlay' | 'text' | string;
  z?: number;
  region?: string;
  overlayRegion?: string;
  blendMode?: string;
  defaultAlpha?: number;
  mask?: { shape?: string; radius?: number; [k: string]: unknown };
  // §10 decision 5 (INV-8 additive). Optional per-layer (sub-element) lighting
  // override. Absent → inherits the node's then the hub's lightingSpec. The
  // index signature already permitted this untyped; declared for type-safety.
  lightingSpec?: LightingSpec;
  [k: string]: unknown;
}

export interface PrismVisualSpec {
  sourceAsset?: string;
  textContent: PrismTextContent[];
  layers: PrismLayer[];
  animationSpec?: { method?: number; fps?: number; frameCount?: number; [k: string]: unknown };
  [k: string]: unknown;
}

export interface PrismInteraction {
  event: string;
  effect: string;
  [k: string]: unknown;
}

export interface PrismApiCall {
  endpoint: string;
  method: string;
  [k: string]: unknown;
}

export interface PrismDataBinding {
  source: string;
  target: string;
  [k: string]: unknown;
}

export interface PrismTriggerSpec {
  eventName: string;
  targetNodeIds: string[];
  toleranceMs?: number;
  [k: string]: unknown;
}

export interface PrismBehaviorSpec {
  interactions: PrismInteraction[];
  apiCalls: PrismApiCall[];
  dataBindings: PrismDataBinding[];
  emits: string[];
  listens: string[];
  triggersDownstream: PrismTriggerSpec[];
}

export interface PrismContracts {
  inputs: Record<string, string>;
  outputs: Record<string, string>;
}

export interface PrismSamHints {
  elementType: string;
  visualNouns?: string[];
  material?: string;
  finish?: string;
  textureProfile?: string;
  [k: string]: unknown;
}

export interface PrismAlphaCutout {
  necessity: 'none' | 'soft' | 'hard' | string;
  backgroundAffinity?: string;
  antialiasHint?: string;
  [k: string]: unknown;
}

export interface PrismAnimationKeyframe {
  target: string;
  property: string;
  from?: number | string;
  to: number | string;
  duration?: number;
  ease?: string;
  [k: string]: unknown;
}

export type PrismAnimationSpec = Record<string, PrismAnimationKeyframe[] | unknown>;

export interface PrismVisualNeighbors {
  parentSection: string | null;
  overlappingLayers: string[];
  spatialAdjacency: string[];
}

export interface PrismInteractionNeighbors {
  triggers: Array<{ nodeId: string; event: string }>;
  listensTo: Array<{ nodeId: string; event: string }>;
}

export interface PrismResponsiveSizing {
  [breakpoint: string]: { width?: number; height?: number; scale?: number; [k: string]: unknown };
}

export interface PrismVisibility {
  renderInCurrentMockup: boolean;
  reason?: string;
  [k: string]: unknown;
}

export interface PrismIntent {
  caption: string;
  behaviorSpec: PrismBehaviorSpec;
  stateEffects: string[];
  visualSpec: PrismVisualSpec;
  contracts: PrismContracts;
  samHints?: PrismSamHints;
  alphaCutout?: PrismAlphaCutout;
  animationSpec?: PrismAnimationSpec;
  visualNeighbors?: PrismVisualNeighbors;
  interactionNeighbors?: PrismInteractionNeighbors;
  responsiveSizing?: PrismResponsiveSizing;
  visibility?: PrismVisibility;
  [k: string]: unknown;
}

export interface PrismNode {
  nodeId: string;
  subtype: string;
  parentHubId: string;
  serviceTag: string;
  visual: PrismVisual;
  intent: PrismIntent;
  codeRef: string;
  backendRef: string | null;
  // Renderer-migration additions (spec §4). Optional for backward compat with
  // legacy graphs; defaults: 'sprite' / null / null / [] / identity pose.
  renderMode?: RenderMode;
  depthMapUrl?: string | null;
  meshUrl?: string | null;
  cinematicPrimitives?: CinematicPrimitiveRef[];
  scenePosition?: ScenePosition;
  // EB-05-03 / §6 Phase 5 SC-025, Phase 8 SC-041, SC-042 (INV-18 additive).
  // Per-node transform written by the canvas-mode gizmo. Never mutated by
  // compile/organize/preview functions (INV-17 / FP-04). When absent, the
  // canvas gizmo treats the node as identity (CANVAS_TRANSFORM_IDENTITY).
  // scenePosition is the renderer-migration runtime field and stays
  // untouched by canvas-mode edits (SC-042).
  canvasTransform?: CanvasTransform;
  // EB-08-01 / §8 SC-041 (INV-18 additive). The hub-world-mode per-node pose
  // written by the Inspector + selection gizmos. Default: identity
  // (EDITOR_TRANSFORM_DEFAULT). See `EditorTransform` for shape semantics.
  editorTransform?: EditorTransform;
  // EB-08-01 / §8 (INV-18 additive). Cached resolved pose produced by the
  // non-destructive compile path. Not canonical: compile functions may
  // overwrite this freely; the source-of-truth is editorTransform +
  // canvasTransform + the anchor rule table.
  compiledTransform?: CompiledTransform;
  // EB-08-01 / §6 SC-031 (INV-18 additive). Source-side anchor abstraction.
  // When absent, callers pick via `pickUiAnchor(subtype, intent, serviceTag)`
  // in `compile-anchors.ts`; explicit value here overrides the rule table.
  uiAnchor?: UiAnchor;
  // EB-08-01 / §8 (INV-18 additive). Layered scene-graph layer assignment.
  // When absent, the Phase 7 layer compositor treats the node as `content`
  // (DEPTH_LAYER_DEFAULT).
  depthLayer?: DepthLayer;
  // EB-02-06 / SC-009: optional capability references on the node. The vault
  // resolves these server-side; raw secret values never appear here (INV-19).
  capabilityRefs?: CapabilityRef[];
  // EB-07-04 / §7 SC-039: optional per-node scroll bindings. Each entry maps
  // `scrollProgress: 0→1` (the `scroll-timeline` coordinate space from §4)
  // onto a single transform/material property via `from→to`. The runtime
  // `applyScrollBindings(obj, bindings, progress)` consumer drives the node
  // per-element so scrolling reads as app UI, not whole-scene movement
  // (SC-040). Additive only (INV-18); legacy graphs without the field
  // continue to render at their authored pose.
  scrollBinding?: ScrollBinding[];
  // EB-08-02 / §8 SC-043 (INV-18 additive, INV-21). Per-node keyframe list.
  // Each `PrismKeyframe` carries a required `coordinateSpace` discriminator
  // from the canonical 5 (§4). Absent on legacy graphs; non-empty arrays
  // drive the Phase 8 animation primitives (`load` fade, `in-view` slide,
  // `hover` lift; SC-046).
  keyframes?: PrismKeyframe[];
  // STEP5 edit-path (NE-SC-11; canvas-spec §6 lifecycle Built→Dirty; INV-18
  // additive). `dirty === true` means a purpose/visual edit has been committed
  // to the source graph but the built-state artifact has NOT been rebuilt yet,
  // so the cached artifact + builtSnapshot are stale. Set by the edit→save
  // commit (`preview-commit.ts`); cleared by the surgical Save-and-Rebuild
  // (`rebuild-node.ts`). Absent / false on legacy graphs (no built-state drift).
  dirty?: boolean;
  // STEP8 canvas-toolbar Selection group (canvas-spec §14, SC-22; INV-18
  // additive, INV-1 frozen-graph: this is a contains-subtree marker, NOT a new
  // edge type or topology change). Nodes sharing a `groupId` form a Group whose
  // transform cascades (the Selection group's Group button mints a fresh id and
  // stamps it onto every selected node; Ungroup clears it, leaving each node's
  // own `scenePosition` — and therefore its world transform — intact). Absent on
  // ungrouped / legacy nodes.
  groupId?: string;
  // STEP8 canvas-toolbar Selection group (canvas-spec §5 "lock/unlock"; INV-18
  // additive). `locked === true` removes the node from transform authoring: the
  // CanvasTransformGizmo skips it and the toolbar Transform tools refuse to
  // write its `scenePosition`. Distinct from `frozenNodeIds` (AI-off-limits) —
  // lock is a manual-edit guard. Absent / false on legacy nodes.
  locked?: boolean;
  // §10 decision 7 / §10 (INV-8 additive, SAFE DEFAULT). Whether this node's
  // built artifact participates in scene lighting. Absent → derived per render
  // mode via `receivesLightingDefault(renderMode)`: image planes UNLIT (preserve
  // the diffusion-baked look exactly, criterion 17), meshes LIT. Round-trips
  // through save/reload. Toggled by the Lighting toolbar group's per-node switch.
  receivesLighting?: boolean;
  // §11 decision 4 (INV-8 additive). Per-node MeshPhysicalNodeMaterial params,
  // editable in Canvas for meshes. Absent → MATERIAL_SPEC_DEFAULT. Only consumed
  // for visible PBR when the node is a mesh or an opted-in lit plane; image
  // planes ignore it (their texture IS their look) unless receivesLighting=true.
  materialSpec?: MaterialSpec;
  // §10 decision 5 (INV-8 additive). Per-ELEMENT lighting override (a single
  // node can carry its own local lights / env / tier). Absent → the node inherits
  // its hub's `lightingSpec` (and the global default rig). Per-hub spec lives on
  // PrismHub.lightingSpec.
  lightingSpec?: LightingSpec;
  // Canvas-spec §7 (INV-8 additive, INV-11). Per-node text contract for
  // `renderMode: 'text'` nodes: content, font, size/weight/spacing, fills
  // (solid/gradient/texture/AI-texture), outline/glow/shadow, alignment,
  // animation decomposition. Absent → TEXT_SPEC_DEFAULT. Letterforms are real
  // MSDF font glyphs ALWAYS; AI may fill only the texture poured into the
  // glyph coverage, never the letter shapes (INV-11).
  textSpec?: TextSpec;
}

// EB-07-04 / §7 SC-039 — scroll-binding spec consumed by the
// `scroll-timeline` coordinate space (§4). The full ease taxonomy is the
// small set the runtime consumer supports; `from`/`to` are interpreted in
// scene units (translate*, scale) or radians (rotate*) or 0..1 (opacity).
// `coordinateSpace` is implicit (`scroll-timeline`); ScrollBindings are not
// keyframes, so FP-08 doesn't apply.
export type ScrollBindingProperty =
  | 'translateX'
  | 'translateY'
  | 'translateZ'
  | 'rotateX'
  | 'rotateY'
  | 'rotateZ'
  | 'scale'
  | 'opacity';

export type ScrollBindingEase =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut';

export interface ScrollBinding {
  property: ScrollBindingProperty;
  from: number;
  to: number;
  ease?: ScrollBindingEase;
}

// EB-08-02 / §8 SC-043, INV-21 — canonical 5 coordinate spaces (§4). The set
// is fixed by the camera + composition systems (RA-03, D3). Every
// `PrismKeyframe` MUST declare which space its parameters live in; collapsing
// the five into a single matrix is forbidden (INV-22). Tuple order mirrors
// the spec table at §4.
export const KEYFRAME_COORDINATE_SPACES = [
  'universe',
  'hub-scene',
  'viewport-composition',
  'scroll-timeline',
  'camera',
] as const;

export type PrismKeyframeCoordinateSpace =
  (typeof KEYFRAME_COORDINATE_SPACES)[number];

// EB-08-02 / §8 SC-044 — the canonical keyframe trigger enum. Used by the
// Phase 8 Animation Inspector tab (SC-045) and the three baseline primitives
// (`load` fade-in, `in-view` slide, `hover` lift; SC-046).
export const KEYFRAME_TRIGGERS = [
  'load',
  'scroll',
  'hover',
  'click',
  'in-view',
] as const;

export type PrismKeyframeTrigger = (typeof KEYFRAME_TRIGGERS)[number];

// EB-08-02 / §8 SC-043, INV-21 — `coordinateSpace` is REQUIRED on every
// keyframe (no `?`). tsc fails on any keyframe literal missing the
// discriminator; the FP-08 hook fires for runtime-authored cases that slip
// past the type system.
//
// FP-08 inspects literals shaped `{ t: <num>, (params|values): {...} }` for a
// missing `coordinateSpace:` key, so the field names here align with that
// regex. `trigger?` is optional because not every keyframe is event-driven
// (timeline / scroll-bound waypoints don't need one).
export interface PrismKeyframe {
  // Required discriminator — INV-21. The canonical 5 spaces from §4.
  coordinateSpace: PrismKeyframeCoordinateSpace;
  // Time / scroll-progress / event-progress for this waypoint. `t ∈ [0..1]`
  // when normalized; absolute seconds when timeline-driven. The FP-08 regex
  // probes for `t:` to detect keyframe literals.
  t?: number;
  // Animated values at this waypoint. Either `params` or `values` is
  // conventionally populated; the FP-08 regex accepts either.
  params?: Record<string, unknown>;
  values?: Record<string, unknown>;
  // Easing label between this waypoint and the next.
  ease?: ScrollBindingEase | string;
  // Optional trigger from the SC-044 enum. Absent for time/scroll-driven
  // keyframes; present for event-driven ones (`hover`, `click`, …).
  trigger?: PrismKeyframeTrigger;
}

export type PrismEdgeType = 'triggers' | 'state-update' | 'data-flow' | 'event-bubble' | string;

export interface PrismEdge {
  from: string;
  to: string;
  type: PrismEdgeType;
  event?: string;
  [k: string]: unknown;
}

export interface GraphSource {
  hubs: PrismHub[];
  nodes: PrismNode[];
  edges: PrismEdge[];
  // Editor-build §2 / RA-07: dedicated PrismRootNode co-exists with PrismNode
  // inside the GraphSource. Optional for legacy graphs (INV-18); validated to
  // contain exactly one entry by validateRootNode (SC-006).
  rootNodes?: PrismRootNode[];
}

export interface HomeHubJson {
  schemaVersion: string;
  hub: PrismHub;
  nodes: PrismNode[];
  edges: PrismEdge[];
  // Editor-build §5 / SC-006: optional carrier for the App_Name_World root.
  // Additive (INV-18); fixtures pre-EB-02-02 omit the field and still parse.
  rootNodes?: PrismRootNode[];
}
