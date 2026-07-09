// W8 E11 — lean authoring helpers for the SR-flagship template graphs. Produce
// fully-formed PrismNodes (required intent/behaviorSpec/scenePosition defaults
// filled) from a compact spec, so a template graph reads as a storyboard rather
// than 60 lines of boilerplate per node. Every node stays a real PrismNode
// (INV-0.1) that renders via the proven runtime factory + carries W8 drivers.

import type {
  AnimationBinding,
  CursorLayerConfig,
  HubTransitionPreset,
  MaterialSpec,
  LightingSpec,
  MeshPrimitive,
  PrismBehaviorSpec,
  PrismHub,
  PrismHubBackgroundLayer,
  PrismNode,
  ScenePosition,
  TextSpec,
} from '@/lib/prism-graph/types';

// A bright, generous default rig so lit materials (MSDF glyph MeshStandard, GLB
// MeshPhysical) read on a dark backdrop — templates author no per-node lighting.
const DEFAULT_TEMPLATE_LIGHTING: LightingSpec = {
  tier: 'auto',
  ambientIntensity: 0.55,
  envIntensity: 0.85,
  shadowSoftness: 0.7,
  lights: [
    { id: 'key', type: 'directional', color: '#fff2d8', intensity: 2.6, position: { x: -3, y: 4, z: 6 }, castShadow: true },
    { id: 'fill', type: 'directional', color: '#cfe0ff', intensity: 1.1, position: { x: 4, y: 1, z: 4 } },
    { id: 'rim', type: 'directional', color: '#8fb0ff', intensity: 0.9, position: { x: 2, y: -2, z: -4 } },
    { id: 'amb', type: 'hemisphere', color: '#e4ecff', groundColor: '#1c2029', intensity: 0.8 },
  ],
};

function emptyBehavior(): PrismBehaviorSpec {
  return {
    interactions: [],
    apiCalls: [],
    dataBindings: [],
    emits: [],
    listens: [],
    triggersDownstream: [],
  };
}

function scenePos(
  x: number,
  y: number,
  z: number,
  scale = 1,
  rot: [number, number, number] = [0, 0, 0],
): ScenePosition {
  return {
    x,
    y,
    z,
    rotationX: rot[0],
    rotationY: rot[1],
    rotationZ: rot[2],
    scaleX: scale,
    scaleY: scale,
    scaleZ: scale,
  };
}

export interface NodeSpec {
  id: string;
  hub: string;
  caption: string;
  x: number;
  y: number;
  z?: number;
  w: number;
  h: number;
  scale?: number;
  rot?: [number, number, number];
  bindings?: AnimationBinding[];
  serviceTag?: string;
  subtype?: string;
}

function baseNode(spec: NodeSpec, extra: Partial<PrismNode>): PrismNode {
  const z = spec.z ?? 0;
  return {
    nodeId: spec.id,
    subtype: spec.subtype ?? 'template-element',
    parentHubId: spec.hub,
    serviceTag: spec.serviceTag ?? 'ui-visual',
    visual: {
      transform: { x: spec.x, y: spec.y, z, width: spec.w, height: spec.h },
      alpha: 1,
    },
    intent: {
      caption: spec.caption,
      behaviorSpec: emptyBehavior(),
      stateEffects: [],
      visualSpec: { textContent: [], layers: [] },
      contracts: { inputs: {}, outputs: {} },
      animationSpec: { bindings: [], cinematicPrimitives: [] },
    },
    codeRef: '',
    backendRef: null,
    scenePosition: scenePos(spec.x, spec.y, z, spec.scale ?? 1, spec.rot),
    ...(spec.bindings && spec.bindings.length > 0
      ? { animationBindings: spec.bindings }
      : {}),
    ...extra,
  };
}

export interface TextOpts {
  weight?: number;
  size?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  family?: string;
  /** Emissive glow intensity (default 0.25). */
  glow?: number;
  /** Reveal on in-view via the kinetic-text cinematic primitive (default true). */
  reveal?: boolean;
}

