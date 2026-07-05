// EB-05-03 — Per-node transform handles (translate/rotate/scale) in canvas mode.
//
// Spec refs:
//   §6 / Phase 5 SC-025  "Per-node transform handles render on selection:
//                         translate, rotate, scale. Edits write to
//                         `editorTransform` (Phase 8 field)."
//   §6 / Phase 8 SC-042  "Transform editing in `canvas` mode writes only to
//                         `canvasTransform` (or `editorTransform`); never to
//                         `scenePosition` (which is the renderer-migration
//                         runtime field)."
//
// haltCheck (from ralph-state.json):
//   "Selected node in canvas mode renders translate/rotate/scale gizmos;
//    dragging gizmos writes to canvasTransform (not scenePosition); cancelling
//    restores prior values; tsc + snapshot pass."
//
// Contract introduced by this task:
//
// 1. Additive schema field (INV-18): `canvasTransform?: CanvasTransform` on
//    `PrismNode`. Shape mirrors `ScenePosition` (x/y/z + rotationXYZ + scaleXYZ)
//    so the gizmo can drive every axis. Default: identity (CANVAS_TRANSFORM_IDENTITY).
//
// 2. New pure helper module: `src/lib/editor/canvas-transform-gizmo.ts`
//
//      export type CanvasTransform = {
//        x: number; y: number; z: number;
//        rotationX: number; rotationY: number; rotationZ: number;
//        scaleX: number; scaleY: number; scaleZ: number;
//      };
//      export const CANVAS_TRANSFORM_IDENTITY: Readonly<CanvasTransform>;
//      export type GizmoMode = 'translate' | 'rotate' | 'scale';
//
//      // Pure: read current canvasTransform (or identity if absent).
//      export function readCanvasTransform(node: { canvasTransform?: CanvasTransform }): CanvasTransform;
//
//      // Pure: build a fresh CanvasTransform from a live Object3D-shaped pose.
//      // SC-042: writes ONLY to canvasTransform (never scenePosition).
//      export function buildCanvasTransformFromPose(pose: {
//        position: { x: number; y: number; z: number };
//        rotation: { x: number; y: number; z: number };
//        scale: { x: number; y: number; z: number };
//      }): CanvasTransform;
//
//      // Pure: cancel-restore returns the prior snapshot so the gizmo can
//      // commit it back to the store on Escape.
//      export function restorePriorCanvasTransform(prior: CanvasTransform): CanvasTransform;
//
//      // Pure: keyboard → gizmo-mode mapping.
//      // 'g' → translate, 'r' → rotate, 's' → scale; null otherwise.
//      export function gizmoModeForKey(key: string): GizmoMode | null;
//
// 3. GraphScene.tsx wires a <CanvasTransformGizmo /> component that mounts
//    drei <TransformControls /> on the active selected node only when
//    viewMode === 'canvas' AND selectedNodeId is non-null. The component
//    MUST NOT touch `scenePosition` (FP-04 / SC-042). Cancel-on-Escape MUST
//    restore the prior canvasTransform snapshot taken at selection time.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CANVAS_TRANSFORM_IDENTITY,
  buildCanvasTransformFromPose,
  gizmoModeForKey,
  readCanvasTransform,
  restorePriorCanvasTransform,
  type CanvasTransform,
} from '../../src/lib/editor/canvas-transform-gizmo';
import type { PrismNode } from '../../src/lib/prism-graph/types';

const repoRoot = join(__dirname, '..', '..');
const graphSceneSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx'),
  'utf8',
);
const typesSrc = readFileSync(
  join(repoRoot, 'src', 'lib', 'prism-graph', 'types.ts'),
  'utf8',
);
const gizmoSrc = readFileSync(
  join(repoRoot, 'src', 'lib', 'editor', 'canvas-transform-gizmo.ts'),
  'utf8',
);

