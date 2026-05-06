'use client';

// HL10 — Editor renders artifacts.
//
// Spec refs:
//   - Plan §P10 ("ArtifactNode wraps a factory-produced THREE.Object3D in
//     R3F `<primitive object={obj} />`. Reads useGraphSourceStore for the
//     canonical PrismNode. Reads useForceGraph for editor force-graph
//     position (overrides scenePosition in editor view).
//     getSharedNodeContext({ runPrimitives: false }). Caches the produced
//     Object3D by nodeId + node.codeRef.").
//   - Editor invariant ("one graph, two views") — the same factory pipeline
//     that PrismHost uses in preview is reused here so authoring and runtime
//     stay aligned.
//
// Two-coordinate-system reconciliation: editor uses force-graph positions
// (from `useForceGraph`); preview uses `scenePosition`. In the editor view,
// `scenePosition` is IGNORED — the parent React tree positions the
// <primitive> via the surrounding <group position={[node.x, node.y, node.z]}>.
// Documented in `docs/spec-deviations-prism.md`.
//
// Editor scaling: each ArtifactNode's <primitive> is wrapped in
// `<group scale={[0.06, 0.06, 0.06]}>` so artifacts render small enough for
// graph navigation without overlapping.
//
// Caching: a module-level Map keys produced Object3D instances by
// `nodeId + '|' + (codeRef ?? '')`. Re-renders with an unchanged identity
// reuse the same Object3D — only an explicit codeRef change rebuilds.

import { useMemo } from 'react';
import { Group, type Object3D } from 'three';
import { defaultRenderModeFactory } from '@/lib/prism/runtime/factories/default-factory';
import { buildPerNodeFactory } from '@/lib/prism/runtime/factories/coderef-factory';
import { getSharedNodeContext } from '@/lib/prism/runtime/shared-context';
import type { PrismNode } from '@/lib/prism-graph/types';
import type { CreateNodeFn } from '@/lib/prism/runtime/shared/adapter';

interface CachedEntry {
  object: Object3D;
  codeRef: string;
}

const cache = new Map<string, CachedEntry>();

/** Predicate that drives GlassNode's editor delegation: when a node carries
 *  artifact data (a renderable image asset, a 3D mesh, or a codeRef module),
 *  the editor renders it via ArtifactNode. Intent-only nodes (Stage 0,
 *  caption-only, no image) fall back to the existing GlassNode sphere so
 *  the user can still see + select them in the constellation view. */
export function hasArtifactData(node: PrismNode): boolean {
  if (node.visual?.sourceAsset) return true;
  if (node.meshUrl) return true;
  if (node.codeRef) return true;
  return false;
}

function buildEditorFactory(): CreateNodeFn {
  // Editor surfaces never run cinematic primitives — animations would fight
  // the force-graph simulation and confuse authoring.
  const base: CreateNodeFn = (node, ctx) =>
    defaultRenderModeFactory(node, ctx, { runPrimitives: false });
  return buildPerNodeFactory(base);
}

let cachedFactory: CreateNodeFn | null = null;
function getEditorFactory(): CreateNodeFn {
  if (!cachedFactory) cachedFactory = buildEditorFactory();
  return cachedFactory;
}

/** Resolve (and cache) the Object3D produced by the factory pipeline for a
 *  given PrismNode. Identity is keyed on `nodeId + codeRef` per Plan §P10:
 *  re-renders with an unchanged codeRef reuse the same Object3D so editor
 *  hot reloads don't tear and rebuild meshes. */
export function resolveArtifactObject(node: PrismNode): Object3D {
  const key = node.nodeId;
  const codeRef = node.codeRef ?? '';
  const cached = cache.get(key);
  if (cached && cached.codeRef === codeRef) {
    return cached.object;
  }
  if (cached) {
    // codeRef changed — dispose prior object before rebuilding.
    const prevCleanup = (cached.object.userData as { cleanup?: () => void }).cleanup;
    if (typeof prevCleanup === 'function') {
      try { prevCleanup(); } catch { /* ignore */ }
    }
  }
  const ctx = getSharedNodeContext({ runPrimitives: false });
  const factory = getEditorFactory();
  let object: Object3D;
  try {
    object = factory(node, ctx);
  } catch (err) {
    // Factory blew up — keep the editor running with an empty Group rather
    // than throwing through React's render path. Surface the cause so the
    // user can act on it (broken codeRef module, missing asset, etc).
    console.warn(`[ArtifactNode] factory failed for ${node.nodeId}:`, err);
    object = new Group();
    object.name = `node:${node.nodeId}:fallback`;
    object.userData.nodeId = node.nodeId;
    object.userData.cleanup = () => {};
  }
  // Plan §P10 (line 233): "scenePosition is IGNORED in editor view —
  // <primitive> is positioned by the parent <group position={[node.x,
  // node.y, node.z]}>". Both `defaultRenderModeFactory` and
  // `buildPerNodeFactory` (placeholder) apply scenePosition to the returned
  // root; reset to identity so the parent force-graph position is the
  // single source of truth in the editor.
  object.position.set(0, 0, 0);
  object.rotation.set(0, 0, 0);
  object.scale.set(1, 1, 1);
  cache.set(key, { object, codeRef });
  return object;
}

/** Test-only: clear the artifact cache so each test starts with fresh
 *  Object3D instances. Disposes cached objects via their userData.cleanup
 *  hook to avoid GPU resource leaks across runs. */
export function __resetArtifactNodeCache(): void {
  for (const entry of cache.values()) {
    const cleanup = (entry.object.userData as { cleanup?: () => void }).cleanup;
    if (typeof cleanup === 'function') {
      try { cleanup(); } catch { /* ignore */ }
    }
  }
  cache.clear();
  cachedFactory = null;
}

interface ArtifactNodeProps {
  node: PrismNode;
}

export default function ArtifactNode({ node }: ArtifactNodeProps) {
  const object = useMemo(() => resolveArtifactObject(node), [node.nodeId, node.codeRef]);
  return (
    <group scale={[0.06, 0.06, 0.06]}>
      <primitive object={object} />
    </group>
  );
}
