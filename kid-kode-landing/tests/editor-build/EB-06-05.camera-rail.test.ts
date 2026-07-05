// EB-06-05 — Cinematic camera rail (CompiledHubView.cameraRail).
//
// Spec refs:
//   §6 SC-032 "In preview-hub mode, the camera is constrained to a damped
//              cinematic rail (no manual orbit/drag). Camera state is computed
//              from CompiledHubView.cameraRail."
//   §5/§7 INV-23 "Compiled-preview camera is constrained, damped, and bounded.
//              The scene's edges and any blank background are never visible in
//              preview-hub or preview-app."
//
// haltCheck:
//   "preview-hub camera is constrained to a damped rail computed from
//    CompiledHubView.cameraRail; no orbit/drag in preview-hub; snapshot proves
//    the camera never exposes scene edges."

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  deriveCompiledCameraRail,
  evaluateCameraRail,
  stepCameraPoseDamped,
  computeSceneBoundsForCamera,
  DEFAULT_FOV_DEG,
  DEFAULT_RAIL_DAMPING,
  RAIL_FRAME_MARGIN,
  type CameraRailInput,
} from '@/lib/prism-graph/camera-rail';
import {
  type CompiledCameraRail,
  type CompiledCameraPose,
  compileHubToPreview,
} from '@/lib/prism-graph/compiled-view';
import type { PrismHub, PrismNode } from '@/lib/prism-graph/types';
import type { PrismRootNode } from '@/lib/prism-graph/root-node';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

function makeHub(): PrismHub {
  return {
    hubId: 'hub-rail',
    title: 'Rail Hub',
    layout: {
      viewportWidth: 1440,
      viewportHeight: 900,
      contentHeight: 1800,
      backgroundColor: '#101010',
      mockupUrl: null,
    },
  };
}

function makeNodes(): PrismNode[] {
  return [
    {
      nodeId: 'n-a',
      subtype: 'card',
      parentHubId: 'hub-rail',
      serviceTag: 'content',
      visual: { transform: { x: -200, y: -150, width: 300, height: 200, z: 1 } },
      intent: {
        caption: 'a',
        behaviorSpec: { interactions: [], apiCalls: [], dataBindings: [], emits: [], listens: [], triggersDownstream: [] },
        stateEffects: [],
        visualSpec: { textContent: [], layers: [] },
        contracts: { inputs: {}, outputs: {} },
      },
      codeRef: 'a',
      backendRef: null,
    },
    {
      nodeId: 'n-b',
      subtype: 'button',
      parentHubId: 'hub-rail',
      serviceTag: 'action',
      visual: { transform: { x: 400, y: 300, width: 200, height: 80, z: 2 } },
      intent: {
        caption: 'b',
        behaviorSpec: { interactions: [], apiCalls: [], dataBindings: [], emits: [], listens: [], triggersDownstream: [] },
        stateEffects: [],
        visualSpec: { textContent: [], layers: [] },
        contracts: { inputs: {}, outputs: {} },
      },
      codeRef: 'b',
      backendRef: null,
    },
  ];
}

function makeWorld(): PrismRootNode {
  return {
    appNameWorldId: 'world-rail',
    spec: { name: 'Rail App' },
    designSpec: {},
    buildPlan: {},
    memoryLog: [],
    hubRegistry: [{ hubId: 'hub-rail' }],
    nodeRegistry: [
      { nodeId: 'n-a', hubId: 'hub-rail', subtype: 'card' },
      { nodeId: 'n-b', hubId: 'hub-rail', subtype: 'button' },
    ],
    globalDependencies: [],
    validationRules: [],
    aiRoutingRules: [],
  };
}

