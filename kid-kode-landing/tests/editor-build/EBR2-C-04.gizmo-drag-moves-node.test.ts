// EBR2-C-04 — Gizmo drag visibly moves the rendered node.
//
// Spec refs:
//   §R2-C SC-069  "Dragging a transform handle in canvas mode visibly moves
//                  the node's rendered artifact in real-time
//                  (AssembledSceneNode composes scenePosition + canvasTransform
//                  for the rendered group, selection ring, and gizmo anchor)."
//   §R2-C INV-25  "The renderer is the only consumer of canvasTransform /
//                  editorTransform / scenePosition for visible node placement.
//                  Gizmo writes feed the source/preview stores; store reads
//                  drive the visual; no other coupling."
//
// haltCheck (ralph-state.json EBR2-C-04):
//   "CanvasTransformGizmo's outer group positions at scenePosition+canvas
//    Transform. Snapshot sequence: capture node position, simulate translate-
//    handle drag via Playwright, capture again — positions differ.
//    EBR2-C-04 vs EBR2-C-03 snapshot diff shows the node visibly moved."
//
// Test strategy (three layers):
//   1. SOURCE — pin the gizmo anchor group's composed-position attribute.
//      EBR2-C-03 proved AssembledSceneNode composes sp+ct; EBR2-C-04 widens
//      the obligation to the gizmo wrapper so a drag re-anchors at the new
//      composed pose on the next frame.
//   2. SOURCE — pin the additive write semantics of onObjectChange. A
//      translate drag of 0.5 in x must produce ct.x = startCT.x + 0.5
//      (additive), NOT ct.x = 0.5 (absolute proxy.position write) — the
//      latter would teleport the node back to scenePosition on every drag
//      start.
//   3. ARTIFACT — assert the EBR2-C-04 snapshot directory exists with the
//      runtime-witness files (outer.png + inner.png + state.json with a
//      `gizmoDragProof` block recording before/after positions and a
//      non-zero delta on the rendered group).

import { readFileSync, existsSync, statSync } from 'node:fs';
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

const SNAPSHOT_DIR = resolve(
  REPO_ROOT,
  'notes/ralph-snapshots/EBR2-C-04',
);

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

// Same extractor as EBR2-C-03: walks the signature's parenthesised arg list,
// then brace-counts the body.
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

describe('EBR2-C-04 — gizmo wrapper anchored at composed sp+ct (SC-069 / INV-25)', () => {
  it("CanvasTransformGizmo's anchor group attaches at scenePosition + canvasTransform", () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'CanvasTransformGizmo');
    const anchorIdx = block.indexOf('canvas:gizmo-anchor');
    expect(anchorIdx).toBeGreaterThan(0);
    const tail = block.slice(anchorIdx);
    const positionMatch = tail.match(/position\s*=\s*\{\s*\[\s*([^\]]+)\]\s*\}/);
    expect(positionMatch, 'anchor must have a position attribute').toBeTruthy();
    const inside = positionMatch![1];
    // EBR2-C-04 obligation: the gizmo anchor composes sp+ct so the
    // TransformControls handles stay attached to the visibly-rendered pose
    // (which already composes sp+ct via AssembledSceneNode). If the anchor
    // dropped back to raw `sp.x, sp.y, sp.z`, the handles would teleport to
    // scenePosition after every drag commit and visually separate from the
    // artifact.
    expect(inside).toMatch(/sp\.x\s*\+\s*ct\.x/);
    expect(inside).toMatch(/sp\.y\s*\+\s*ct\.y/);
    expect(inside).toMatch(/sp\.z\s*\+\s*ct\.z/);
  });

  it('proxy sits at parent-local identity inside the composed anchor', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'CanvasTransformGizmo');
    // The drag-from-stable-baseline pattern requires proxy.position/rotation/
    // scale to be reset to identity on each ct-write so the next drag frame
    // computes deltas from a known origin. Pin the three resets.
    expect(block).toMatch(/proxy\.position\.set\s*\(\s*0\s*,\s*0\s*,\s*0\s*\)/);
    expect(block).toMatch(/proxy\.rotation\.set\s*\(\s*0\s*,\s*0\s*,\s*0\s*\)/);
    expect(block).toMatch(/proxy\.scale\.set\s*\(\s*1\s*,\s*1\s*,\s*1\s*\)/);
  });
});

