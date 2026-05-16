// CompiledHubView — Phase 6 (Viewport Composition Engine v1) skeleton.
//
// Spec refs:
//   §6 SC-028  Pure data, deeply readonly, no React/Three.js types.
//   §6 SC-029  `compileHubToPreview(hub, nodes, world) → CompiledHubView` is
//              pure + deterministic.
//   §6 SC-030  Non-destructive: never writes to hub.layout, node.scenePosition,
//              node.editorTransform, or node.canvasTransform.
//   §6 SC-032  cameraRail drives the constrained cinematic preview camera.
//   §6 SC-033  background[] is the compiled background layer stack;
//              attachment `'viewport-fixed'` pins to viewport during scroll.
//   §8 INV-17  Non-destructive compile.
//   §8 INV-23  Compiled preview camera constrained / damped / bounded.
//
// Phase 7 (SC-036) will tighten the attachment vocabulary on the source
// `PrismHubBackgroundLayer`; this skeleton mirrors that vocabulary so the
// compiled layer stack is forward-compatible without a rename.
//
// Phase 10 (SC-053) aggregates many CompiledHubView values into a
// CompiledAppView via `compileAppToPreview`; the shape here is designed to
// compose cleanly under that aggregation (top-level keyed by hubId).
//
// IMPORTANT: do not import React or three.js into this module. The compiled
// view is pure data; the renderer consumes it via a separate adapter layer.

import type { PrismHub, PrismNode } from './types.ts';
import type { PrismRootNode } from './root-node.ts';
import { pickUiAnchor, type UiAnchor } from './compile-anchors';
import { deriveCompiledCameraRail } from './camera-rail';

// --- Attachment vocabulary (mirrors SC-036). ----------------------------

export type CompiledHubAttachment =
  | 'viewport-fixed'
  | 'camera-locked'
  | 'parallax'
  | 'world'
  | 'infinite-environment';

// --- Anchor kinds (Phase 6 / SC-031 placeholder). -----------------------

export type CompiledAnchorKind =
  | 'viewport-relative'
  | 'hub-scene'
  | 'camera'
  | 'world';