/** Darken a hex colour by `f` (0..1) for the extruded side fill. */
function darken(hex: string, f = 0.55): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = Math.round(((n >> 16) & 255) * (1 - f));
  const g = Math.round(((n >> 8) & 255) * (1 - f));
  const b = Math.round((n & 255) * (1 - f));
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** A real TRUE-3D EXTRUDED text node (canvas-spec §7). Renders via font vector
 *  outlines — the proven path the mock app uses in ConductorRuntime (flat MSDF
 *  glyph atlases don't bind reliably in that host). Lit + bevelled + premium,
 *  which also reads better than flat text against SR's slide type. Reveals on
 *  in-view via the kinetic-text cinematic primitive (E8 inview driver). */
export function textNode(spec: NodeSpec, text: string, opts: TextOpts = {}): PrismNode {
  const color = opts.color ?? '#f2ecdd';
  const fill = { kind: 'solid' as const, color };
  const textSpec: TextSpec = {
    content: text,
    fontFamily: opts.family ?? 'Playfair Display',
    fontWeight: opts.weight ?? 600,
    fontSize: opts.size ?? 0.5,
    align: opts.align ?? 'center',
    letterSpacing: -0.01,
    fill,
    // ConductorRuntime never applies the hub lightingSpec (default dim rig), so
    // lit extruded text stays dark on dark backdrops — a strong glow drives the
    // emissive channel and a LOW metalness keeps the faces from mirroring black,
    // so headlines read bright/legible on any template background.
    glow: { color, intensity: opts.glow ?? 1.75 },
    extrude: {
      enabled: true,
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.016,
      bevelSegments: 3,
      curveSegments: 12,
      metalness: 0.12,
      roughness: 0.4,
      transmission: 0,
      faceFill: fill,
      sideFill: { kind: 'solid', color: darken(color) },
    },
  };
  const node = baseNode(
    { serviceTag: 'ui-text', subtype: 'headline-text', ...spec },
    { renderMode: 'text', textSpec, receivesLighting: true },
  );
  if (opts.reveal !== false) {
    node.cinematicPrimitives = [
      { name: 'kinetic-text', params: { stagger: 0.045, duration: 0.7, effect: 'wave', easing: 'power3.out' }, trigger: 'inview' },
    ];
  }
  return node;
}

/** A parametric mesh (cube/plane/sphere/…) with a PBR material — no asset. Use
 *  this for colored surfaces (planes ignore materialSpec — mesh+meshPrimitive
 *  is the asset-free colored-surface path). */
export function meshNode(
  spec: NodeSpec,
  meshPrimitive: MeshPrimitive,
  materialSpec: MaterialSpec,
): PrismNode {
  return baseNode(
    { serviceTag: 'ui-3d', subtype: 'primitive-surface', ...spec },
    { renderMode: 'mesh', meshPrimitive, materialSpec, receivesLighting: true },
  );
}

/** An image-plane node sourced from an existing asset (proven to load). */
export function imageNode(spec: NodeSpec, sourceAsset: string, opaque = true): PrismNode {
  const node = baseNode(
    { serviceTag: 'ui-visual', subtype: 'image-plane', ...spec },
    {
      renderMode: 'plane',
      imageSpec: { cornerRadius: 0.12, fit: 'cover', opacity: 1 },
    },
  );
  node.visual.sourceAsset = sourceAsset;
  node.visual.opaque = opaque;
  return node;
}

/** A GLB mesh node (existing asset). */
export function glbNode(spec: NodeSpec, meshUrl: string): PrismNode {
  return baseNode(
    { serviceTag: 'ui-3d', subtype: 'product-hero', ...spec },
    { renderMode: 'mesh', meshUrl, receivesLighting: true },
  );
}

/** An effect-only node (particles/smoke/etc.) — its bindings' subject:'empty'
 *  primitives self-generate. A tiny invisible-ish anchor plane hosts it. */
export function fxNode(spec: NodeSpec): PrismNode {
  return baseNode({ serviceTag: 'ui-fx', subtype: 'fx-field', ...spec }, {
    renderMode: 'mesh',
    meshPrimitive: { kind: 'plane', params: { width: spec.w, height: spec.h } },
    materialSpec: { baseColor: '#000000', opacity: 0, transmission: 0 },
  });
}

let bindingSeq = 0;
/** Mint an AnimationBinding with W8 driver options. */
export function bind(
  primitive: string,
  driver: AnimationBinding['driver'],
  opts: {
    params?: AnimationBinding['params'];
    section?: boolean;
    replay?: boolean;
  } = {},
): AnimationBinding {
  bindingSeq += 1;
  const b: AnimationBinding = {
    id: `tpl-${primitive}-${bindingSeq}`,
    primitive,
    driver,
    order: bindingSeq,
  };
  if (opts.params) b.params = opts.params;
  if (opts.section || opts.replay) {
    b.driverOptions = {};
    if (opts.section) b.driverOptions.section = true;
    if (opts.replay) b.driverOptions.replay = true;
  }
  return b;
}

export interface HubSpec {
  hubId: string;
  title: string;
  caption: string;
  backgroundColor: string;
  cursor?: CursorLayerConfig;
  transitionPreset?: HubTransitionPreset;
  contentHeight?: number;
  lightingSpec?: LightingSpec;
  /** Hub-owned ambience/backdrop layers (galaxy law: ambient star/dust/nebula
   *  backgrounds are hub DATA, never first-class graph nodes). */
  background?: PrismHubBackgroundLayer[];
  /** W-2D — the template's declared composition mode (additive; absent →
   *  '3d'). A data/table template ships as a flat 2d hub. */
  renderMode?: PrismHub['renderMode'];
}

export function templateHub(spec: HubSpec): PrismHub {
  return {
    hubId: spec.hubId,
    title: spec.title,
    caption: spec.caption,
    ...(spec.renderMode === '2d' ? { renderMode: spec.renderMode } : {}),
    layout: {
      viewportWidth: 1280,
      viewportHeight: 720,
      contentHeight: spec.contentHeight ?? 720,
      backgroundColor: spec.backgroundColor,
    },
    lightingSpec: spec.lightingSpec ?? DEFAULT_TEMPLATE_LIGHTING,
    ...(spec.cursor ? { cursor: spec.cursor } : {}),
    ...(spec.transitionPreset ? { transitionPreset: spec.transitionPreset } : {}),
    ...(spec.background && spec.background.length > 0 ? { background: spec.background } : {}),
  };
}