describe('EB-05-03 — schema: canvasTransform is additive on PrismNode (INV-18, SC-041)', () => {
  it('declares CanvasTransform interface in types.ts', () => {
    expect(typesSrc).toMatch(/export\s+interface\s+CanvasTransform\b/);
  });

  it('adds canvasTransform as an OPTIONAL field on PrismNode', () => {
    // The optional `?` is required — INV-18 forbids new required fields.
    expect(typesSrc).toMatch(/canvasTransform\?\s*:/);
  });

  it('does not delete or rename scenePosition (INV-18 additive only)', () => {
    expect(typesSrc).toMatch(/scenePosition\?\s*:\s*ScenePosition/);
  });

  it('lets a PrismNode satisfy the type with no canvasTransform field set', () => {
    const node: PrismNode = {
      nodeId: 'n1',
      subtype: 'card',
      parentHubId: 'hub-1',
      serviceTag: 's',
      visual: {} as never,
      intent: {} as never,
      codeRef: '',
      backendRef: null,
    };
    expect(node.canvasTransform).toBeUndefined();
  });

  it('lets a PrismNode carry an explicit canvasTransform', () => {
    const node: PrismNode = {
      nodeId: 'n2',
      subtype: 'card',
      parentHubId: 'hub-1',
      serviceTag: 's',
      visual: {} as never,
      intent: {} as never,
      codeRef: '',
      backendRef: null,
      canvasTransform: { ...CANVAS_TRANSFORM_IDENTITY, x: 1.5 },
    };
    expect(node.canvasTransform?.x).toBe(1.5);
  });
});

describe('EB-05-03 — canvas-transform-gizmo (pure helper, SC-025 + SC-042)', () => {
  it('exports a frozen identity CanvasTransform', () => {
    expect(Object.isFrozen(CANVAS_TRANSFORM_IDENTITY)).toBe(true);
    expect(CANVAS_TRANSFORM_IDENTITY).toEqual({
      x: 0, y: 0, z: 0,
      rotationX: 0, rotationY: 0, rotationZ: 0,
      scaleX: 1, scaleY: 1, scaleZ: 1,
    });
  });

  it('readCanvasTransform falls back to identity when node has no canvasTransform', () => {
    expect(readCanvasTransform({})).toEqual(CANVAS_TRANSFORM_IDENTITY);
    expect(readCanvasTransform({ canvasTransform: undefined })).toEqual(CANVAS_TRANSFORM_IDENTITY);
  });

  it('readCanvasTransform returns a STRUCTURAL CLONE (mutating the result does not alter the source)', () => {
    const source: CanvasTransform = { ...CANVAS_TRANSFORM_IDENTITY, x: 2 };
    const result = readCanvasTransform({ canvasTransform: source });
    expect(result).toEqual(source);
    result.x = 999;
    expect(source.x).toBe(2);
  });

  it('buildCanvasTransformFromPose extracts every translation, rotation, and scale axis', () => {
    const t = buildCanvasTransformFromPose({
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0.1, y: 0.2, z: 0.3 },
      scale: { x: 1.5, y: 2.5, z: 3.5 },
    });
    expect(t).toEqual({
      x: 1, y: 2, z: 3,
      rotationX: 0.1, rotationY: 0.2, rotationZ: 0.3,
      scaleX: 1.5, scaleY: 2.5, scaleZ: 3.5,
    });
  });

  it('buildCanvasTransformFromPose is deterministic (same pose → same transform)', () => {
    const pose = {
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0.1, y: 0.2, z: 0.3 },
      scale: { x: 1, y: 1, z: 1 },
    };
    expect(buildCanvasTransformFromPose(pose)).toEqual(buildCanvasTransformFromPose(pose));
  });

  it('restorePriorCanvasTransform returns a structural CLONE of the prior snapshot', () => {
    const prior: CanvasTransform = { ...CANVAS_TRANSFORM_IDENTITY, x: 7, rotationY: 0.5 };
    const restored = restorePriorCanvasTransform(prior);
    expect(restored).toEqual(prior);
    restored.x = 0;
    expect(prior.x).toBe(7);
  });

  it("gizmoModeForKey maps 'g' → translate, 'r' → rotate, 's' → scale", () => {
    expect(gizmoModeForKey('g')).toBe('translate');
    expect(gizmoModeForKey('r')).toBe('rotate');
    expect(gizmoModeForKey('s')).toBe('scale');
  });

  it('gizmoModeForKey returns null for unrelated keys', () => {
    expect(gizmoModeForKey('Escape')).toBeNull();
    expect(gizmoModeForKey('a')).toBeNull();
    expect(gizmoModeForKey('')).toBeNull();
  });
});

