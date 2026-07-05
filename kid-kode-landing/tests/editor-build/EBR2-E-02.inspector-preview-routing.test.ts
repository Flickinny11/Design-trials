// EBR2-E-02 — Inspector tab writes route through usePreviewStateStore;
//              AssembledSceneNode reads sourceNode ⊕ previewState[nodeId].
//
// Spec refs:
//   §R2-E SC-072  "Inspector exposes 'Save' and 'Save and Rebuild' buttons.
//                  Inspector tab fader/knob writes route through
//                  usePreviewStateStore (not the source store directly); the
//                  renderer reads source ⊕ preview overlay so changes appear
//                  real-time."
//   §R2-E FP-15   "useGraphSourceStore.getState().updateNode in any file path
//                  matching **/Inspector*.tsx or **/panels/*Tab.tsx. Inspector
//                  tab edits MUST route through usePreviewStateStore first."
//
// haltCheck (ralph-state.json):
//   "All Inspector tab writes go to usePreviewStateStore. AssembledSceneNode
//    reads (sourceNode ⊕ previewState[nodeId]) so live preview is real-time.
//    FP-15 hook does not trigger. Existing autosave behavior preserved for
//    non-Inspector callers."
//
// Test strategy mirrors EBR2-C-03: source-grep assertions against the
// committed files, plus a pure-helper integration test for the
// "source ⊕ preview" composition that AssembledSceneNode consumes.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { PrismNode } from '@/lib/prism-graph/types';
import { usePreviewStateStore } from '@/stores/usePreviewStateStore';
import { composeNodeWithPreview } from '@/stores/usePreviewStateStore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../');

const INSPECTOR_PATH = resolve(REPO_ROOT, 'src/components/editor/panels/Inspector.tsx');
const GRAPH_SCENE_PATH = resolve(REPO_ROOT, 'src/components/editor/graph/GraphScene.tsx');
const PAGE_PATH = resolve(REPO_ROOT, 'src/app/page.tsx');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function extractFunctionBlock(src: string, fnName: string): string {
  const startMarker = `function ${fnName}(`;
  const startIdx = src.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error(`Could not find 'function ${fnName}(' in source.`);
  }
  let parenDepth = 0;
  let cursor = startIdx + startMarker.length - 1;
  for (; cursor < src.length; cursor++) {
    const ch = src[cursor];
    if (ch === '(') parenDepth += 1;
    else if (ch === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) {
        cursor += 1;
        break;
      }
    }
  }
  const bodyOpen = src.indexOf('{', cursor);
  if (bodyOpen === -1) throw new Error(`No body brace after ${fnName} signature.`);
  let depth = 0;
  let i = bodyOpen;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        i += 1;
        break;
      }
    }
  }
  return src.slice(startIdx, i);
}

function resetPreview(): void {
  usePreviewStateStore.getState().discardAll();
}

afterEach(() => {
  resetPreview();
});