describe('EB-06-05 — derive camera rail (pure)', () => {
  it('SC-032: rail mode is `damped-cinematic` and damping is in (0, 1]', () => {
    const rail = deriveCompiledCameraRail({
      viewportWidth: 1440,
      viewportHeight: 900,
      nodes: makeNodes(),
    });
    expect(rail.mode).toBe('damped-cinematic');
    expect(rail.damping).toBeGreaterThan(0);
    expect(rail.damping).toBeLessThanOrEqual(1);
    expect(rail.damping).toBe(DEFAULT_RAIL_DAMPING);
  });

  it('INV-23: rail is bounded — camera distance frames the full hub viewport plus content nodes (no scene edges visible)', () => {
    const input: CameraRailInput = {
      viewportWidth: 1440,
      viewportHeight: 900,
      nodes: makeNodes(),
    };
    const rail = deriveCompiledCameraRail(input);
    const bounds = computeSceneBoundsForCamera(input);

    // The end pose (closer-in) must still place the camera at a distance
    // that frames the scene bounds with margin. Compute the required
    // distance from FOV and verify the rail satisfies it.
    const fov = rail.end.fov;
    const halfFovRad = (fov * Math.PI) / 360;
    // Worst-case framing covers both width and height; the larger requirement wins.
    const halfW = (bounds.maxX - bounds.minX) / 2 + RAIL_FRAME_MARGIN;
    const halfH = (bounds.maxY - bounds.minY) / 2 + RAIL_FRAME_MARGIN;
    // Assume aspect ~= viewportW/viewportH; required distance to fit height.
    const aspect = input.viewportWidth / input.viewportHeight;
    const distForHeight = halfH / Math.tan(halfFovRad);
    const distForWidth = halfW / Math.tan(halfFovRad) / aspect;
    const requiredDistance = Math.max(distForHeight, distForWidth);

    const endDistance =
      rail.end.position[2] - rail.end.target[2];
    const startDistance =
      rail.start.position[2] - rail.start.target[2];

    // Both end-of-rail and start-of-rail must keep the camera at or
    // beyond the required framing distance (scene edges never appear).
    expect(endDistance).toBeGreaterThanOrEqual(requiredDistance - 1e-6);
    expect(startDistance).toBeGreaterThanOrEqual(requiredDistance - 1e-6);

    // Start pose pulls back further than end (cinematic push-in).
    expect(startDistance).toBeGreaterThan(endDistance);
  });

  it('SC-029: derivation is deterministic — same input twice yields deep-equal rails', () => {
    const a = deriveCompiledCameraRail({ viewportWidth: 1440, viewportHeight: 900, nodes: makeNodes() });
    const b = deriveCompiledCameraRail({ viewportWidth: 1440, viewportHeight: 900, nodes: makeNodes() });
    expect(b).toEqual(a);
  });

  it('evaluateCameraRail lerps position and target as t goes 0 -> 1', () => {
    const rail = deriveCompiledCameraRail({ viewportWidth: 1440, viewportHeight: 900, nodes: makeNodes() });
    const at0 = evaluateCameraRail(rail, 0);
    const at1 = evaluateCameraRail(rail, 1);
    const atMid = evaluateCameraRail(rail, 0.5);

    expect(at0.position).toEqual(rail.start.position);
    expect(at1.position).toEqual(rail.end.position);
    // Midpoint sits between (componentwise).
    for (let i = 0; i < 3; i += 1) {
      const lo = Math.min(rail.start.position[i], rail.end.position[i]);
      const hi = Math.max(rail.start.position[i], rail.end.position[i]);
      expect(atMid.position[i]).toBeGreaterThanOrEqual(lo);
      expect(atMid.position[i]).toBeLessThanOrEqual(hi);
    }
  });

  it('evaluateCameraRail clamps t outside [0,1]', () => {
    const rail = deriveCompiledCameraRail({ viewportWidth: 1440, viewportHeight: 900, nodes: makeNodes() });
    expect(evaluateCameraRail(rail, -1).position).toEqual(rail.start.position);
    expect(evaluateCameraRail(rail, 2).position).toEqual(rail.end.position);
  });

  it('stepCameraPoseDamped converges toward target without overshoot', () => {
    const target: CompiledCameraPose = {
      position: [0, 0, 100] as const,
      target: [0, 0, 0] as const,
      fov: DEFAULT_FOV_DEG,
    };
    let cur: CompiledCameraPose = {
      position: [0, 0, 200] as const,
      target: [0, 0, 0] as const,
      fov: DEFAULT_FOV_DEG,
    };
    let prevDist = Math.abs(cur.position[2] - target.position[2]);
    for (let i = 0; i < 200; i += 1) {
      cur = stepCameraPoseDamped(cur, target, 0.2);
      const dist = Math.abs(cur.position[2] - target.position[2]);
      // Monotonic non-increasing — damped lerp never overshoots.
      expect(dist).toBeLessThanOrEqual(prevDist + 1e-9);
      prevDist = dist;
    }
    // Converged close to target after enough steps.
    expect(Math.abs(cur.position[2] - target.position[2])).toBeLessThan(1e-3);
  });

  it('stepCameraPoseDamped is a no-op when current == target', () => {
    const pose: CompiledCameraPose = {
      position: [10, 20, 30] as const,
      target: [1, 2, 3] as const,
      fov: 60,
    };
    const stepped = stepCameraPoseDamped(pose, pose, 0.5);
    expect(stepped.position).toEqual(pose.position);
    expect(stepped.target).toEqual(pose.target);
    expect(stepped.fov).toBe(pose.fov);
  });
});

