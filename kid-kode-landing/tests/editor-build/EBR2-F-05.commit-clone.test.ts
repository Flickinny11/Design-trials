// EBR2-F-05 — Pointer-up commits clone: parentHubId + caption/subtype auto-update; clear drag state.
//
// Spec refs:
//   §R2-F SC-076 — On pointer-up after Clone-drag, the clone is committed:
//                  parentHubId updates to the nearest hub; caption/subtype
//                  reflect the new parent context; draggingNodeId clears.
//   INV-20       — Selection survives transitions; after commit the clone
//                  remains selected at its new parent.
//   FP-15        — Inspector tabs route through usePreviewStateStore. The
//                  pointer-up commit lives in GraphScene (galaxy overlay),
//                  not in an Inspector tab, so it is the legal source-store
//                  caller.
//
// haltCheck (from ralph-state.json):
//   PointerUp during clone-drag: nearest-hub at release becomes the clone's
//   parentHubId; caption updates to reflect new parent context (e.g. inherit
//   hub-name prefix); subtype carries over from source. draggingNodeId
//   clears. Inspector returns to the cloned node selected at its new parent.
//   Source-store snapshot before/after asserts the new entry.
//
// This file is the failing-test contract for the Ralph TDD cycle. It MUST
// NOT be edited during the implementation step.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import type { PrismHub, PrismNode } from '../../src/lib/prism-graph/types';
import { useGraphSourceStore } from '../../src/stores/useGraphSourceStore';
import { useGraphEditorStore } from '../../src/stores/useGraphEditorStore';

const repoRoot = join(__dirname, '..', '..');
const graphSceneSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx'),
  'utf8',
);
const sourceStoreSrc = readFileSync(
  join(repoRoot, 'src', 'stores', 'useGraphSourceStore.ts'),
  'utf8',
);

function mkHub(hubId: string, title: string): PrismHub {
  return {
    hubId,
    title,
    layout: {
      viewportWidth: 1440,
      viewportHeight: 900,
      contentHeight: 900,
      backgroundColor: '#000',
    },
  };
}

function mkNode(nodeId: string, parentHubId: string, caption: string): PrismNode {
  return {
    nodeId,
    subtype: 'panel',
    parentHubId,
    serviceTag: 'svc',
    visual: {
      transform: { x: 0, y: 0, width: 100, height: 100, z: 0 },
    },
    intent: {
      caption,
      behaviorSpec: { intentClass: 'navigate' },
      stateEffects: [],
      visualSpec: { kind: 'panel' },
      contracts: { reads: [], writes: [] },
    },
    codeRef: 'codeRef',
    backendRef: null,
  } as unknown as PrismNode;
}

function resetStores() {
  useGraphSourceStore.setState({
    rootNodes: [],
    nodes: [],
    edges: [],
    hubs: [],
    isDirty: false,
  });
  useGraphEditorStore.setState({
    draggingNodeId: null,
    draggingNearestHubId: null,
    draggingPointerWorld: null,
    selectedNodeId: null,
  });
}