describe('EB-05-03 — gizmo helper does NOT touch scenePosition (FP-04 / SC-042)', () => {
  it('canvas-transform-gizmo.ts contains no scenePosition writes', () => {
    // SC-042: edits in canvas mode write only to canvasTransform.
    expect(gizmoSrc).not.toMatch(/scenePosition\s*=/);
    expect(gizmoSrc).not.toMatch(/scenePosition\.\w+\s*=/);
  });
});

describe('EB-05-03 — GraphScene wires CanvasTransformGizmo (SC-025)', () => {
  it('imports the gizmo helpers from canvas-transform-gizmo', () => {
    expect(graphSceneSrc).toMatch(/from\s+['"]@\/lib\/editor\/canvas-transform-gizmo['"]/);
  });

  it('imports TransformControls from @react-three/drei', () => {
    // SC-025 requires translate/rotate/scale gizmos. drei's TransformControls
    // is the canonical gizmo surface; the wiring component MUST import it.
    expect(graphSceneSrc).toMatch(/TransformControls/);
  });

  it('declares a CanvasTransformGizmo component for the canvas-mode overlay', () => {
    expect(graphSceneSrc).toMatch(/function\s+CanvasTransformGizmo\s*\(/);
  });

  it('mounts <CanvasTransformGizmo /> inside the assembled scene', () => {
    expect(graphSceneSrc).toMatch(/<CanvasTransformGizmo\b/);
  });

  it("gates the gizmo on viewMode === 'canvas' (FP-12: canonical literal)", () => {
    // Cheap structural check — ensure the gizmo wiring is canvas-mode-gated.
    // We look for the canonical literal somewhere in the gizmo component.
    const m = graphSceneSrc.match(
      /function\s+CanvasTransformGizmo\s*\([\s\S]*?\n\}\n/,
    );
    expect(m, 'CanvasTransformGizmo body not found').toBeTruthy();
    expect(m![0]).toMatch(/viewMode\s*===\s*['"]canvas['"]/);
  });

  it('writes the dragged pose to canvasTransform (NEVER scenePosition) — SC-042 / FP-04', () => {
    const m = graphSceneSrc.match(
      /function\s+CanvasTransformGizmo\s*\([\s\S]*?\n\}\n/,
    );
    expect(m, 'CanvasTransformGizmo body not found').toBeTruthy();
    const body = m![0];
    expect(body).toMatch(/canvasTransform/);
    // FP-04 ban: gizmo wiring must not assign to scenePosition.
    expect(body).not.toMatch(/scenePosition\s*=/);
    expect(body).not.toMatch(/scenePosition\.\w+\s*=/);
  });

  it('supports all three gizmo modes: translate, rotate, scale (SC-025)', () => {
    const m = graphSceneSrc.match(
      /function\s+CanvasTransformGizmo\s*\([\s\S]*?\n\}\n/,
    );
    expect(m, 'CanvasTransformGizmo body not found').toBeTruthy();
    const body = m![0];
    expect(body).toMatch(/['"]translate['"]/);
    expect(body).toMatch(/['"]rotate['"]/);
    expect(body).toMatch(/['"]scale['"]/);
  });

  it('captures a prior snapshot for cancel-restore (haltCheck: cancelling restores prior values)', () => {
    const m = graphSceneSrc.match(
      /function\s+CanvasTransformGizmo\s*\([\s\S]*?\n\}\n/,
    );
    expect(m, 'CanvasTransformGizmo body not found').toBeTruthy();
    const body = m![0];
    // Either the helper is called or a prior-snapshot ref is named explicitly.
    expect(body).toMatch(/restorePriorCanvasTransform|priorCanvasTransform/);
  });
});
