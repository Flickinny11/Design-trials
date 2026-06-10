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
// STEP5 edit-path — verify-in-path + caption-driven repair + builtSnapshot.
import { verifyBuiltNode } from '@/lib/editor/verify-built-node';
import { repairNode } from '@/lib/editor/caption-repair';
import { computeNodeContentHash } from '@/lib/editor/node-content-hash';
import {
  useBuiltSnapshotStore,
  installBuiltSnapshotBridge,
  type BuiltSnapshotStatus,
} from '@/stores/useBuiltSnapshotStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
// P2 Task C (canvas-spec §6 state 1) — Stage-0 bubble look for the scene path.
import {
  buildBubbleArtifact,
  isStage0Bubble,
} from '@/components/editor/add-tools/create-element-node';

interface CachedEntry {
  object: Object3D;
  /** Content hash over the node's build-relevant inputs (INV-R7). The cache is
   *  a genuine content-hash cache: a hit reuses the Object3D, a miss/mismatch
   *  rebuilds — so the artifact rebuilds IFF the hash changes (RT-SC-09). */
  hash: string;
}

const cache = new Map<string, CachedEntry>();

/** The tagged empty-Group stand-in used when a factory throws. `verifyBuiltNode`
 *  detects the `:fallback` suffix as a hard build failure (FP-R3). */
function makeFallback(node: PrismNode): Object3D {
  const object = new Group();
  object.name = `node:${node.nodeId}:fallback`;
  object.userData.nodeId = node.nodeId;
  object.userData.cleanup = () => {};
  return object;
}

/** Run an Object3D's userData.cleanup() if present (dispose GPU resources +
 *  kill timelines) before discarding it during repair. */
function runCleanup(object: Object3D): void {
  const cleanup = (object.userData as { cleanup?: () => void }).cleanup;
  if (typeof cleanup === 'function') {
    try { cleanup(); } catch { /* ignore */ }
  }
}

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

function buildEditorFactory(runPrimitives: boolean): CreateNodeFn {
  // STEP6 faithful-build (scope item 2 / RT-SC-10) — the built-state surface
  // (scene layout, served to canvas + preview-app) RUNS the node's OWN
  // `cinematicPrimitives` so the artifact does what its schema specifies:
  // building a node executes the node's coded motion (anchor §2/§4, runtime
  // §9 "the runtime executes whatever animations a node declares"). The
  // galaxy authoring map (topology layout) stays static — there cinematic
  // motion would fight the force-graph simulation and confuse topology
  // authoring, so primitives are NOT run.
  const base: CreateNodeFn = (node, ctx) =>
    defaultRenderModeFactory(node, ctx, { runPrimitives, nodeMaterials: false });
  return buildPerNodeFactory(base);
}

// One cached factory per layout: topology = static (no motion), scene = the
// node's coded primitives run (faithful built-state).
let cachedTopologyFactory: CreateNodeFn | null = null;
let cachedSceneFactory: CreateNodeFn | null = null;
function getEditorFactory(runPrimitives: boolean): CreateNodeFn {
  if (runPrimitives) {
    if (!cachedSceneFactory) cachedSceneFactory = buildEditorFactory(true);
    return cachedSceneFactory;
  }
  if (!cachedTopologyFactory) cachedTopologyFactory = buildEditorFactory(false);
  return cachedTopologyFactory;
}

/** Resolve (and cache) the Object3D produced by the factory pipeline for a
 *  given PrismNode. The cache is keyed by a **content hash** over the node's
 *  build-relevant inputs (INV-R7 / RT-SC-09): a hash hit reuses the cached
 *  Object3D (so a pure mode toggle issues zero `createNode` calls, RT-SC-08),
 *  and the artifact rebuilds IFF the hash changes. Because the hash includes
 *  `codeRef`, this subsumes the prior `nodeId + codeRef` identity rule. */
export type ArtifactNodeLayout = 'topology' | 'scene';

