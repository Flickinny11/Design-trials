// EBR2-E-04 — failing tests for §R2-E SC-074 / INV-26 / RA-16.
//
// Spec refs:
//   §R2-E SC-074  "'Save and Rebuild' performs Save + locates the mounted
//                  THREE.Object3D for the node, calls object.userData.cleanup(),
//                  re-invokes createNode(config, ctx), and re-mounts at the
//                  same scenePosition. Other nodes' THREE.Object3D references
//                  are stable (verified by reference identity)."
//   §R2-E INV-26  "Single-node rebuild is the only rebuild kind supported
//                  in-app. … disposes (userData.cleanup) and re-invokes
//                  createNode for exactly one node, re-mounting at the same
//                  scenePosition. Full .prism artifact rebuilds remain a
//                  build-time operation (npm run build:prism) and are not
//                  invoked from inside the app."
//   §R2-E RA-16   "Save and Rebuild = single-node visual artifact re-render
//                  only. Save persists; Save-and-Rebuild persists +
//                  userData.cleanup() + re-invoke createNode(config, ctx) for
//                  exactly one node, re-mounting at the same scenePosition.
//                  Other nodes are not touched."
//
// haltCheck (ralph-state.json EBR2-E-04):
//   "Save-and-Rebuild button performs Save + locates the mounted
//    THREE.Object3D for the node via liveResult lookup → calls
//    object.userData.cleanup() → re-invokes createNode(node.config, ctx) →
//    re-mounts at the same scenePosition. Test asserts: target node's
//    THREE.Object3D reference changed (new object) AND other nodes'
//    references are stable (Object.is identity preserved). No other node
//    touched. Other nodes' scene positions unchanged."
//
// Strategy: parallel to EBR2-E-03's two-pronged approach.
//   (1) Pure unit tests against the new helper module that owns the rebuild
//       orchestration (rebuild-node.ts). The helper composes the legal
//       indirections (commitPreviewToSource for FP-15, the ArtifactNode cache
//       eviction for the factory rebuild, and the editor store's per-node
//       rebuild-version map for the React remount signal).
//   (2) Source-grep assertions against Inspector.tsx confirming the new
//       button carries data-testid='inspector-save-and-rebuild' and routes
//       through the helper (not raw store writes that would breach FP-15).
//   (3) The ArtifactNode cache exposes a per-node eviction that runs
//       userData.cleanup on the cached Object3D and removes the entry
//       (SC-074: "object.userData.cleanup()"); other nodes' cached entries
//       stay intact (RA-16: "other nodes are not touched").
//   (4) The editor store exposes a per-node rebuild-version counter so the
//       AssembledSceneNode wrapper can be keyed by `nodeId + ':' + version`,
//       producing the wrapper-ref change the Playwright interaction script
//       (notes/ralph-interactions/EBR2-E-04.json) asserts on
//       __PRISM_EDITOR_NODE_GROUPS__.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { PrismNode } from '@/lib/prism-graph/types';
import { usePreviewStateStore } from '@/stores/usePreviewStateStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { rebuildNode } from '@/lib/editor/rebuild-node';
import { evictArtifactCacheEntry, getArtifactCacheSize, __resetArtifactNodeCache } from '@/components/editor/graph/ArtifactNode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../');

