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

// Canvas-spec §7 / criterion 26 (INV-18 additive): 'text' renders REAL MSDF
// font glyphs via the Prism TextObject (src/lib/prism/text/), styled by the
// node's `textSpec`. Letterforms are never synthesized (INV-11).
export type RenderMode = 'sprite' | 'plane' | 'parallax-plane' | 'mesh' | 'text';

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
  /** Base-color/albedo map (sRGB). Additive (INV-18) — UI-FIDELITY-2 W3:
   *  lets generated surface scans pour onto primitive geometry (e.g. the
   *  showcase planets' lapis/brass/obsidian equirect textures on spheres). */
  baseColorMapUrl?: string | null;
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
  /** Depth offset in em units, pushing the shadow behind the text along -Z.
   *  True-3D extruded mode only; ignored by the flat MSDF path. Additive
   *  (INV-18). */
  offsetZ?: number;
  opacity?: number;
  /** Soft-shadow blur radius in em units (0 / absent = hard edge). Additive
   *  (INV-18). */
  blur?: number;
}

// §7 — TRUE 3D EXTRUDED TEXT (additive, INV-18 / INV-11). When `enabled` and the
// device tier permits (INV-9, T1+), the text node builds REAL extruded geometry
// from the font's vector outlines (opentype.js → THREE.Shape → ExtrudeGeometry),
// lit + shadow-casting. Absent / `enabled:false` → the flat MSDF path runs
// (default, byte-identical). Letterforms are ALWAYS real font outlines, never
// diffusion-drawn (INV-11). Depth / bevel are in em units (fractions of
// fontSize). `faceFill`/`sideFill` reuse the standard TextFill union so the
// existing solid/gradient/texture/ai-texture pipeline (and the prompt→texture
// picker) pour onto the 3D faces vs the bevel/sides independently.
export interface TextExtrudeSpec {
  enabled?: boolean;
  /** Extrusion depth (slab thickness) in em units. */
  depth?: number;
  bevelEnabled?: boolean;
  /** Bevel rise along +Z in em units. */
  bevelThickness?: number;
  /** Bevel inset (how far the bevel cuts in) in em units. */
  bevelSize?: number;
  /** Bevel curve resolution (cost driver; 2–4 typical). */
  bevelSegments?: number;
  /** Glyph-curve tessellation (bezier flatness; higher = sharper at DPR-2). */
  curveSegments?: number;
  /** Fill for the front/back FACES (ExtrudeGeometry material group 0). Falls
   *  back to `TextSpec.fill` when absent. */
  faceFill?: TextFill;
  /** Fill for the extruded SIDE walls + bevel (material group 1). Falls back to
   *  a tinted edge derived from the face fill. */
  sideFill?: TextFill;
  /** PBR surface so the extruded faces/sides catch real scene light (photoreal,
   *  never flat). Sensible defaults applied when absent. */
  metalness?: number;
  roughness?: number;
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
  /** Real-or-synthesized style flags (§7 extended styling, additive INV-18).
   *  `bold` prefers a real heavier weight face, else faux-bold; `italic`
   *  prefers a real italic face, else a synthesized shear. `strikethrough` /
   *  `underline` are metrics-derived rules. */
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  /** True-3D extruded geometry (opt-in; tier-gated INV-9). Absent / disabled →
   *  the flat MSDF path renders (default). Additive (INV-18). */
  extrude?: TextExtrudeSpec;
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
  // APP-REALITY P2 — hub-level CAMERA JOURNEY (INV-8 additive, INV-21). An
  // ordered list of camera waypoints (position/target/fov over time) the
  // Canvas user authors with the free edit camera; Preview plays exactly this
  // journey, deterministically, as the landing fly-in. Each entry is a
  // `PrismKeyframe` with `coordinateSpace: 'camera'` (the canonical 5, §4),
  // `t` ∈ [0..1] normalized journey time, and `params`:
  //   { px, py, pz, tx, ty, tz, fov } in hub-scene world units / degrees.
  // Absent / fewer than 2 waypoints → no journey (Preview holds the configured
  // landing pose). Never mutated by compile/preview functions (read-only there).
  cameraKeyframes?: PrismKeyframe[];
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
  // FIDELITY-2 W3 / audit item 3 (INV-18 additive). Optional video texture
  // source for image-bearing render modes (sprite / plane). When set, the
  // runtime's LoaderCache `loadVideo` lane wraps the URL in a
  // THREE.VideoTexture (muted, looping, autoplaying, SRGB) and it replaces
  // the still-image texture once the first frame is decodable; the still
  // image (visual.sourceAsset) acts as the placeholder until then. Absent /
  // null → image-only, bit-for-bit legacy behavior.
  videoUrl?: string | null;
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
  // P2 TOOLBAR WIRING (canvas-spec §5 Animation group, §8.2/§8.3; INV-8
  // additive). Catalog-primitive bindings applied to this node: each entry =
  // one Animatable-registry primitive + the Driver that plays it + param
  // overrides for its ControlSchema. Multiple bindings stack (criterion 13);
  // `order` is the stacking order. Changing `driver` never edits the
  // primitive's keyframes (INV-6). Drivers play ANIMATION only, never app
  // behavior (§1.3). Absent on legacy nodes. Round-trips through save/reload.
  animationBindings?: AnimationBinding[];
  // P3 IMAGE/MEDIA (canvas-spec §5 Image tools; INV-8 additive). Per-node
  // image presentation for image-bearing render modes (sprite / plane /
  // parallax-plane): how the source texture sits in its plane. The artifact
  // itself stays `visual.sourceAsset` (upload/URL both resolve to a URL).
  // Absent → IMAGE_SPEC_DEFAULT (cover, no crop, square corners, opaque).
  // Round-trips through save/reload. §5's color-adjust / blend / filter set
  // is a later slice — these are the core four the P3 scope names.
  imageSpec?: ImageSpec;
  // APP-REALITY P5 (INV-8 additive). Per-device responsive layout override
  // applied by the Preview device modes. Absent → the authored desktop layout
  // on every device. The assembled scene composes scenePosition with the
  // active device's override (absolute pose + scale multiplier + hidden).
  responsiveScenePos?: ResponsiveScenePos;
  // P4 3D-OBJECT (canvas-spec §5 3D object tools; INV-8 additive). A
  // primitive mesh created in-canvas: the factory builds the geometry from
  // `kind` + `params` and routes the surface through the EXISTING material
  // system (`materialSpec`, LIT by default like renderMode 'mesh') and the
  // lighting rig. Coexists with renderMode: a node carrying `meshPrimitive`
  // renders the primitive regardless of meshUrl (which stays for GLBs).
  // Round-trips through save/reload.
  meshPrimitive?: MeshPrimitive;
  // CANVAS-FINAL / Change Artifact Upload wizard (canvas-spec §12.1, criterion
  // 19; INV-8 additive). Per-face image mapping onto a `meshPrimitive` shape.
  // Each entry binds an image to one geometry group (face slot); slot counts
  // match the spec exactly (cube=6, cone=2, sphere=1 — see FACE_SLOT_COUNT).
  // Absent → the primitive renders with its single `materialSpec` surface.
  // Round-trips through save/reload.
  faceTextures?: FaceTexture[];
  // CANVAS-FINAL / Change Artifact wizard (canvas-spec §12.2 + §11, criterion
  // 20; INV-8 additive). Append-only retention of this node's PRIOR artifacts.
  // "Use This" snapshots the outgoing artifact-bearing fields into a library
  // entry BEFORE swapping the replacement in ("outgoing artifact retained in
  // the artifact library"). Restoring an entry snapshots the then-current
  // artifact in turn — never lossy. Absent on legacy nodes. Round-trips.
  artifactLibrary?: ArtifactLibraryEntry[];
}

