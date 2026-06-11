// EBR2-C-03 — AssembledSceneNode composes scenePosition + canvasTransform.
//
// Spec refs:
//   §R2-C SC-069  "Dragging a transform handle in canvas mode visibly moves
//                  the node's rendered artifact in real-time
//                  (AssembledSceneNode composes scenePosition + canvasTransform
//                  for the rendered group, selection ring, and gizmo anchor)."
//   §R2-C SC-070  "Drei TransformControls scale mode (keyboard s) visibly
//                  resizes the node's rendered artifact via
//                  canvasTransform.scaleX/Y/Z."
//   §R2-C INV-25  "The renderer is the only consumer of canvasTransform /
//                  editorTransform / scenePosition for visible node placement.
//                  AssembledSceneNode (and any node renderer) MUST compose
//                  scenePosition + canvasTransform for its rendered group,
//                  ring, and gizmo anchor."
//
// haltCheck (ralph-state.json):
//   "AssembledSceneNode renders its artifact wrapper group at
//    scenePosition+canvasTransform.position; applies canvasTransform.rotation;
//    applies canvasTransform.scale. Selection ring follows."
//
// As amended (canvas-spec criterion 9 / SPEC-INDEX S6): the Transform tools
// now author the node's OWN scenePosition (rotation + scale included); the
// archived SC-042 routing of gizmo writes to canvasTransform is superseded.
// canvasTransform REMAINS a composable overlay per INV-25 — the renderer
// composes sp ⊕ ct for the wrapper group (translate adds, rotation adds,
// scale multiplies), and reads the COMPOSED node (source ⊕ preview overlay,
// §R2-E SC-072) so live Inspector edits render before Save.
//
// Test strategy:
//   • Source-level assertions on AssembledSceneNode in GraphScene.tsx,
//     mirroring the EBR2-C-02 grep-the-block pattern. The full Canvas mount
//     is exercised by verify-editor-runtimes (the runtime gate); these tests
//     pin the source contract that drives that runtime behaviour.
//   • Symmetric assertion on CanvasTransformGizmo's gizmo-anchor group:
//     INV-25 requires the gizmo anchor to compose scenePosition +
//     canvasTransform too, so dragging from a non-identity start does not
//     teleport the proxy back to scenePosition each frame.

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

