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

  it("SceneControlsBridge's CameraControls reads minDistance/maxDistance from the rail", () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'function SceneControlsBridge(');
    // We require both bounds to bind to rail.minDistance / rail.maxDistance
    // (or a destructured equivalent) — not the legacy hardcoded numbers.
    expect(block).toMatch(/minDistance\s*=\s*\{[^}]*rail[^}]*\}/);
    expect(block).toMatch(/maxDistance\s*=\s*\{[^}]*rail[^}]*\}/);
  });

  it("SceneControlsBridge's CameraControls reads minPolarAngle/maxPolarAngle from the rail", () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'function SceneControlsBridge(');
    expect(block).toMatch(/minPolarAngle\s*=\s*\{[^}]*rail[^}]*\}/);
    expect(block).toMatch(/maxPolarAngle\s*=\s*\{[^}]*rail[^}]*\}/);
  });

  it("SceneControlsBridge's CameraControls reads minAzimuthAngle/maxAzimuthAngle from the rail", () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'function SceneControlsBridge(');
    expect(block).toMatch(/minAzimuthAngle\s*=\s*\{[^}]*rail[^}]*\}/);
    expect(block).toMatch(/maxAzimuthAngle\s*=\s*\{[^}]*rail[^}]*\}/);
  });

  it('SceneControlsBridge wires panLimits into the camera-controls boundary', () => {
    const src = read(GRAPH_SCENE_PATH);
    const block = extractFunctionBlock(src, 'function SceneControlsBridge(');
    // SC-071 includes "pan-target clamps prevent drift past the frame". The
    // CameraControls API for this is .setBoundary(Box3). We require both:
    expect(block).toMatch(/setBoundary\s*\(/);
    expect(block).toMatch(/panLimits/);
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