// P4 3D-OBJECT — the frozen primitive-mesh contract (additive only).
export type MeshPrimitiveKind =
  | 'cube'
  | 'sphere'
  | 'plane'
  | 'cylinder'
  | 'cone'
  | 'torus'
  | 'capsule';

export interface MeshPrimitive {
  kind: MeshPrimitiveKind;
  /** Per-kind dimensions in scene units + tessellation. All optional —
   *  MESH_PRIMITIVE_DEFAULTS supplies per-kind values. Unknown keys are
   *  ignored (forward-compat). */
  params?: {
    width?: number;
    height?: number;
    depth?: number;
    radius?: number;
    /** torus tube radius / capsule mid-section length, per kind. */
    tube?: number;
    length?: number;
    segments?: number;
  };
}

export const MESH_PRIMITIVE_DEFAULTS: Record<MeshPrimitiveKind, Required<NonNullable<MeshPrimitive['params']>>> = {
  cube: { width: 0.6, height: 0.6, depth: 0.6, radius: 0, tube: 0, length: 0, segments: 1 },
  sphere: { width: 0, height: 0, depth: 0, radius: 0.38, tube: 0, length: 0, segments: 48 },
  plane: { width: 0.9, height: 0.9, depth: 0, radius: 0, tube: 0, length: 0, segments: 1 },
  cylinder: { width: 0, height: 0.7, depth: 0, radius: 0.3, tube: 0, length: 0, segments: 48 },
  cone: { width: 0, height: 0.7, depth: 0, radius: 0.34, tube: 0, length: 0, segments: 48 },
  torus: { width: 0, height: 0, depth: 0, radius: 0.34, tube: 0.12, length: 0, segments: 48 },
  capsule: { width: 0, height: 0, depth: 0, radius: 0.22, tube: 0, length: 0.45, segments: 24 },
};