export function resolveArtifactObject(node: PrismNode, layout: ArtifactNodeLayout = 'topology'): Object3D {
  const key = `${node.nodeId}|${layout}`;
  const hash = computeNodeContentHash(node);
  const cached = cache.get(key);
  if (cached && cached.hash === hash) {
    // Content hash unchanged — reuse the built artifact (no rebuild, INV-R7).
    return cached.object;
  }
  if (cached) {
    // Hash changed — dispose the stale object before rebuilding this one node.
    runCleanup(cached.object);
  }
  // P2 Task C (canvas-spec §6 state 1) — Stage-0 BUBBLE. An artifact-less
  // node (no sourceAsset / meshUrl / codeRef; not a text node; no legacy §13
  // runtime labels) is not yet a built UI element, so the scene path renders
  // the §6 translucent liquid sphere instead of running the factory (which
  // would produce a blank untextured plane). The bubble is a real raycast-
  // hittable Mesh riding the AssembledSceneNode composed-pose wrapper like
  // any artifact (selectable, transformable). It deliberately SKIPS the
  // verify/repair/builtSnapshot block below: a bubble is stage-1 "not yet
  // built" — recording a builtSnapshot for it would lie about §6 (Build Node
  // appears only once the node is Populated). Galaxy/topology keep the
  // GlassNode dormant-sphere fallback (hasArtifactData delegation), so the
  // node still appears in galaxy through the normal store flow (INV-7).
  if (layout === 'scene' && isStage0Bubble(node)) {
    if (typeof window !== 'undefined') {
      // RT-SC-08 accounting — a bubble build is still a cache MISS build.
      const w = window as unknown as { __artifactBuildCount?: number };
      w.__artifactBuildCount = (w.__artifactBuildCount ?? 0) + 1;
    }
    const object = buildBubbleArtifact(node.nodeId);
    cache.set(key, { object, hash });
    return object;
  }
  // STEP6 — scene layout is the built-state surface (canvas + preview-app):
  // bind the REAL primitives API and run the node's coded motion. Topology
  // (galaxy map) keeps the no-op primitives + static factory.
  const runPrimitives = layout === 'scene';
  const ctx = getSharedNodeContext({ runPrimitives });
  const factory = getEditorFactory(runPrimitives);
  // RT-SC-08 diagnostic — count actual artifact builds (cache MISSES). A pure
  // mode toggle (galaxy↔canvas↔preview-app) on already-built nodes must add 0
  // here. Editor-shell scope; guarded so it never runs in a non-browser env.
  if (typeof window !== 'undefined') {
    const w = window as unknown as { __artifactBuildCount?: number };
    w.__artifactBuildCount = (w.__artifactBuildCount ?? 0) + 1;
  }
  let object: Object3D;
  try {
    object = factory(node, ctx);
  } catch (err) {
    // Factory blew up — keep the editor running with an empty Group rather
    // than throwing through React's render path. Surface the cause so the
    // user can act on it (broken codeRef module, missing asset, etc).
    console.warn(`[ArtifactNode] factory failed for ${node.nodeId}:`, err);
    object = makeFallback(node);
  }

  // STEP5 edit-path (anchor §8, NE-SC-13, runtime RT-SC-06/07/09) — verify the
  // freshly-built artifact, run caption-driven repair on failure, and record
  // the node's builtSnapshot. Only the 'scene' layout is the built-state
  // surface shown in canvas/preview-app; 'topology' is the galaxy authoring map
  // (dormant spheres / force-graph), which is not a build-verified surface.
  if (layout === 'scene') {
    const verify = verifyBuiltNode(object, node);
    let status: BuiltSnapshotStatus = verify.ok ? 'built' : 'failed';
    let reason = verify.reason;
    let repairStrategy: string | undefined;

    if (!verify.ok) {
      // detect → flag → repair-attempt → re-verify. The repair reads ONLY the
      // node caption, the hub caption, and the node's stored contents (cold
      // context); it never reaches back into the prior/broken artifact.
      const hub =
        useGraphSourceStore.getState().hubs.find((h) => h.hubId === node.parentHubId) ?? null;
      try {
        const repair = repairNode(node, hub);
        runCleanup(object);
        const repairedObj = factory(repair.node, ctx);
        const reverify = verifyBuiltNode(repairedObj, repair.node);
        if (reverify.ok) {
          object = repairedObj;
          status = 'repaired';
          reason = verify.reason; // preserve the ORIGINAL failure reason
          repairStrategy = repair.strategy;
          console.info(
            `[ArtifactNode] caption-driven repair recovered ${node.nodeId} ` +
              `(was '${verify.reason}'): ${repair.strategy}`,
          );
        } else {
          runCleanup(repairedObj);
          status = 'failed';
        }
      } catch (e) {
        console.warn(`[ArtifactNode] caption-driven repair failed for ${node.nodeId}:`, e);
        status = 'failed';
      }
    }

    // Refresh ONLY this node's builtSnapshot entry, keyed by the SOURCE node's
    // content hash (the same hash that gates the cache above). The snapshot
    // therefore tracks the user-edited source state; `status` records whether
    // that state built cleanly or was recovered by repair. Deferred out of
    // React's render phase so the zustand write never fires mid-render.
    const snap = { nodeId: node.nodeId, hash, layout, status, reason, repairStrategy };
    queueMicrotask(() => {
      useBuiltSnapshotStore.getState().record(snap);
      installBuiltSnapshotBridge();
    });
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
  cache.set(key, { object, hash });
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
  cachedTopologyFactory = null;
  cachedSceneFactory = null;
}

/** EBR2-E-04 / §R2-E SC-074 — single-node cache eviction with userData.cleanup.
 *  Drops every cached Object3D produced for `nodeId` across all layouts
 *  ('topology' + 'scene'), running each entry's userData.cleanup() to release
 *  GPU resources and kill GSAP timelines (INV-14). Other nodes' cached
 *  entries are not touched. Returns true iff at least one entry was evicted. */
export function evictArtifactCacheEntry(nodeId: string): boolean {
  const layouts: ArtifactNodeLayout[] = ['topology', 'scene'];
  let evicted = false;
  for (const layout of layouts) {
    const key = `${nodeId}|${layout}`;
    const entry = cache.get(key);
    if (!entry) continue;
    const cleanup = (entry.object.userData as { cleanup?: () => void }).cleanup;
    if (typeof cleanup === 'function') {
      try { cleanup(); } catch { /* ignore */ }
    }
    cache.delete(key);
    evicted = true;
  }
  return evicted;
}

/** Test diagnostic — current size of the artifact cache. */
export function getArtifactCacheSize(): number {
  return cache.size;
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
