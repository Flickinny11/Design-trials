// EBR2-E-03 — failing tests for §R2-E SC-072 / SC-073.
//
// Spec refs:
//   §R2-E SC-072  "Inspector exposes 'Save' and 'Save and Rebuild' buttons.
//                  Inspector tab fader/knob writes route through
//                  usePreviewStateStore (not the source store directly); the
//                  renderer reads source ⊕ preview overlay so changes appear
//                  real-time."
//   §R2-E SC-073  "'Save' copies preview-state → source store via updateNode,
//                  clears the preview-state buffer for that node, and lets the
//                  existing 1s debounced autosave flush to server."
//
// haltCheck (ralph-state.json):
//   "Save button in Inspector toolbar (enabled when isDirty(nodeId)).
//    On click: usePreviewStateStore.commit(nodeId) → calls
//    useGraphSourceStore.updateNode (the only legal path from within Inspector
//    — but indirected via a helper). Debounced autosave (1s) then flushes to
//    server. Smoke: edit slider → preview shows change → click Save →
//    previewState cleared → source store updated."
//
// Two-pronged strategy:
//   (1) Pure unit tests against the helper module that owns the commit logic
//       (preview-commit.ts). FP-15 forbids Inspector*.tsx from calling
//       useGraphSourceStore.getState().updateNode; the helper is the legal
//       indirection.
//   (2) Source-grep assertions against Inspector.tsx confirming the button
//       carries data-testid='inspector-save' (interaction-script contract)
//       and routes through the helper rather than the raw source store.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { PrismNode } from '@/lib/prism-graph/types';
import { usePreviewStateStore } from '@/stores/usePreviewStateStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { commitPreviewToSource } from '@/lib/editor/preview-commit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../');

const INSPECTOR_PATH = resolve(REPO_ROOT, 'src/components/editor/panels/Inspector.tsx');
const HELPER_PATH = resolve(REPO_ROOT, 'src/lib/editor/preview-commit.ts');

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
});

// ─────────────────────────────────────────────────────────────────────
// Part 1 — preview-commit helper: the legal updateNode indirection.
// ─────────────────────────────────────────────────────────────────────
describe('EBR2-E-03 / preview-commit helper — commit semantics', () => {
  it('returns { committed: false } when the preview buffer is empty for the node', () => {
    seedSource([makeNode('node-1')]);
    const result = commitPreviewToSource('node-1');
    expect(result.committed).toBe(false);
    expect(result.patch).toBeNull();
  });

  it('returns { committed: true, patch } when the preview buffer has a non-empty patch', () => {
    seedSource([makeNode('node-1')]);
    usePreviewStateStore.getState().set('node-1', { caption: 'SAVE-COMMIT-TEST' } as Partial<PrismNode>);
    const result = commitPreviewToSource('node-1');
    expect(result.committed).toBe(true);
    expect(result.patch).toEqual({ caption: 'SAVE-COMMIT-TEST' });
  });

  it('copies the preview patch into the source store via updateNode (SC-073)', () => {
    seedSource([makeNode('node-1', { caption: 'BEFORE' } as Partial<PrismNode>)]);
    usePreviewStateStore.getState().set('node-1', { caption: 'AFTER' } as Partial<PrismNode>);
    commitPreviewToSource('node-1');
    const updated = useGraphSourceStore.getState().nodes.find((n) => n.nodeId === 'node-1');
    expect((updated as unknown as { caption: string }).caption).toBe('AFTER');
  });

  it('clears the preview buffer for that node after committing (SC-073)', () => {
    seedSource([makeNode('node-1')]);
    usePreviewStateStore.getState().set('node-1', { caption: 'X' } as Partial<PrismNode>);
    expect(usePreviewStateStore.getState().isDirty('node-1')).toBe(true);
    commitPreviewToSource('node-1');
    expect(usePreviewStateStore.getState().isDirty('node-1')).toBe(false);
    expect(usePreviewStateStore.getState().peek('node-1')).toBeNull();
  });

  it('only clears the committed node — other nodes\' buffers stay intact', () => {
    seedSource([makeNode('node-a'), makeNode('node-b')]);
    usePreviewStateStore.getState().set('node-a', { caption: 'A' } as Partial<PrismNode>);
    usePreviewStateStore.getState().set('node-b', { caption: 'B' } as Partial<PrismNode>);
    commitPreviewToSource('node-a');
    expect(usePreviewStateStore.getState().peek('node-a')).toBeNull();
    expect(usePreviewStateStore.getState().peek('node-b')).toEqual({ caption: 'B' });
  });

  it('marks the source store dirty (so existing debounced autosave flushes to server)', () => {
    seedSource([makeNode('node-1')]);
    expect(useGraphSourceStore.getState().isDirty).toBe(false);
    usePreviewStateStore.getState().set('node-1', { caption: 'X' } as Partial<PrismNode>);
    commitPreviewToSource('node-1');
    expect(useGraphSourceStore.getState().isDirty).toBe(true);
  });

  it('no-ops cleanly when nodeId is unknown to the source store', () => {
    seedSource([makeNode('node-1')]);
    expect(() => commitPreviewToSource('unknown-node')).not.toThrow();
    expect(useGraphSourceStore.getState().isDirty).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Part 2 — helper file lives in src/lib/editor (FP-15 indirection contract).
// ─────────────────────────────────────────────────────────────────────
describe('EBR2-E-03 / preview-commit helper — FP-15 indirection contract', () => {
  it('the helper module exists at src/lib/editor/preview-commit.ts', () => {
    expect(() => read(HELPER_PATH)).not.toThrow();
  });

  it('the helper imports both stores (it is the legal seam)', () => {
    const src = read(HELPER_PATH);
    expect(src).toMatch(/from\s+['"]@\/stores\/usePreviewStateStore['"]/);
    expect(src).toMatch(/from\s+['"]@\/stores\/useGraphSourceStore['"]/);
  });

  it('exports commitPreviewToSource as a named function', () => {
    const src = read(HELPER_PATH);
    expect(src).toMatch(/export\s+function\s+commitPreviewToSource\s*\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Part 3 — Inspector.tsx wires the Save button through the helper.
// ─────────────────────────────────────────────────────────────────────
describe('EBR2-E-03 / Inspector wiring — Save button', () => {
  it('Save button carries data-testid="inspector-save" (interaction-script contract)', () => {
    const src = read(INSPECTOR_PATH);
    expect(src).toMatch(/data-testid=["']inspector-save["']/);
  });

  it('Inspector.tsx imports commitPreviewToSource from the helper', () => {
    const src = read(INSPECTOR_PATH);
    expect(src).toMatch(/import\s*\{[^}]*commitPreviewToSource[^}]*\}\s*from\s*['"]@\/lib\/editor\/preview-commit['"]/);
  });

  it('Inspector.tsx invokes commitPreviewToSource (the Save click path)', () => {
    const src = read(INSPECTOR_PATH);
    expect(src).toMatch(/commitPreviewToSource\s*\(/);
  });

  it('FP-15 forbidden literal does not appear in Inspector.tsx', () => {
    const src = read(INSPECTOR_PATH);
    expect(src).not.toMatch(/useGraphSourceStore\s*\.\s*getState\s*\(\s*\)\s*\.\s*updateNode\b/);
  });
});