// CANVAS-FINAL / Change Artifact Upload wizard — per-face image mapping
// (canvas-spec §12.1, criterion 19; additive only). A node carrying a
// `meshPrimitive` may map an image onto each FACE SLOT of its shape. Slots are
// the geometry's material groups (three r184), which line up with the spec's
// counts exactly: cube/box = 6, cone = 2 (curved lateral = slot 0, base = slot
// 1), cylinder = 3 (lateral, top, bottom), sphere = 1 (single curved face),
// plane = 1. A slot with no entry keeps the primitive's base `materialSpec`.
export interface FaceTexture {
  /** Geometry group index this image binds to (0-based). */
  faceIndex: number;
  /** Image URL (upload / URL / generated all resolve to a URL). */
  url: string;
  /** Normalized 0..1 crop window over the source; absent → full frame. */
  crop?: ImageCrop;
  /** 0..1 face opacity (multiplies any material opacity). Absent → 1. */
  opacity?: number;
}

// Face-slot counts per primitive kind — the material-group count three's
// geometry constructors emit. The Upload wizard renders exactly this many
// numbered slots (§12.1: cube=6, cone=2, sphere=1). `torus`/`capsule` are
// single-group surfaces (one wrap). Kept in sync with buildPrimitiveGeometry.
export const FACE_SLOT_COUNT: Record<MeshPrimitiveKind, number> = {
  cube: 6,
  cone: 2,
  cylinder: 3,
  sphere: 1,
  plane: 1,
  torus: 1,
  capsule: 1,
};

// CANVAS-FINAL / Change Artifact wizard — how an artifact originated. Plain
// vocabulary; surfaced in the artifact-library tile label (no machine ids).
export type ArtifactSource = 'upload' | 'url' | 'generated' | 'prebuilt' | 'initial';

// CANVAS-FINAL / Change Artifact wizard (canvas-spec §12.2 + §11, criterion
// 20; additive only). One retired artifact in a node's append-only library.
// Snapshots only the artifact-bearing fields that applied to its renderMode,
// so a restore reinstates the node's prior look verbatim.
export interface ArtifactLibraryEntry {
  /** Stable id (`al-<base36>`). */
  id: string;
  /** ISO timestamp this artifact was retired from active use. */
  at: string;
  /** The render mode this artifact drove. */
  renderMode: RenderMode;
  /** How the artifact originated. */
  source: ArtifactSource;
  /** Plain-language label ("Brass sphere · generated"). No machine ids. */
  label?: string;
  /** The natural-language prompt that produced it, when generated. */
  prompt?: string;
  /** Artifact-bearing snapshot (only the fields for this renderMode are set). */
  sourceAsset?: string;
  meshUrl?: string | null;
  videoUrl?: string | null;
  depthMapUrl?: string | null;
  meshPrimitive?: MeshPrimitive;
  faceTextures?: FaceTexture[];
  textSpec?: TextSpec;
  /** Optional still image for the library tile preview. */
  thumbnailUrl?: string;
}

