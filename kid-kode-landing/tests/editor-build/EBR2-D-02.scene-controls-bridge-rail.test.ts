// EBR2-D-02 — Apply canvas camera guardrails to SceneControlsBridge.
//
// Spec refs:
//   §R2-D SC-071  "In canvas mode, OrbitControls is constrained:
//                  minPolarAngle/maxPolarAngle/minAzimuthAngle/maxAzimuthAngle/
//                  minDistance/maxDistance are set from the active hub's content
//                  envelope + viewport-frame, and pan-target clamps prevent
//                  drift past the frame."
//
// haltCheck (ralph-state.json):
//   "SceneControlsBridge for canvas mode applies all 6 bounds from
//    computeCanvasCameraRail. Playwright sequence attempts to pan/zoom past
//    limits and asserts pose clamps (camera position stays within bounds).
//    Galaxy mode bounds unchanged (still unconstrained)."
//
// Test strategy:
//   Source-grep on GraphScene.tsx mirroring the pattern used by
//   EBR2-C-02 (gizmo edit-gate). The bridge itself mounts inside an R3F
//   Canvas, which is not trivially renderable from a unit test, so we
//   assert the wiring at the source level and let verify-editor-runtimes
//   (via notes/ralph-interactions/EBR2-D-02.json) prove the runtime
//   clamps end-to-end.
//
//   Negative assertions guard the "Galaxy mode bounds unchanged" leg of the
//   haltCheck — the topology bridge (TopologyControlsBridge, or whatever the
//   non-scene-mode bridge is named) must not import or call
//   computeCanvasCameraRail.

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

function extractFunctionBlock(src: string, signature: string): string {
  const startIdx = src.indexOf(signature);
  if (startIdx === -1) {
    throw new Error(`Could not find '${signature}' in GraphScene.tsx.`);
  }
  let parenDepth = 0;
  let cursor = startIdx + signature.length - 1; // points at '(' of signature
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
  if (bodyOpen === -1) throw new Error(`No function-body brace after '${signature}'.`);
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

describe('EBR2-D-02 — SceneControlsBridge canvas guardrails (SC-071, haltCheck)', () => {
  it('imports computeCanvasCameraRail from @/lib/editor/canvas-camera-rail', () => {
    const src = read(GRAPH_SCENE_PATH);
    expect(src).toMatch(
      /import\s*\{[^}]*\bcomputeCanvasCameraRail\b[^}]*\}\s*from\s*['"]@\/lib\/editor\/canvas-camera-rail['"]/,
    );
  });

  it('SceneControlsBridge computes a rail value via computeCanvasCameraRail', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'function SceneControlsBridge(');
    expect(block).toMatch(/computeCanvasCameraRail\s*\(/);
  });

  it('SceneControlsBridge derives the rail only in canvas mode', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'function SceneControlsBridge(');
    // The rail must be gated on viewMode === 'canvas'; otherwise the bridge
    // would constrain preview-app mode too (SC-071 is canvas-only).
    expect(block).toMatch(/viewMode\s*===\s*['"]canvas['"]/);
  });

  // ── APP-REALITY P1 — SC-071 DELIBERATELY SUPERSEDED for canvas ────────────
  // Logan-authorized override (same class as the 2026-06-14 AMENDMENT): the
  // canvas camera is now FULLY FREE (orbit/pan/zoom) so designers can edit from
  // any angle. The rail is retained ONLY to feed __PRISM_EDITOR_GET_CANVAS_RAIL__
  // (asserted below); it no longer clamps CameraControls. These assertions
  // therefore encode the NEW free-camera contract, not the old rail binding.
  it('canvas CameraControls uses FREE distance bounds (SC-071 rail superseded)', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'function SceneControlsBridge(');
    expect(block).toMatch(/minDistance\s*=\s*\{\s*1\.5\s*\}/);
    expect(block).toMatch(/maxDistance\s*=\s*\{\s*220\s*\}/);
  });

  it('canvas CameraControls uses FREE polar/azimuth (no rail clamp)', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'function SceneControlsBridge(');
    expect(block).toMatch(/minPolarAngle\s*=\s*\{\s*0\s*\}/);
    expect(block).toMatch(/maxPolarAngle\s*=\s*\{\s*Math\.PI\s*\}/);
    expect(block).toMatch(/minAzimuthAngle\s*=\s*\{\s*-Infinity\s*\}/);
    expect(block).toMatch(/maxAzimuthAngle\s*=\s*\{\s*Infinity\s*\}/);
  });

  it('preview-app LOCKS the camera via enabled={!isPreview ...} (APP-REALITY P1)', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'function SceneControlsBridge(');
    expect(block).toMatch(/enabled\s*=\s*\{\s*!isPreview/);
  });

  it('canvas pan is FREE — the rail boundary clamp is cleared (SC-071 superseded)', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'function SceneControlsBridge(');
    // The pan boundary is cleared unconditionally (free canvas).
    expect(block).toMatch(/setBoundary\s*\(\s*undefined\s*\)/);
  });

  it("SceneControlsBridge installs __PRISM_EDITOR_GET_CANVAS_CAMERA__ window hook", () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'function SceneControlsBridge(');
    // The interaction script (notes/ralph-interactions/EBR2-D-02.json)
    // asserts typeof window.__PRISM_EDITOR_GET_CANVAS_CAMERA__ === 'function'.
    expect(block).toMatch(/__PRISM_EDITOR_GET_CANVAS_CAMERA__/);
    expect(block).toMatch(/polarAngle/);
    expect(block).toMatch(/azimuthAngle/);
  });

  it("SceneControlsBridge installs __PRISM_EDITOR_GET_CANVAS_RAIL__ window hook", () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'function SceneControlsBridge(');
    expect(block).toMatch(/__PRISM_EDITOR_GET_CANVAS_RAIL__/);
  });
});

describe('EBR2-D-02 — galaxy mode unaffected (haltCheck negative leg)', () => {
  it("the galaxy/topology bridge does not import or call computeCanvasCameraRail", () => {
    const src = read(GRAPH_SCENE_PATH);
    // The non-scene bridge in this file is named ControlsBridge (it renders
    // the galaxy/topology view at the same call site as SceneControlsBridge).
    // It must not pull in canvas-rail constraints.
    const block = extractFunctionBlock(src, 'function ControlsBridge(');
    expect(block).not.toMatch(/computeCanvasCameraRail/);
    // And the galaxy bridge's CameraControls must still set its own (wide)
    // minDistance/maxDistance numerically — not via rail.
    expect(block).toMatch(/minDistance\s*=\s*\{?\s*\d+/);
    expect(block).toMatch(/maxDistance\s*=\s*\{?\s*\d+/);
  });
});
