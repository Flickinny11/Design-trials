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
  MeshPrimitive,
  PrismBehaviorSpec,
  PrismHub,
  PrismNode,
  ScenePosition,
  TextSpec,
} from '@/lib/prism-graph/types';

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
}

/** A real MSDF text node — no asset, renders anywhere. */
export function textNode(spec: NodeSpec, text: string, opts: TextOpts = {}): PrismNode {
  const textSpec: TextSpec = { content: text, align: opts.align ?? 'center' };
  if (opts.weight) textSpec.fontWeight = opts.weight;
  if (opts.size) textSpec.fontSize = opts.size;
  if (opts.color) textSpec.fill = { kind: 'solid', color: opts.color };
  return baseNode(
    { serviceTag: 'ui-text', subtype: 'headline-text', ...spec },
    { renderMode: 'text', textSpec },
  );
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
}

export function templateHub(spec: HubSpec): PrismHub {
  return {
    hubId: spec.hubId,
    title: spec.title,
    caption: spec.caption,
    layout: {
      viewportWidth: 1280,
      viewportHeight: 720,
      contentHeight: spec.contentHeight ?? 720,
      backgroundColor: spec.backgroundColor,
    },
    ...(spec.cursor ? { cursor: spec.cursor } : {}),
    ...(spec.transitionPreset ? { transitionPreset: spec.transitionPreset } : {}),
  };
}