// ─────────────────────────────────────────────────────────────────────
// Part 1 — FP-15 routing: Inspector keyframe-capture write goes to
// usePreviewStateStore, not useGraphSourceStore.updateNode.
// ─────────────────────────────────────────────────────────────────────
describe('EBR2-E-02 / FP-15 — Inspector tab keyframe write routes through usePreviewStateStore', () => {
  it('imports usePreviewStateStore in Inspector.tsx (the write surface)', () => {
    const src = read(INSPECTOR_PATH);
    expect(src).toMatch(/from\s+['"]@\/stores\/usePreviewStateStore['"]/);
  });

  it("AnimationTab's keyframe capture handler does NOT call updateNode", () => {
    const src = read(INSPECTOR_PATH);
    const block = extractFunctionBlock(src, 'AnimationTab');
    // The Save-as-keyframe handler used to call updateNode(...) directly;
    // SC-072 requires Inspector tab writes to route through the preview
    // store first. After this task, AnimationTab must not contain a
    // `updateNode(` call site at all (the keyframe write moved to
    // previewState).
    expect(block).not.toMatch(/\bupdateNode\s*\(/);
  });

  it("AnimationTab's keyframe capture handler writes through usePreviewStateStore.set", () => {
    const src = read(INSPECTOR_PATH);
    const block = extractFunctionBlock(src, 'AnimationTab');
    // Must call .set(<nodeId>, { keyframes: ... }) on the preview store.
    expect(block).toMatch(/usePreviewStateStore[\s\S]{0,200}\.set\s*\(/);
    expect(block).toMatch(/keyframes\s*:/);
  });

  it('FP-15 forbidden literal (useGraphSourceStore.getState().updateNode) does not appear in Inspector.tsx', () => {
    const src = read(INSPECTOR_PATH);
    // The FP-15 anti-drift regex; the Inspector file must not match it.
    expect(src).not.toMatch(/useGraphSourceStore\s*\.\s*getState\s*\(\s*\)\s*\.\s*updateNode\b/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Part 2 — Renderer composition: AssembledSceneNode reads source ⊕ preview.
// ─────────────────────────────────────────────────────────────────────
describe('EBR2-E-02 / SC-072 — AssembledSceneNode reads source ⊕ preview overlay', () => {
  it('imports usePreviewStateStore in GraphScene.tsx (renderer subscribes to preview store)', () => {
    const src = read(GRAPH_SCENE_PATH);
    expect(src).toMatch(/from\s+['"]@\/stores\/usePreviewStateStore['"]/);
  });

  it('AssembledSceneNode subscribes to usePreviewStateStore and composes the patch onto the node', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'AssembledSceneNode');
    // The renderer must read from the preview store at the AssembledSceneNode
    // call site — either via a hook subscription or composeNodeWithPreview.
    // Accept either pattern so the implementer can pick the cleaner shape.
    const subscribes =
      /usePreviewStateStore\s*\(/.test(block) ||
      /composeNodeWithPreview\s*\(/.test(block);
    expect(subscribes).toBe(true);
  });

  it('AssembledSceneNode composes the node with the patch before reading scenePosition / canvasTransform', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'AssembledSceneNode');
    // The composed node must drive the position/rotation/scale reads. The
    // existing source uses `node.scenePosition` and `readCanvasTransform(node)`;
    // after this task at least one of:
    //   - composeNodeWithPreview(node, patch) → consumed by sp/ct reads
    //   - a locally-named `effective` / `composed` / `merged` node fed into
    //     `readCanvasTransform(...)`
    // shows up in the block.
    const hasComposed =
      /composeNodeWithPreview\s*\(/.test(block) ||
      /(effective|composed|merged)Node/.test(block);
    expect(hasComposed).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Part 3 — composeNodeWithPreview pure-helper semantics.
// ─────────────────────────────────────────────────────────────────────
describe('EBR2-E-02 / SC-072 — composeNodeWithPreview helper (source ⊕ preview)', () => {
  const baseNode: PrismNode = {
    nodeId: 'n-1',
    parentHubId: 'home',
    subtype: 'cta-button',
    serviceTag: 'home/cta',
    codeRef: 'gen/cta.tsx',
    backendRef: null,
    visual: { transform: { width: 0.35, height: 0.35 } } as unknown as PrismNode['visual'],
    intent: { description: '' } as unknown as PrismNode['intent'],
    scenePosition: { x: 1, y: 2, z: 3, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
    canvasTransform: { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
  };

  it('returns the source node unchanged when patch is null', () => {
    const composed = composeNodeWithPreview(baseNode, null);
    expect(composed).toEqual(baseNode);
  });

  it('overlays a subtype patch on top of the source node', () => {
    const composed = composeNodeWithPreview(baseNode, { subtype: 'header' });
    expect(composed.subtype).toBe('header');
    // Other source fields stay intact.
    expect(composed.nodeId).toBe('n-1');
    expect(composed.scenePosition).toEqual(baseNode.scenePosition);
  });

  it('overlays a canvasTransform patch (the field driving SC-072 live preview)', () => {
    const patchedCT = {
      x: 0.5, y: 0, z: 0,
      rotationX: 0, rotationY: 0, rotationZ: 0,
      scaleX: 1, scaleY: 1, scaleZ: 1,
    };
    const composed = composeNodeWithPreview(baseNode, { canvasTransform: patchedCT });
    expect(composed.canvasTransform).toEqual(patchedCT);
  });

  it('does not mutate the source node (defensive copy)', () => {
    const before = JSON.parse(JSON.stringify(baseNode));
    composeNodeWithPreview(baseNode, { subtype: 'patched-subtype' });
    expect(baseNode).toEqual(before);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Part 4 — Debug surface: page.tsx exposes previewState on
//          window.__PRISM_DEBUG_STORES__ for the verify-editor-runtimes
//          interaction script (notes/ralph-interactions/EBR2-E-02.json).
// ─────────────────────────────────────────────────────────────────────
describe('EBR2-E-02 / interaction script — previewState exposed on __PRISM_DEBUG_STORES__', () => {
  it('page.tsx wires usePreviewStateStore onto window.__PRISM_DEBUG_STORES__.previewState', () => {
    const src = read(PAGE_PATH);
    // Both the type widening and the runtime assignment land in the same
    // useEffect block in page.tsx; we assert both surfaces.
    expect(src).toMatch(/previewState\s*:\s*typeof\s+usePreviewStateStore/);
    expect(src).toMatch(/previewState\s*:\s*usePreviewStateStore/);
  });
});