// Extract a top-level function body by name. Walks the signature's
// parenthesised arg list (so destructuring types don't interfere), then
// brace-counts the body. Returns the function header + body inclusive.
function extractFunctionBlock(src: string, fnName: string): string {
  const startMarker = `function ${fnName}(`;
  const startIdx = src.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error(
      `Could not find 'function ${fnName}(' in source — EBR2-C-03 cannot ` +
        'grep a function block that does not exist.',
    );
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

describe('EBR2-C-03 — AssembledSceneNode composes scenePosition + canvasTransform (SC-069, INV-25)', () => {
  it('reads canvasTransform off the COMPOSED node (source ⊕ preview overlay) via the canonical helper', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'AssembledSceneNode');
    // Use the shared helper rather than inlining the read so the identity
    // default and clone semantics stay the single source of truth. Since
    // EBR2-E-02 (§R2-E SC-072) the renderer reads source ⊕ preview-overlay,
    // so the helper takes composedNode — reading the raw source node here
    // would drop live Inspector edits and is a regression.
    expect(block).toMatch(/readCanvasTransform\s*\(\s*composedNode\s*\)/);
    expect(block).not.toMatch(/readCanvasTransform\s*\(\s*node\s*\)/);
  });

  it('wraps the rendered artifact in a group at scenePosition + canvasTransform.position', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'AssembledSceneNode');
    // The composed position is sp.{x,y,z} + ct.{x,y,z}. Accept either an
    // inline computation on the <group position={...}> attribute or a local
    // const named with a clear ct/composed prefix that is then bound to the
    // position prop. We assert the literal additive expression pattern
    // somewhere within the function body so the math is auditable.
    expect(block).toMatch(/sp\.x\s*\+\s*ct\.x/);
    expect(block).toMatch(/sp\.y\s*\+\s*ct\.y/);
    expect(block).toMatch(/sp\.z\s*\+\s*ct\.z/);
  });

  it('applies rotation as the COMPOSITION sp.rotation + ct.rotation on the wrapper group', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'AssembledSceneNode');
    // Canvas-spec criterion 9 made scenePosition the authored transform the
    // gizmo writes (rotation included); canvasTransform remains a composable
    // overlay (identity unless a legacy ct-authored node carries one).
    // Dropping EITHER contribution — ct-only (the pre-SC-9 shape) or sp-only
    // (losing the legacy overlay) — fails here.
    expect(block).toMatch(
      /rotation\s*=\s*\{\s*\[\s*sp\.rotationX\s*\+\s*ct\.rotationX\s*,\s*sp\.rotationY\s*\+\s*ct\.rotationY\s*,\s*sp\.rotationZ\s*\+\s*ct\.rotationZ\s*,?\s*\]\s*\}/,
    );
  });

  it('applies scale as the COMPOSITION sp.scale * ct.scale on the wrapper group (SC-070)', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'AssembledSceneNode');
    // Scale composes multiplicatively so identity in either field is a no-op.
    expect(block).toMatch(
      /scale\s*=\s*\{\s*\[\s*sp\.scaleX\s*\*\s*ct\.scaleX\s*,\s*sp\.scaleY\s*\*\s*ct\.scaleY\s*,\s*sp\.scaleZ\s*\*\s*ct\.scaleZ\s*,?\s*\]\s*\}/,
    );
  });

  it('the selection ring sits inside the composed wrapper (selection ring follows)', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'AssembledSceneNode');
    // The selection-ring <mesh> exists in the function. With composition,
    // the ring must be placed inside the wrapper group (so its world
    // position inherits ct). Operationally: the ring's <mesh> position
    // can no longer include the raw scenePosition, because the parent
    // group already carries scenePosition + ct. Assert the ring exists
    // and that its mesh position is no longer the legacy
    // `[sp.x, sp.y, sp.z + 0.08]` pattern.
    expect(block).toMatch(/<mesh\b[^>]*>[\s\S]*?<ringGeometry/);
    // Negative: forbid the legacy position shape that double-applied
    // scenePosition on top of an already-positioned parent.
    expect(block).not.toMatch(/position\s*=\s*\{\s*\[\s*sp\.x\s*,\s*sp\.y\s*,\s*sp\.z\s*\+\s*0\.08\s*\]\s*\}/);
  });
});

describe('EBR2-C-03 — INV-25 symmetry: gizmo anchor also composes scenePosition + canvasTransform', () => {
  it("CanvasTransformGizmo's gizmo-anchor group position is composed (sp + ct), not raw scenePosition", () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'CanvasTransformGizmo');
    // INV-25 says the gizmo anchor must compose scenePosition + canvasTransform.
    // The anchor group is identified by name="canvas:gizmo-anchor:<id>".
    // Its position attribute must reference both sp.* and ct.* additively.
    const anchorIdx = block.indexOf('canvas:gizmo-anchor');
    expect(anchorIdx).toBeGreaterThan(0);
    // Walk forward to the next position= attribute on the anchor element.
    // The first position={...} after the anchor name belongs to the anchor
    // group (in current source it is `position={[sp.x, sp.y, sp.z]}`).
    const tail = block.slice(anchorIdx);
    const positionMatch = tail.match(/position\s*=\s*\{\s*\[\s*([^\]]+)\]\s*\}/);
    expect(positionMatch, 'anchor group must have a position attribute').toBeTruthy();
    const inside = positionMatch![1];
    // Composition requires additive ct contributions.
    expect(inside).toMatch(/sp\.x\s*\+\s*ct\.x/);
    expect(inside).toMatch(/sp\.y\s*\+\s*ct\.y/);
    expect(inside).toMatch(/sp\.z\s*\+\s*ct\.z/);
  });
});