const INSPECTOR_PATH = resolve(REPO_ROOT, 'src/components/editor/panels/Inspector.tsx');
const HELPER_PATH = resolve(REPO_ROOT, 'src/lib/editor/rebuild-node.ts');
const ARTIFACT_NODE_PATH = resolve(REPO_ROOT, 'src/components/editor/graph/ArtifactNode.tsx');
const EDITOR_STORE_PATH = resolve(REPO_ROOT, 'src/stores/useGraphEditorStore.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function makeNode(nodeId: string, overrides: Partial<PrismNode> = {}): PrismNode {
  return {
    nodeId,
    parentHubId: 'home',
    subtype: 'cta-button',
    serviceTag: 'home/cta',
    codeRef: 'gen/cta.tsx',
    backendRef: null,
    visual: { transform: { width: 0.35, height: 0.35 } } as unknown as PrismNode['visual'],
    intent: { description: '' } as unknown as PrismNode['intent'],
    scenePosition: { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
    canvasTransform: { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
    ...overrides,
  } as PrismNode;
}

function seedSource(nodes: PrismNode[]): void {
  useGraphSourceStore.setState({
    hubs: [],
    nodes,
    edges: [],
    rootNodes: [],
    ready: true,
    error: null,
    isDirty: false,
    savedAt: null,
  });
}

afterEach(() => {
  usePreviewStateStore.getState().discardAll();
  useGraphSourceStore.getState().reset();
  __resetArtifactNodeCache();
  // Reset editor store rebuild-version map.
  useGraphEditorStore.setState({ nodeRebuildVersion: {} });
});

// ─────────────────────────────────────────────────────────────────────
// Part 1 — rebuild-node helper: orchestrates Save + cleanup + remount.
// ─────────────────────────────────────────────────────────────────────
describe('EBR2-E-04 / rebuild-node helper — orchestration semantics', () => {
  it('the helper module exists at src/lib/editor/rebuild-node.ts', () => {
    expect(() => read(HELPER_PATH)).not.toThrow();
  });

  it('exports rebuildNode as a named function', () => {
    const src = read(HELPER_PATH);
    expect(src).toMatch(/export\s+function\s+rebuildNode\s*\(/);
  });

  it('returns { rebuilt: false } when nodeId is unknown to the source store', () => {
    seedSource([makeNode('node-1')]);
    const result = rebuildNode('unknown-node');
    expect(result.rebuilt).toBe(false);
  });

  it('returns { rebuilt: true } when invoked on a known node', () => {
    seedSource([makeNode('node-1')]);
    const result = rebuildNode('node-1');
    expect(result.rebuilt).toBe(true);
  });

  it('flushes the preview-state buffer to source first (the "Save" part of Save-and-Rebuild)', () => {
    seedSource([makeNode('node-1', { caption: 'BEFORE' } as Partial<PrismNode>)]);
    usePreviewStateStore.getState().set('node-1', { caption: 'AFTER' } as Partial<PrismNode>);
    rebuildNode('node-1');
    const updated = useGraphSourceStore.getState().nodes.find((n) => n.nodeId === 'node-1');
    expect((updated as unknown as { caption: string }).caption).toBe('AFTER');
    expect(usePreviewStateStore.getState().peek('node-1')).toBeNull();
  });

  it('marks the source store dirty so the existing debounced autosave flushes', () => {
    seedSource([makeNode('node-1')]);
    usePreviewStateStore.getState().set('node-1', { caption: 'X' } as Partial<PrismNode>);
    expect(useGraphSourceStore.getState().isDirty).toBe(false);
    rebuildNode('node-1');
    expect(useGraphSourceStore.getState().isDirty).toBe(true);
  });

  it('bumps the per-node rebuild version in the editor store (target only)', () => {
    seedSource([makeNode('node-a'), makeNode('node-b')]);
    expect(useGraphEditorStore.getState().nodeRebuildVersion['node-a'] ?? 0).toBe(0);
    expect(useGraphEditorStore.getState().nodeRebuildVersion['node-b'] ?? 0).toBe(0);
    rebuildNode('node-a');
    expect(useGraphEditorStore.getState().nodeRebuildVersion['node-a']).toBe(1);
    expect(useGraphEditorStore.getState().nodeRebuildVersion['node-b'] ?? 0).toBe(0);
  });

  it('does not touch other nodes (other nodes\' source data is byte-identical after rebuild)', () => {
    const a = makeNode('node-a', { caption: 'A-CAP' } as Partial<PrismNode>);
    const b = makeNode('node-b', { caption: 'B-CAP' } as Partial<PrismNode>);
    seedSource([a, b]);
    const bBefore = useGraphSourceStore.getState().nodes.find((n) => n.nodeId === 'node-b');
    rebuildNode('node-a');
    const bAfter = useGraphSourceStore.getState().nodes.find((n) => n.nodeId === 'node-b');
    expect(bAfter).toBe(bBefore);
  });

  it('preserves the target node\'s scenePosition (RA-16: "re-mounting at the same scenePosition")', () => {
    const a = makeNode('node-a', {
      scenePosition: { x: 1.5, y: -2.25, z: 0.5, rotationX: 0.1, rotationY: 0.2, rotationZ: 0.3, scaleX: 1, scaleY: 1, scaleZ: 1 },
    } as Partial<PrismNode>);
    seedSource([a]);
    rebuildNode('node-a');
    const after = useGraphSourceStore.getState().nodes.find((n) => n.nodeId === 'node-a');
    expect(after?.scenePosition).toEqual({
      x: 1.5, y: -2.25, z: 0.5,
      rotationX: 0.1, rotationY: 0.2, rotationZ: 0.3,
      scaleX: 1, scaleY: 1, scaleZ: 1,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────
// Part 2 — ArtifactNode cache exposes per-node eviction with cleanup.
// ─────────────────────────────────────────────────────────────────────
describe('EBR2-E-04 / ArtifactNode cache — single-node cleanup + evict', () => {
  it('exports evictArtifactCacheEntry as a named function', () => {
    const src = read(ARTIFACT_NODE_PATH);
    expect(src).toMatch(/export\s+function\s+evictArtifactCacheEntry\s*\(/);
  });

  it('exports getArtifactCacheSize as a named function (test diagnostic)', () => {
    const src = read(ARTIFACT_NODE_PATH);
    expect(src).toMatch(/export\s+function\s+getArtifactCacheSize\s*\(/);
  });

  it('evicting a missing key is a no-op (returns false)', () => {
    expect(evictArtifactCacheEntry('not-a-real-node')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Part 3 — editor store exposes a per-node rebuild-version surface.
// ─────────────────────────────────────────────────────────────────────
describe('EBR2-E-04 / editor store — per-node rebuild version', () => {
  it('exposes nodeRebuildVersion as a Record<string, number> in state', () => {
    const src = read(EDITOR_STORE_PATH);
    expect(src).toMatch(/nodeRebuildVersion\s*:\s*Record<\s*string\s*,\s*number\s*>/);
  });

  it('exposes bumpNodeRebuildVersion as an action', () => {
    const src = read(EDITOR_STORE_PATH);
    expect(src).toMatch(/bumpNodeRebuildVersion\s*:\s*\(/);
  });

  it('bumpNodeRebuildVersion increments only the target node\'s version', () => {
    useGraphEditorStore.getState().bumpNodeRebuildVersion('node-x');
    expect(useGraphEditorStore.getState().nodeRebuildVersion['node-x']).toBe(1);
    expect(useGraphEditorStore.getState().nodeRebuildVersion['node-y'] ?? 0).toBe(0);
    useGraphEditorStore.getState().bumpNodeRebuildVersion('node-x');
    expect(useGraphEditorStore.getState().nodeRebuildVersion['node-x']).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Part 4 — Inspector.tsx wires the Save and Rebuild button through helper.
// ─────────────────────────────────────────────────────────────────────
describe('EBR2-E-04 / Inspector wiring — Save and Rebuild button', () => {
  it('button carries data-testid="inspector-save-and-rebuild" (interaction-script contract)', () => {
    const src = read(INSPECTOR_PATH);
    expect(src).toMatch(/data-testid=["']inspector-save-and-rebuild["']/);
  });

  it('Inspector.tsx imports rebuildNode from the helper', () => {
    const src = read(INSPECTOR_PATH);
    expect(src).toMatch(/import\s*\{[^}]*rebuildNode[^}]*\}\s*from\s*['"]@\/lib\/editor\/rebuild-node['"]/);
  });

  it('Inspector.tsx invokes rebuildNode (the Save-and-Rebuild click path)', () => {
    const src = read(INSPECTOR_PATH);
    expect(src).toMatch(/rebuildNode\s*\(/);
  });

  it('FP-15 forbidden literal still does not appear in Inspector.tsx (helper-only indirection)', () => {
    const src = read(INSPECTOR_PATH);
    expect(src).not.toMatch(/useGraphSourceStore\s*\.\s*getState\s*\(\s*\)\s*\.\s*updateNode\b/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Part 5 — AssembledSceneNode keys by nodeRebuildVersion so React
//           remounts the wrapper for the rebuilt node only. The interaction
//           script asserts __PRISM_EDITOR_NODE_GROUPS__.get(target) reference
//           change while siblings stay stable; that hinges on the React key
//           including the per-node version.
// ─────────────────────────────────────────────────────────────────────
describe('EBR2-E-04 / GraphScene — AssembledSceneNode keyed by rebuild version', () => {
  it('GraphScene.tsx reads nodeRebuildVersion from the editor store', () => {
    const src = read(resolve(REPO_ROOT, 'src/components/editor/graph/GraphScene.tsx'));
    expect(src).toMatch(/nodeRebuildVersion/);
  });

  it('AssembledSceneNode parent renders with a key that includes the per-node rebuild version', () => {
    const src = read(resolve(REPO_ROOT, 'src/components/editor/graph/GraphScene.tsx'));
    // The composed key embeds nodeId + the version; the exact shape is
    // implementation-detail but the regex covers the canonical templating.
    expect(src).toMatch(/key=\{[^}]*node\.nodeId[^}]*nodeRebuildVersion[^}]*\}/);
  });
});
