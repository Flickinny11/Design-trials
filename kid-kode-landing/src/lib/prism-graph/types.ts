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

export type { CinematicPrimitiveRef } from './cinematic-primitives.ts';

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

export interface PrismHub {
  hubId: string;
  title: string;
  caption?: string;
  layout: PrismHubLayout;
  responsiveBreakpoints?: PrismHubResponsiveBreakpoints;
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
}

export interface HomeHubJson {
  schemaVersion: string;
  hub: PrismHub;
  nodes: PrismNode[];
  edges: PrismEdge[];
}
