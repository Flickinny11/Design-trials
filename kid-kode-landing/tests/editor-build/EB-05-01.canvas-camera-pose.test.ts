// EB-05-01 — Canvas mode deterministic center/face camera pose.
//
// Spec refs:
//   §5 SC-022  "In `canvas` mode, the camera centers and faces the active hub
//               at a deterministic pose; pose is checkpointed in
//               `useGraphEditorStore`."
//   §5 SC-024  "3D depth is preserved (nodes retain their `scenePosition.z`);
//               canvas is not a flat 2D projection."
//   §1 INV-20  Selection survives mode transitions; per-mode camera pose is
//               checkpointed and restorable.
//
// haltCheck:
//   "Entering canvas mode positions camera at a deterministic pose centered on
//    active hub; pose is checkpointed in useGraphEditorStore; 3D depth
//    preserved (z values not flattened)."
//
// Contract introduced by this task (additive helper):
//
//   - New module: src/lib/editor/canvas-camera.ts
//       export type HubCenter = { x: number; y: number; z: number };
//       export const CANVAS_CAMERA_STANDOFF: Readonly<{x:number;y:number;z:number}>;
//       export function computeCanvasCameraPose(hubCenter: HubCenter): CameraPose;
//
//     Pure: same hubCenter → identical CameraPose every call.
//     target == hubCenter (camera FACES the active hub).
//     position is hubCenter translated by CANVAS_CAMERA_STANDOFF
//     (camera CENTERS on the hub in x/y; standoff in +z preserves 3D depth).
//
//   - GraphScene's canvas-mode controls bridge (the AssembledSceneContent
//     branch) MUST import this helper and MUST call
//     checkpointCameraPose('canvas', pose) when the camera is positioned for
//     canvas mode (SC-022 "pose is checkpointed").
//
// The pure helper test exercises the math directly; a source-level grep on
// GraphScene.tsx asserts the controls bridge is wired to both the helper and
// the store action. The pure-function tests are the primary regression; the
// source grep catches accidental removal of the wiring during later refactors.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  computeCanvasCameraPose,
  CANVAS_CAMERA_STANDOFF,
  type HubCenter,
} from '../../src/lib/editor/canvas-camera';

const repoRoot = join(__dirname, '..', '..');
const graphSceneSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx'),
  'utf8',
);

describe('EB-05-01 — computeCanvasCameraPose (pure helper, SC-022 / SC-024)', () => {
  const HUB: HubCenter = { x: 12, y: -5, z: 3 };

  it('targets the active hub center exactly (camera faces the hub)', () => {
    const pose = computeCanvasCameraPose(HUB);
    expect(pose.target).toEqual(HUB);
  });

  it('centers the camera on the active hub (position.x/y match hub.x/y)', () => {
    const pose = computeCanvasCameraPose(HUB);
    expect(pose.position.x).toBe(HUB.x);
    expect(pose.position.y).toBe(HUB.y);
  });

  it('preserves 3D depth — position.z is offset from target.z, not flat (SC-024)', () => {
    const pose = computeCanvasCameraPose(HUB);
    expect(pose.position.z).toBeGreaterThan(pose.target.z);
    expect(pose.position.z - pose.target.z).toBe(CANVAS_CAMERA_STANDOFF.z);
  });

  it('is deterministic — same hub center yields an identical pose every call', () => {
    const a = computeCanvasCameraPose(HUB);
    const b = computeCanvasCameraPose({ ...HUB });
    expect(a).toEqual(b);
  });

  it('translates by the same offset for distinct hub centers (no global state)', () => {
    const h1: HubCenter = { x: 0, y: 0, z: 0 };
    const h2: HubCenter = { x: 100, y: -40, z: 7 };
    const p1 = computeCanvasCameraPose(h1);
    const p2 = computeCanvasCameraPose(h2);
    expect(p1.position.x - p1.target.x).toBe(p2.position.x - p2.target.x);
    expect(p1.position.y - p1.target.y).toBe(p2.position.y - p2.target.y);
    expect(p1.position.z - p1.target.z).toBe(p2.position.z - p2.target.z);
  });

  it('exports a frozen, non-zero CANVAS_CAMERA_STANDOFF on the +z axis', () => {
    expect(Object.isFrozen(CANVAS_CAMERA_STANDOFF)).toBe(true);
    expect(CANVAS_CAMERA_STANDOFF.z).toBeGreaterThan(0);
    expect(CANVAS_CAMERA_STANDOFF.x).toBe(0);
    expect(CANVAS_CAMERA_STANDOFF.y).toBe(0);
  });

  it('does not mutate its input HubCenter (pure function, no aliasing)', () => {
    const input: HubCenter = { x: 1, y: 2, z: 3 };
    const snapshot = { ...input };
    computeCanvasCameraPose(input);
    expect(input).toEqual(snapshot);
  });
});

describe('EB-05-01 — GraphScene wires canvas-mode pose to the store (SC-022, INV-20)', () => {
  it('imports computeCanvasCameraPose from the canvas-camera helper', () => {
    expect(graphSceneSrc).toMatch(/computeCanvasCameraPose/);
  });

  it("checkpoints the canvas pose into useGraphEditorStore via checkpointCameraPose('canvas', …)", () => {
    expect(graphSceneSrc).toMatch(/checkpointCameraPose\(\s*['"]canvas['"]/);
  });
});