// APP-REALITY P5 — per-DEVICE responsive layout override (INV-8 additive).
// The Preview device modes (Desktop / Tablet / Mobile) show the REAL responsive
// version: each node may carry an absolute pose override + a scale multiplier +
// a hidden flag per device, so the built composition genuinely RE-LAYS-OUT for
// the device (not merely a resized viewport). Absent device / absent field →
// the authored desktop layout (no change). Never mutated by compile/preview.
export type DeviceMode = 'desktop' | 'tablet' | 'mobile';

export interface ResponsiveDevicePose {
  /** Absolute scene-position overrides for this device (omit = keep authored). */
  x?: number;
  y?: number;
  z?: number;
  /** Multiplier on the authored scaleXYZ for this device (omit = 1×). */
  scale?: number;
  /** Hide this node entirely on this device (responsive declutter). */
  hidden?: boolean;
}

export interface ResponsiveScenePos {
  mobile?: ResponsiveDevicePose;
  tablet?: ResponsiveDevicePose;
  desktop?: ResponsiveDevicePose;
}

// P3 IMAGE/MEDIA — the frozen image-presentation contract (additive only).
export interface ImageCrop {
  /** Normalized 0..1 crop window over the source texture (x,y = top-left). */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface ImageSpec {
  /** How the (cropped) texture fills the node's plane. 'cover' crops to
   *  fill; 'contain' letterboxes (transparent margins); 'fill' stretches. */
  fit?: 'cover' | 'contain' | 'fill';
  crop?: ImageCrop;
  /** Rounded-corner radius as a fraction of the plane's half-min-dimension,
   *  0 (square) .. 1 (fully pill/circular). Cut in the shader (TSL mask) —
   *  the texture is never re-rendered. */
  cornerRadius?: number;
  /** 0..1 whole-plane opacity (multiplies any material opacity). */
  opacity?: number;
}

export const IMAGE_SPEC_DEFAULT: ImageSpec = {
  fit: 'cover',
  cornerRadius: 0,
  opacity: 1,
};

// P2 TOOLBAR WIRING — the frozen binding contract (canvas-spec §8.2 Driver
// model + §8.3 catalog). Additive only.
export type AnimationDriverKind = 'time' | 'scroll' | 'pointer' | 'state' | 'event';

export interface AnimationBinding {
  /** Stable id for edit/remove (`ab-<base36>` convention). */
  id: string;
  /** Animatable-registry primitive name (the 312-tile catalog). */
  primitive: string;
  /** Which Driver plays this binding (canvas-spec §8.2). */
  driver: AnimationDriverKind;
  /** ControlSchema param overrides; unset params use the primitive's defaults. */
  params?: Record<string, number | string | boolean>;
  /** Stacking order among this node's bindings (criterion 13). */
  order?: number;
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
  // FIDELITY-2 W3 / audit "What Must Change" item 1 (INV-18 additive): the
  // optional multi-hub wire carrier. When present (non-empty), loaders use it
  // verbatim and `hub` remains the legacy single-hub mirror (=== hubs[0]) for
  // backward compat. Nodes stay one flat array — every PrismNode already
  // names its hub via `parentHubId`, so no per-hub node grouping is needed.
  // Legacy single-hub payloads omit this field and parse bit-for-bit.
  hubs?: PrismHub[];
  nodes: PrismNode[];
  edges: PrismEdge[];
  // Editor-build §5 / SC-006: optional carrier for the App_Name_World root.
  // Additive (INV-18); fixtures pre-EB-02-02 omit the field and still parse.
  rootNodes?: PrismRootNode[];
}
