// EBR2-C-02 — Gate CanvasTransformGizmo on editorMode === 'edit'.
//
// Spec refs:
//   §R2-C SC-068  "Inspector exposes an 'Edit' button. Transform handles
//                  (CanvasTransformGizmo) render only when
//                  editorMode === 'edit' AND viewMode === 'canvas' AND a
//                  node is selected."
//
// haltCheck (ralph-state.json):
//   "CanvasTransformGizmo mounts only when viewMode==='canvas' AND
//    editorMode==='edit' AND a node is selected. Snapshot proves: selecting
//    a node alone shows no handles; clicking Edit reveals them; clicking
//    Done hides them."
//
// Test strategy:
//   • Static source-grep on GraphScene.tsx for the editorMode subscription
//     and the three-clause gate (viewMode === 'canvas' AND editorMode ===
//     'edit' AND a node selected). Mirrors the pattern used by EB-05-03,
//     EBR2-B-02, EBR2-B-03 elsewhere in this round — the gizmo itself
//     mounts inside an R3F Canvas, which is not trivially renderable from
//     a unit test, so we assert the gate at the source level and let
//     verify-editor-runtimes prove the runtime visual.
//   • Source-level proof that the keyboard handler (which `window`-level
//     registers Escape and g/r/s mode switching) is also gated on
//     editorMode === 'edit', so the gizmo cannot react to keypresses while
//     idle.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../');

const GRAPH_SCENE_PATH = resolve(
  REPO_ROOT,
  'src/components/editor/graph/GraphScene.tsx',
);

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

// Extract just the CanvasTransformGizmo function body so tests don't match
// incidental references elsewhere in the (>1900-line) file. The signature
// contains TS destructuring/type-annotation braces, so we walk through the
// signature's parenthesised arg list before brace-counting the body.
function extractGizmoBlock(src: string): string {
  const startMarker = 'function CanvasTransformGizmo(';
  const startIdx = src.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error(
      "Could not find 'function CanvasTransformGizmo(' in GraphScene.tsx — " +
        'EBR2-C-02 cannot grep a function block that does not exist.',
    );
  }
  // Walk through the signature parens to find the matching ')'.
  let parenDepth = 0;
  let cursor = startIdx + startMarker.length - 1; // points at '(' of signature
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
  // After the signature, the next '{' is the function body.
  const bodyOpen = src.indexOf('{', cursor);
  if (bodyOpen === -1) throw new Error('No function-body brace after gizmo signature.');
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

describe('EBR2-C-02 — CanvasTransformGizmo gate (SC-068, haltCheck)', () => {
  it('subscribes to editorMode from useGraphEditorStore inside the gizmo', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractGizmoBlock(src);
    // The store selector pattern used elsewhere in this file is
    //   useGraphEditorStore((s) => s.<field>)
    // We require an editorMode selector somewhere inside the function body.
    expect(block).toMatch(/useGraphEditorStore\s*\(\s*\(?\s*s\s*\)?\s*=>\s*s\.editorMode\b/);
  });

  it("derives an isEditMode predicate (editorMode === 'edit')", () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractGizmoBlock(src);
    // Either an explicit isEditMode boolean or an inline editorMode === 'edit'
    // check inside the early-return guard. Require at least one occurrence.
    expect(block).toMatch(/editorMode\s*===\s*['"]edit['"]/);
  });

  it("the early-return guard includes the editorMode === 'edit' clause", () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractGizmoBlock(src);
    // The gizmo's final guard must short-circuit when editorMode is not
    // 'edit'. Accept either of the two natural shapes:
    //   if (!isCanvasMode || !isEditMode || !node) return null;
    //   if (!isCanvasMode || editorMode !== 'edit' || !node) return null;
    // (or any permutation that includes all three predicates).
    const guardRegex =
      /if\s*\([^)]*(?:!isEditMode|editorMode\s*!==\s*['"]edit['"])[^)]*\)\s*return\s+null\s*;?/;
    expect(block).toMatch(guardRegex);
  });

  it('the early-return guard still includes the viewMode === canvas clause', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractGizmoBlock(src);
    // Sanity: the prior gate (canvas + node-selected) must still be in place.
    expect(block).toMatch(
      /if\s*\([^)]*(?:!isCanvasMode|viewMode\s*!==\s*['"]canvas['"])[^)]*\)\s*return\s+null\s*;?/,
    );
    expect(block).toMatch(/if\s*\([^)]*!node[^)]*\)\s*return\s+null\s*;?/);
  });

  it('the keyboard-handler effect is gated on editorMode === edit', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractGizmoBlock(src);
    // The keydown listener registers Escape and g/r/s switches. While idle
    // the user is not interacting with the gizmo — Escape and mode keys
    // must not fire. We look for an isEditMode/edit-mode check guarding
    // the effect that calls window.addEventListener('keydown', ...).
    //
    // Heuristic: between the `useEffect` that contains
    // `window.addEventListener('keydown'` and that effect's opening brace,
    // an early-return guard or precondition must mention editorMode.
    const keyEffectIdx = block.indexOf("addEventListener('keydown'");
    expect(keyEffectIdx).toBeGreaterThan(0);
    // Walk back to find the enclosing useEffect.
    const useEffectIdx = block.lastIndexOf('useEffect', keyEffectIdx);
    expect(useEffectIdx).toBeGreaterThan(0);
    const effectBody = block.slice(useEffectIdx, keyEffectIdx);
    // Effect body must reference isEditMode or editorMode in its guard.
    expect(effectBody).toMatch(/isEditMode|editorMode/);
  });

  it("the prior-snapshot effect resets when editorMode flips to 'idle'", () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractGizmoBlock(src);
    // The effect that captures priorCanvasTransform.current at selection
    // time should also include editorMode in its early-return guard so
    // the snapshot doesn't grow stale across edit/idle toggles.
    const captureIdx = block.indexOf('priorCanvasTransform.current = readCanvasTransform');
    expect(captureIdx).toBeGreaterThan(0);
    const useEffectIdx = block.lastIndexOf('useEffect', captureIdx);
    expect(useEffectIdx).toBeGreaterThan(0);
    const effectBody = block.slice(useEffectIdx, captureIdx);
    expect(effectBody).toMatch(/isEditMode|editorMode/);
  });
});

describe('EBR2-C-02 — invariant: gizmo never mounts in idle mode', () => {
  it("contains no codepath that mounts TransformControls when editorMode === 'idle'", () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractGizmoBlock(src);
    // Negative assertion: there must not be a separate code path that
    // mounts <TransformControls> outside the post-guard return. The only
    // <TransformControls> in the gizmo body must come after the guard
    // that asserts editorMode === 'edit'.
    const guardIdx = block.search(
      /if\s*\([^)]*(?:!isEditMode|editorMode\s*!==\s*['"]edit['"])[^)]*\)\s*return\s+null\s*;?/,
    );
    expect(guardIdx).toBeGreaterThan(0);
    const transformControlsIdx = block.indexOf('<TransformControls');
    expect(transformControlsIdx).toBeGreaterThan(guardIdx);
    // And: only one occurrence (no alternate mounting site).
    const allOccurrences = block.match(/<TransformControls/g) ?? [];
    expect(allOccurrences.length).toBe(1);
  });
});