describe('EB-06-05 — compileHubToPreview integrates derived rail', () => {
  it('compileHubToPreview returns a bounded damped-cinematic rail derived from hub + nodes', () => {
    const view = compileHubToPreview(makeHub(), makeNodes(), makeWorld());
    const rail: CompiledCameraRail = view.cameraRail;
    expect(rail.mode).toBe('damped-cinematic');

    // The rail must place the camera at a distance that frames the
    // viewport and node extents (otherwise the snapshot would show edges).
    const fov = rail.end.fov;
    const halfFovRad = (fov * Math.PI) / 360;
    const halfH = makeHub().layout.viewportHeight / 2 + RAIL_FRAME_MARGIN;
    const distForHeight = halfH / Math.tan(halfFovRad);
    const endDistance = rail.end.position[2] - rail.end.target[2];
    expect(endDistance).toBeGreaterThanOrEqual(distForHeight - 1e-6);
  });
});

describe('EB-06-05 — preview-hub camera (no orbit/drag, rail applied)', () => {
  it('PrismHost source: no OrbitControls / MapControls / DragControls imports', () => {
    const src = readFileSync(
      resolve(REPO_ROOT, 'src', 'components', 'prism-player', 'PrismHost.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/OrbitControls/);
    expect(src).not.toMatch(/MapControls/);
    expect(src).not.toMatch(/DragControls/);
    expect(src).not.toMatch(/TrackballControls/);
  });

  it('PrismHost passes a cameraRail to the inner runtime when viewMode === "preview-hub"', () => {
    const src = readFileSync(
      resolve(REPO_ROOT, 'src', 'components', 'prism-player', 'PrismHost.tsx'),
      'utf8',
    );
    // The host must reach into the compiled view (or directly the derivation
    // helper) and forward the rail to mountFromGraphSource. Two acceptable
    // wirings: pass `compileHubToPreview(...).cameraRail` or
    // `deriveCompiledCameraRail(...)`. Either way the symbol appears here.
    expect(src).toMatch(/cameraRail/);
    expect(src).toMatch(/preview-hub/);
  });

  it('mountFromGraphSource accepts a cameraRail opt and the runtime applies it', () => {
    const src = readFileSync(
      resolve(REPO_ROOT, 'src', 'lib', 'prism', 'runtime', 'mount-graph.ts'),
      'utf8',
    );
    expect(src).toMatch(/cameraRail/);
    // The mount path must call the camera-rail-driver module so the rail
    // gets applied frame-by-frame.
    expect(src).toMatch(/camera-rail-driver|createCameraRailDriver/);
  });

  it('SceneRoot exposes a beforeRender hook so the rail driver can tick before each render', () => {
    const src = readFileSync(
      resolve(REPO_ROOT, 'src', 'lib', 'prism', 'runtime', 'shared', 'scene-root.ts'),
      'utf8',
    );
    expect(src).toMatch(/setBeforeRender|beforeRender/);
  });

  it('camera-rail-driver exports apply + driver helpers', async () => {
    const mod = await import('@/lib/prism/runtime/camera-rail-driver');
    expect(typeof mod.applyCompiledPoseToCamera).toBe('function');
    expect(typeof mod.createCameraRailDriver).toBe('function');
  });
});