describe('EBR2-F-05 — useGraphSourceStore.commitClone (§R2-F SC-076)', () => {
  beforeEach(resetStores);

  it('exposes a commitClone(cloneId, hubId) action on the source store', () => {
    const s = useGraphSourceStore.getState();
    expect(s).toHaveProperty('commitClone');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(typeof (s as any).commitClone).toBe('function');
  });

  it('updates the clone parentHubId to the nearest hub on commit', () => {
    useGraphSourceStore.setState({
      hubs: [mkHub('home', 'Home'), mkHub('auth', 'Auth')],
      nodes: [mkNode('orig', 'home', 'Source Panel')],
    });
    const cloneId = useGraphSourceStore.getState().cloneNode('orig');
    expect(cloneId).toBeTruthy();

    // Sanity: pre-commit, the clone still inherits the source parentHubId.
    const pre = useGraphSourceStore
      .getState()
      .nodes.find((n) => n.nodeId === cloneId)!;
    expect(pre.parentHubId).toBe('home');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ok = (useGraphSourceStore.getState() as any).commitClone(
      cloneId,
      'auth',
    );
    expect(ok).toBe(true);

    const post = useGraphSourceStore
      .getState()
      .nodes.find((n) => n.nodeId === cloneId)!;
    expect(post.parentHubId).toBe('auth');
  });

  it('updates intent.caption on commit to reflect the new parent context (hub-title prefix)', () => {
    useGraphSourceStore.setState({
      hubs: [mkHub('home', 'Home'), mkHub('auth', 'Auth')],
      nodes: [mkNode('orig', 'home', 'Source Panel')],
    });
    const cloneId = useGraphSourceStore.getState().cloneNode('orig');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useGraphSourceStore.getState() as any).commitClone(cloneId, 'auth');
    const post = useGraphSourceStore
      .getState()
      .nodes.find((n) => n.nodeId === cloneId)!;
    // The new caption must mention the new parent hub's title so the
    // Inspector reflects "where the clone lives now".
    expect(post.intent.caption).toMatch(/Auth/);
    // The original suffix "(clone)" placed by cloneNode is preserved so the
    // user can still tell the entry is a clone, not the source.
    expect(post.intent.caption).toMatch(/\(clone\)$/);
  });

  it('preserves subtype from the source on commit (subtype carries over)', () => {
    useGraphSourceStore.setState({
      hubs: [mkHub('home', 'Home'), mkHub('auth', 'Auth')],
      nodes: [
        {
          ...mkNode('orig', 'home', 'Source Panel'),
          subtype: 'custom-subtype-x',
        },
      ],
    });
    const cloneId = useGraphSourceStore.getState().cloneNode('orig');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useGraphSourceStore.getState() as any).commitClone(cloneId, 'auth');
    const post = useGraphSourceStore
      .getState()
      .nodes.find((n) => n.nodeId === cloneId)!;
    expect(post.subtype).toBe('custom-subtype-x');
  });

  it('returns false if the clone id does not exist', () => {
    useGraphSourceStore.setState({
      hubs: [mkHub('home', 'Home')],
      nodes: [mkNode('orig', 'home', 'Source')],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ok = (useGraphSourceStore.getState() as any).commitClone(
      'nonexistent-id',
      'home',
    );
    expect(ok).toBe(false);
  });

  it('returns false if the hub id does not exist (no parentHubId write)', () => {
    useGraphSourceStore.setState({
      hubs: [mkHub('home', 'Home')],
      nodes: [mkNode('orig', 'home', 'Source')],
    });
    const cloneId = useGraphSourceStore.getState().cloneNode('orig');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ok = (useGraphSourceStore.getState() as any).commitClone(
      cloneId,
      'no-such-hub',
    );
    expect(ok).toBe(false);
    const post = useGraphSourceStore
      .getState()
      .nodes.find((n) => n.nodeId === cloneId)!;
    expect(post.parentHubId).toBe('home');
  });

  it('source-store snapshot before/after grows by exactly the committed clone entry', () => {
    useGraphSourceStore.setState({
      hubs: [mkHub('home', 'Home'), mkHub('auth', 'Auth')],
      nodes: [mkNode('orig', 'home', 'Source Panel')],
    });
    const before = useGraphSourceStore.getState().nodes.map((n) => n.nodeId);
    expect(before).toEqual(['orig']);

    const cloneId = useGraphSourceStore.getState().cloneNode('orig');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useGraphSourceStore.getState() as any).commitClone(cloneId, 'auth');

    const after = useGraphSourceStore.getState().nodes.map((n) => n.nodeId);
    expect(after).toEqual(['orig', cloneId]);
    // Source node is untouched by commit (no parent-side mutation).
    const source = useGraphSourceStore
      .getState()
      .nodes.find((n) => n.nodeId === 'orig')!;
    expect(source.parentHubId).toBe('home');
    expect(source.intent.caption).toBe('Source Panel');
  });
});

describe('EBR2-F-05 — pointer-up clear of editor-store drag slots (§R2-F SC-076)', () => {
  beforeEach(resetStores);

  it('clearDraggingClone() clears draggingNodeId, draggingNearestHubId, draggingPointerWorld', () => {
    useGraphEditorStore.setState({
      draggingNodeId: 'clone-x',
      draggingNearestHubId: 'auth',
      draggingPointerWorld: { x: 1, y: 2, z: 3 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = useGraphEditorStore.getState() as any;
    expect(typeof s.clearDraggingClone).toBe('function');
    s.clearDraggingClone();
    const after = useGraphEditorStore.getState();
    expect(after.draggingNodeId).toBeNull();
    expect(after.draggingNearestHubId).toBeNull();
    expect(after.draggingPointerWorld).toBeNull();
  });

  it('clearDraggingClone() does NOT clear selectedNodeId (INV-20: clone stays selected at new parent)', () => {
    useGraphEditorStore.setState({
      draggingNodeId: 'clone-x',
      draggingNearestHubId: 'auth',
      draggingPointerWorld: { x: 0, y: 0, z: 0 },
      selectedNodeId: 'clone-x',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useGraphEditorStore.getState() as any).clearDraggingClone();
    expect(useGraphEditorStore.getState().selectedNodeId).toBe('clone-x');
  });
});

describe('EBR2-F-05 — GraphScene wires the pointerup commit (§R2-F SC-076)', () => {
  it('GraphScene.tsx attaches a pointerup listener for the galaxy clone-drag flow', () => {
    expect(graphSceneSrc).toMatch(/pointerup/);
  });

  it('GraphScene.tsx calls commitClone in the pointerup handler', () => {
    expect(graphSceneSrc).toMatch(/commitClone/);
  });

  it('GraphScene.tsx calls clearDraggingClone in the pointerup handler', () => {
    expect(graphSceneSrc).toMatch(/clearDraggingClone/);
  });

  it('useGraphSourceStore.ts exposes a commitClone action declaration', () => {
    expect(sourceStoreSrc).toMatch(/commitClone\s*:\s*\(/);
  });

  it('clone-commit helper module exists and is pure (no Math.random / Date.now)', () => {
    const helperPath = join(
      repoRoot,
      'src',
      'lib',
      'editor',
      'clone-commit.ts',
    );
    expect(existsSync(helperPath)).toBe(true);
    const src = readFileSync(helperPath, 'utf8');
    expect(src).not.toMatch(/Math\.random\s*\(/);
    expect(src).not.toMatch(/Date\.(now|UTC)\s*\(/);
    expect(src).not.toMatch(/performance\.now\s*\(/);
  });
});
