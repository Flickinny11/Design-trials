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
// The skeleton body is intentionally pure and deterministic — it builds a
// fully-typed CompiledHubView from the source inputs without touching any
// field listed in INV-17. A future Phase 6/7 task swaps the placeholder
// anchor/camera/background math for the real anchor-rule table
// (compile-anchors.ts) and damped-camera rig (SC-032) and the viewport-fixed
// background-layer pinning (SC-033). Until then the deterministic skeleton
// keeps the type contract honest and the hash stable.

export function compileHubToPreview(
  hub: PrismHub,
  nodes: readonly PrismNode[],
  world: PrismRootNode,
): CompiledHubView {
  throw new Error(
    'compileHubToPreview: skeleton body not implemented; EB-06-01 step 7 fills this in.',
  );
}
