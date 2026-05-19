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
// Two-coordinate-system reconciliation: topology mode uses force-graph
// positions (from `useForceGraph`) and resets factory scenePosition on the
// child. Scene mode also resets factory scenePosition on the child — the
// renderer-level wrapper (AssembledSceneNode in GraphScene.tsx) is the sole
// consumer of scenePosition + canvasTransform for visible placement
// (EBR2-C-03 / §R2-C INV-25); the factory output stays at local identity so
// the wrapper's `position={[sp+ct]}` composition doesn't double-apply.
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
  // the force-graph simulation and confuse topology authoring.
  const base: CreateNodeFn = (node, ctx) =>
    defaultRenderModeFactory(node, ctx, { runPrimitives: false, nodeMaterials: false });
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
export type ArtifactNodeLayout = 'topology' | 'scene';

export function resolveArtifactObject(node: PrismNode, layout: ArtifactNodeLayout = 'topology'): Object3D {
  const key = `${node.nodeId}|${layout}`;
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
  if (layout === 'topology') {
    // Topology view positions the artifact by the surrounding force-graph
    // group. Reset the factory root so scenePosition does not compound.
    object.position.set(0, 0, 0);
    object.rotation.set(0, 0, 0);
    object.scale.set(1, 1, 1);
  } else if (layout === 'scene') {
    // EBR2-C-03 / §R2-C INV-25 — scene-layout placement is owned by the
    // renderer wrapper (AssembledSceneNode), which composes scenePosition +
    // canvasTransform on its <group>. Reset the factory root here so the
    // composed wrapper isn't fighting the factory's own scenePosition write.
    object.position.set(0, 0, 0);
    object.rotation.set(0, 0, 0);
    object.scale.set(1, 1, 1);
  }
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
  layout?: ArtifactNodeLayout;
}

export default function ArtifactNode({ node, layout = 'topology' }: ArtifactNodeProps) {
  const object = useMemo(() => resolveArtifactObject(node, layout), [node.nodeId, node.codeRef, layout]);
  const scale = layout === 'topology' ? 0.06 : 1;
  return (
    <group scale={[scale, scale, scale]}>
      <primitive object={object} />
    </group>
  );
}