describe('EBR2-C-04 — onObjectChange writes additive ct = start + proxy delta', () => {
  it('translate writeback is additive (start.x + proxy.position.x), not absolute', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'CanvasTransformGizmo');
    // SC-069 says drag visibly moves; with the composed anchor + identity
    // proxy reset, the only safe writeback is start + delta. An absolute
    // write (`x: proxy.position.x`) would erase the prior ct on drag start,
    // teleporting the node back to scenePosition. Pin the three additive
    // assignments inside onObjectChange explicitly.
    expect(block).toMatch(/x:\s*start\.x\s*\+\s*proxy\.position\.x/);
    expect(block).toMatch(/y:\s*start\.y\s*\+\s*proxy\.position\.y/);
    expect(block).toMatch(/z:\s*start\.z\s*\+\s*proxy\.position\.z/);
  });

  it('rotation writeback is Euler-additive (start.rotationX + proxy.rotation.x)', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'CanvasTransformGizmo');
    expect(block).toMatch(
      /rotationX:\s*start\.rotationX\s*\+\s*proxy\.rotation\.x/,
    );
    expect(block).toMatch(
      /rotationY:\s*start\.rotationY\s*\+\s*proxy\.rotation\.y/,
    );
    expect(block).toMatch(
      /rotationZ:\s*start\.rotationZ\s*\+\s*proxy\.rotation\.z/,
    );
  });

  it('scale writeback is multiplicative (start.scaleX * proxy.scale.x)', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'CanvasTransformGizmo');
    expect(block).toMatch(/scaleX:\s*start\.scaleX\s*\*\s*proxy\.scale\.x/);
    expect(block).toMatch(/scaleY:\s*start\.scaleY\s*\*\s*proxy\.scale\.y/);
    expect(block).toMatch(/scaleZ:\s*start\.scaleZ\s*\*\s*proxy\.scale\.z/);
  });

  it('drag-start captures ct via onMouseDown so onObjectChange has a stable baseline', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'CanvasTransformGizmo');
    // The capture-on-mousedown / clear-on-mouseup pattern is what makes the
    // additive writeback above correct across multiple drag frames within a
    // single gesture. Without it, `start` would drift each frame.
    expect(block).toMatch(/onMouseDown\s*=\s*\{/);
    expect(block).toMatch(/dragStartCT\.current\s*=\s*readCanvasTransform\s*\(\s*node\s*\)/);
    expect(block).toMatch(/onMouseUp\s*=\s*\{/);
    expect(block).toMatch(/dragStartCT\.current\s*=\s*null/);
  });

  it('writes only canvasTransform — never scenePosition (SC-042 / FP-04)', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'CanvasTransformGizmo');
    // INV-17 + SC-042 are reaffirmed: the gizmo must never write
    // scenePosition. EBR2-C-04's writeback path goes through updateNode with
    // a `canvasTransform:` patch. The block must NOT contain any
    // `scenePosition:` field name in an updateNode call (the regex matches
    // any updateNode site that passes scenePosition as a patch key).
    expect(block).not.toMatch(
      /updateNode\s*\([^)]*\{[^}]*scenePosition\s*:/m,
    );
    // Positive: the writeback IS through canvasTransform.
    expect(block).toMatch(/updateNode\s*\([^)]*\{\s*canvasTransform\s*:\s*next\s*\}/);
  });
});

describe('EBR2-C-04 — runtime witness snapshot exists at notes/ralph-snapshots/EBR2-C-04/', () => {
  it('snapshot directory contains outer.png, inner.png, state.json, verify.log', () => {
    // The Playwright two-runtime verifier (scripts/verify-editor-runtimes.mjs)
    // is the runtime witness for SC-069. EBR2-C-04 extends the verifier with
    // a translate-write proof block that writes a synthetic ct via the source
    // store and asserts the rendered group's world position shifts by the
    // ct delta. The four artifacts below are the minimum surface; the
    // gizmoDragProof block lives inside state.json.
    expect(existsSync(SNAPSHOT_DIR), `snapshot dir missing: ${SNAPSHOT_DIR}`).toBe(true);
    for (const name of ['outer.png', 'inner.png', 'state.json', 'verify.log']) {
      const p = resolve(SNAPSHOT_DIR, name);
      expect(existsSync(p), `missing ${p}`).toBe(true);
      // Screenshot files must be non-empty (a 0-byte file would mean the
      // capture failed silently).
      if (name.endsWith('.png')) {
        expect(statSync(p).size).toBeGreaterThan(1024);
      }
    }
  });

  it('state.json carries the gizmoDragProof block with non-zero delta on x axis', () => {
    const statePath = resolve(SNAPSHOT_DIR, 'state.json');
    expect(existsSync(statePath), `state.json missing at ${statePath}`).toBe(true);
    const state = JSON.parse(read(statePath));
    expect(state.gizmoDragProof, 'state.gizmoDragProof must be present').toBeTruthy();
    const proof = state.gizmoDragProof as {
      before: { x: number; y: number; z: number } | null;
      after: { x: number; y: number; z: number } | null;
      ctDelta: { x: number; y: number; z: number } | null;
      deltaX: number | null;
      visiblyMoved: boolean | null;
      nodeId: string | null;
    };
    expect(proof.before, 'before pose must be captured').toBeTruthy();
    expect(proof.after, 'after pose must be captured').toBeTruthy();
    expect(proof.ctDelta, 'synthetic ct delta must be recorded').toBeTruthy();
    expect(proof.nodeId, 'nodeId driven by the proof must be recorded').toBeTruthy();
    expect(proof.deltaX, 'deltaX must be recorded').not.toBeNull();
    // The proof writes ct.x += 0.75 and asserts the rendered group's
    // world.x moves by approximately that amount (Three.js floating-point
    // tolerance). visiblyMoved is the boolean predicate the runtime
    // verifier sets when |deltaX - ctDelta.x| < 0.01.
    expect(proof.visiblyMoved).toBe(true);
    expect(Math.abs((proof.deltaX ?? 0) - (proof.ctDelta?.x ?? 0))).toBeLessThan(0.01);
  });
});