export interface CompiledAnchor {
  readonly kind: CompiledAnchorKind;
  // For `viewport-relative`: 0..1 normalized coords in viewport composition
  // space. For `hub-scene` / `world`: 3D coords in the hub's local scene.
  // For `camera`: offsets in camera-local space. Skeleton stores all three
  // axes uniformly; the renderer adapter dispatches on `kind`.
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

// --- Camera rail (SC-032). ---------------------------------------------

export interface CompiledCameraPose {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly fov: number;
}

export interface CompiledCameraRail {
  readonly mode: 'damped-cinematic';
  readonly start: CompiledCameraPose;
  readonly end: CompiledCameraPose;
  // 0..1 — higher values are stiffer. The runtime applies the damping
  // every frame; this number is data, not a curve function.
  readonly damping: number;
}

// --- Background layer (SC-033 / forward-compat with SC-036). -----------

export interface CompiledHubBackgroundLayer {
  readonly id: string;
  readonly attachment: CompiledHubAttachment;
  readonly sourceUrl: string | null;
  readonly z: number;
  readonly opacity: number;
  // §7 SC-036 — depth-derived translation rate for `parallax` layers.
  // 0 = move 1:1 with the camera (foreground); 1 = static (infinite distance).
  // Undefined for non-parallax attachments.
  readonly parallaxDepth?: number;
}

// --- Per-node compiled entry. ------------------------------------------

export interface CompiledNodeEntry {
  readonly nodeId: string;
  readonly subtype: string;
  readonly serviceTag: string;
  readonly anchor: CompiledAnchor;
  readonly z: number;
  readonly visible: boolean;
}

// --- World reference (SC-053 aggregation hook). ------------------------

export interface CompiledWorldRef {
  readonly appNameWorldId: string;
}

// --- Top-level compiled hub view. --------------------------------------

export interface CompiledHubView {
  readonly schemaVersion: 1;
  readonly hubId: string;
  readonly world: CompiledWorldRef;
  readonly background: readonly CompiledHubBackgroundLayer[];
  readonly cameraRail: CompiledCameraRail;
  readonly nodes: readonly CompiledNodeEntry[];
  // Stable hash of the canonical payload. Identical (hub, nodes, world) →
  // identical hash. Hash-comparability is the SC-029 verifier.
  readonly hash: string;
}

// --- Compile entrypoint (SC-029 signature; skeleton body). -------------
//
// The skeleton body is pure and deterministic. It builds a fully-typed
// CompiledHubView from the source inputs without touching any field listed
// in INV-17 (hub.layout, node.scenePosition, node.editorTransform,
// node.canvasTransform). A future Phase 6/7 task swaps the placeholder
// anchor/camera/background math for:
//   - the real anchor-rule table (compile-anchors.ts, SC-031),
//   - the damped cinematic camera rig (SC-032), and
//   - viewport-fixed background-layer pinning over PrismHubBackgroundLayer
//     (SC-033 / SC-036).
// Until then the deterministic skeleton keeps the type contract honest and
// the hash stable.

const DEFAULT_FOV = 50;
const DEFAULT_DAMPING = 0.12;

// SC-031 source vocabulary → compiled vocabulary. The source rule table
// (compile-anchors.ts) classifies into seven `UiAnchor` values; the
// compiled view only carries the four spaces the renderer adapter
// dispatches on. This map is the only place the two vocabularies meet,
// and it is a pure pre-computed lookup so the resulting compile path
// stays deterministic + free of branches at hot loops.
//
//   world         → 'world'             (3D hub-scene world space, depth-aware)
//   parallax      → 'hub-scene'         (scene-space with depth, scroll-driven)
//   hybrid        → 'hub-scene'         (scene-space; viewport-aware via renderer)
//   viewport      → 'viewport-relative' (2D viewport composition space)
//   scroll        → 'viewport-relative' (viewport with scroll-timeline binding)
//   sticky        → 'viewport-relative' (viewport with sticky pinning)
//   camera-locked → 'camera'            (camera-local space; HUD welds)
//
// Spec refs: §6 SC-031 (rule table), §6 SC-028 (CompiledAnchorKind), and
// the compiled-view CompiledAnchorKind union definition above.
const UI_ANCHOR_TO_COMPILED_KIND: Readonly<Record<UiAnchor, CompiledAnchorKind>> =
  Object.freeze({
    world: 'world',
    parallax: 'hub-scene',
    hybrid: 'hub-scene',
    viewport: 'viewport-relative',
    scroll: 'viewport-relative',
    sticky: 'viewport-relative',
    'camera-locked': 'camera',
  });

function compileAnchorForNode(node: PrismNode): CompiledAnchor {
  // SC-031: dispatch on (subtype, intent, serviceTag) via the rule table.
  // Coordinates are derived purely from `node.visual.transform` (read-only;
  // INV-17 forbids writes here). No React / Three.js types involved.
  const uiAnchor = pickUiAnchor(node.subtype, node.intent, node.serviceTag);
  const kind = UI_ANCHOR_TO_COMPILED_KIND[uiAnchor];
  const t = node.visual?.transform;
  return Object.freeze({
    kind,
    x: typeof t?.x === 'number' ? t.x : 0,
    y: typeof t?.y === 'number' ? t.y : 0,
    z: typeof t?.z === 'number' ? t.z : 0,
  });
}

function compileBackground(hub: PrismHub): readonly CompiledHubBackgroundLayer[] {
  // Phase 7 (SC-037): when `hub.background` is present and non-empty it is
  // the source of truth. Each source layer is normalized to the compiled
  // shape with defaults applied (sourceUrl?? null, z?? 0, opacity?? 1).
  // `parallaxDepth` is carried through only for `parallax` layers.
  // When absent or empty, fall back to the legacy single-layer reader
  // (`layout.mockupUrl` → one viewport-fixed layer; SC-033).
  if (hub.background && hub.background.length > 0) {
    return Object.freeze(
      hub.background.map((src) => {
        const compiled: CompiledHubBackgroundLayer = {
          id: src.id,
          attachment: src.attachment,
          sourceUrl: src.sourceUrl ?? null,
          z: typeof src.z === 'number' ? src.z : 0,
          opacity: typeof src.opacity === 'number' ? src.opacity : 1,
          ...(src.attachment === 'parallax' && typeof src.parallaxDepth === 'number'
            ? { parallaxDepth: src.parallaxDepth }
            : {}),
        };
        return Object.freeze(compiled);
      }),
    );
  }
  const mockup = hub.layout?.mockupUrl ?? null;
  if (!mockup) {
    return Object.freeze([] as readonly CompiledHubBackgroundLayer[]);
  }
  return Object.freeze([
    Object.freeze({
      id: `${hub.hubId}/background-0`,
      attachment: 'viewport-fixed' as const,
      sourceUrl: mockup,
      z: 0,
      opacity: 1,
    }),
  ]);
}

function compileCameraRail(
  hub: PrismHub,
  nodes: readonly PrismNode[],
): CompiledCameraRail {
  // SC-032 / INV-23: bounded damped-cinematic rail. `deriveCompiledCameraRail`
  // computes camera distance from FOV + scene bounds (hub viewport ∪ node
  // extents) plus a fixed margin, so neither end-pose nor start-pose ever
  // frames the scene edges. Pure — never mutates inputs.
  return deriveCompiledCameraRail({
    viewportWidth: hub.layout?.viewportWidth ?? 1440,
    viewportHeight: hub.layout?.viewportHeight ?? 900,
    nodes,
    fovDeg: DEFAULT_FOV,
    damping: DEFAULT_DAMPING,
  });
}

function compileNodes(nodes: readonly PrismNode[]): readonly CompiledNodeEntry[] {
  // Stable, deterministic ordering by parentHubId then nodeId. Source array
  // is never mutated (the spread + sort applies to a fresh copy).
  const sorted = [...nodes].sort((a, b) => {
    if (a.parentHubId !== b.parentHubId) {
      return a.parentHubId < b.parentHubId ? -1 : 1;
    }
    return a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0;
  });
  return Object.freeze(
    sorted.map((node) =>
      Object.freeze({
        nodeId: node.nodeId,
        subtype: node.subtype,
        serviceTag: node.serviceTag,
        anchor: compileAnchorForNode(node),
        z: typeof node.visual?.transform?.z === 'number' ? node.visual.transform.z : 0,
        visible: node.intent?.visibility?.renderInCurrentMockup !== false,
      }),
    ),
  );
}

function canonicalStringify(value: unknown): string {
  // Deterministic JSON: object keys sorted recursively. Arrays preserve
  // insertion order (we already sort the meaningful arrays upstream).
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const parts = keys.map(
    (k) =>
      `${JSON.stringify(k)}:${canonicalStringify((value as Record<string, unknown>)[k])}`,
  );
  return `{${parts.join(',')}}`;
}

function fnv1a(input: string): string {
  // FNV-1a 32-bit, hex. Small, deterministic, dependency-free — enough for
  // SC-029 hash-comparability (we never use this for crypto).
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function compileHubToPreview(
  hub: PrismHub,
  nodes: readonly PrismNode[],
  world: PrismRootNode,
): CompiledHubView {
  const compiledBackground = compileBackground(hub);
  const compiledCameraRail = compileCameraRail(hub, nodes);
  const compiledNodes = compileNodes(nodes);
  const compiledWorld: CompiledWorldRef = Object.freeze({
    appNameWorldId: world.appNameWorldId,
  });

  // Build the payload first WITHOUT the hash, then hash a canonical
  // serialization of it. The serialization is deterministic across runs.
  const payload = {
    schemaVersion: 1 as const,
    hubId: hub.hubId,
    world: compiledWorld,
    background: compiledBackground,
    cameraRail: compiledCameraRail,
    nodes: compiledNodes,
  };
  const hash = fnv1a(canonicalStringify(payload));

  return Object.freeze({
    ...payload,
    hash,
  });
}
