// EB-07-03 — Scale-to-cover + env-fog edge fill (no blank scene edges).
//
// Spec refs:
//   §7  SC-038  In `preview-hub`, scene edges are never visible regardless of
//               camera position; scale-to-cover and environment/fog fill the gap.
//   §5  / §7 INV-23  Compiled-preview camera is constrained, damped, bounded;
//                     the scene's edges and any blank background are never visible
//                     in `preview-hub` or `preview-app`.
//
// haltCheck:
//   "In preview-hub, panning the camera (within rail constraints) never reveals
//    scene edges; environment/fog fill the gap; snapshot at extreme camera
//    positions shows no blank."
//
// Strategy:
//   1. Compile a CompiledHubView and assert `environmentFog` is derived from
//      hub.layout.backgroundColor (color match), with sensible near/far bounds
//      keyed off the camera rail.
//   2. mountFromGraphSource exposes `setEnvironmentFog(fog)` that installs
//      THREE.Fog with that color/near/far on `sceneRoot.scene.fog`.
//   3. setEnvironmentFog(null) clears scene.fog. unmount clears scene.fog.
//   4. Camera-locked layer is sized to cover the camera frustum at its z
//      (scale-to-cover), not a fixed magic number — proven by changing aspect
//      and observing the geometry width recompute proportionally.
//   5. Viewport-fixed layer remains sized to cover camera frustum (regression
//      already covered by EB-06-06; re-asserted here so a regression in this
//      slice surfaces as an EB-07-03 failure too).

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

import { mountFromGraphSource } from '@/lib/prism/runtime/mount-graph';
import type { NodeContext } from '@/lib/prism/runtime/shared/adapter';
import {
  compileHubToPreview,
  type CompiledHubBackgroundLayer,
} from '@/lib/prism-graph/compiled-view';
import type {
  GraphSource,
  PrismHub,
  PrismNode,
} from '@/lib/prism-graph/types';
import type { PrismRootNode } from '@/lib/prism-graph/root-node';

function ctxStub(): NodeContext {
  return {
    textureLoader: {
      loadTexture: async () => new THREE.Texture(),
    } as unknown as NodeContext['textureLoader'],
    glbLoader: {
      loadGLB: async () => ({ scene: new THREE.Group() }),
    } as unknown as NodeContext['glbLoader'],
    fontAtlas: {
      ready: false,
      load: async () => {},
      createText: () => new THREE.Group(),
      dispose: () => {},
    } as unknown as NodeContext['fontAtlas'],
    primitives: {} as NodeContext['primitives'],
    emit: () => {},
  };
}

function makeHub(backgroundColor = '#04050a'): PrismHub {
  return {
    hubId: 'home',
    title: 'Home',
    layout: {
      viewportWidth: 1280,
      viewportHeight: 720,
      contentHeight: 720,
      backgroundColor,
      mockupUrl: null,
    },
  };
}

function makeNode(id: string): PrismNode {
  return {
    nodeId: id,
    subtype: 'hero',
    parentHubId: 'home',
    serviceTag: 'static',
    visual: { transform: { x: 0, y: 0, z: 0, width: 100, height: 100 } },
    intent: {
      caption: '',
      behaviorSpec: {
        interactions: [], apiCalls: [], dataBindings: [],
        emits: [], listens: [], triggersDownstream: [],
      },
      stateEffects: [],
      visualSpec: { textContent: [], layers: [] },
      contracts: { inputs: {}, outputs: {} },
    },
    codeRef: '',
    backendRef: null,
    renderMode: 'sprite',
    depthMapUrl: null,
    meshUrl: null,
    cinematicPrimitives: [],
  };
}

function makeWorld(): PrismRootNode {
  return {
    appNameWorldId: 'world-home',
    spec: { name: 'Home App' },
    designSpec: {},
    buildPlan: {},
    memoryLog: [],
    hubRegistry: [{ hubId: 'home' }],
    nodeRegistry: [{ nodeId: 'n1', hubId: 'home', subtype: 'hero' }],
    globalDependencies: [],
    validationRules: [],
    aiRoutingRules: [],
  };
}

function baseSource(bgColor = '#04050a'): GraphSource {
  return {
    hubs: [makeHub(bgColor)],
    nodes: [makeNode('n1')],
    edges: [],
  };
}

// ---------------------------------------------------------------------------
// 1. compileHubToPreview surfaces an `environmentFog` field.
// ---------------------------------------------------------------------------

describe('EB-07-03 — compileHubToPreview surfaces environmentFog', () => {
  it('derives fog color from hub.layout.backgroundColor (#RRGGBB → numeric color)', () => {
    const view = compileHubToPreview(makeHub('#10203a'), [makeNode('n1')], makeWorld());
    expect(view.environmentFog).toBeDefined();
    // Hex parse: #10203a → 0x10203a
    expect(view.environmentFog!.color).toBe(0x10203a);
  });

  it('falls back to a sensible default fog color when hub.layout.backgroundColor is absent', () => {
    const hub: PrismHub = {
      ...makeHub(),
      layout: { ...makeHub().layout, backgroundColor: undefined as unknown as string },
    };
    const view = compileHubToPreview(hub, [makeNode('n1')], makeWorld());
    expect(view.environmentFog).toBeDefined();
    // Default chosen so a missing backgroundColor still fills edges (not pure
    // black, which would be indistinguishable from "blank" in the snapshot).
    expect(typeof view.environmentFog!.color).toBe('number');
  });

  it('produces fog near/far that bracket the camera rail end-pose distance', () => {
    const view = compileHubToPreview(makeHub(), [makeNode('n1')], makeWorld());
    const rail = view.cameraRail;
    const endZ = rail.end.position[2];
    const targetZ = rail.end.target[2];
    const endDist = Math.abs(endZ - targetZ);
    expect(view.environmentFog!.near).toBeGreaterThan(0);
    expect(view.environmentFog!.far).toBeGreaterThan(view.environmentFog!.near);
    // Far MUST extend past the end-pose distance so geometry at the framing
    // distance is still visible (not fully fogged out).
    expect(view.environmentFog!.far).toBeGreaterThanOrEqual(endDist);
  });

  it('is deeply frozen (SC-028)', () => {
    const view = compileHubToPreview(makeHub(), [makeNode('n1')], makeWorld());
    expect(Object.isFrozen(view.environmentFog!)).toBe(true);
  });

  it('is included in the canonical hash so changes invalidate the hash', () => {
    const a = compileHubToPreview(makeHub('#101010'), [makeNode('n1')], makeWorld());
    const b = compileHubToPreview(makeHub('#202020'), [makeNode('n1')], makeWorld());
    expect(a.hash).not.toBe(b.hash);
  });
});

// ---------------------------------------------------------------------------
// 2. Renderer applies environment fog via setEnvironmentFog().
// ---------------------------------------------------------------------------

describe('EB-07-03 — renderer applies environment fog', () => {
  it('mountFromGraphSource exposes setEnvironmentFog', async () => {
    const result = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
    });
    expect(typeof result.setEnvironmentFog).toBe('function');
    result.unmount();
  });

  it('setEnvironmentFog installs THREE.Fog on scene.fog with matching color/near/far', async () => {
    const result = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
    });
    expect(result.sceneRoot.scene.fog).toBeNull();
    result.setEnvironmentFog({ color: 0x10203a, near: 100, far: 5000 });
    const fog = result.sceneRoot.scene.fog as THREE.Fog | null;
    expect(fog).not.toBeNull();
    expect(fog).toBeInstanceOf(THREE.Fog);
    expect(fog!.color.getHex()).toBe(0x10203a);
    expect(fog!.near).toBe(100);
    expect(fog!.far).toBe(5000);
    result.unmount();
  });

  it('setEnvironmentFog(null) clears scene.fog', async () => {
    const result = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
    });
    result.setEnvironmentFog({ color: 0x111111, near: 10, far: 100 });
    expect(result.sceneRoot.scene.fog).not.toBeNull();
    result.setEnvironmentFog(null);
    expect(result.sceneRoot.scene.fog).toBeNull();
    result.unmount();
  });

  it('unmount clears scene.fog (no leak across remounts)', async () => {
    const result = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
    });
    result.setEnvironmentFog({ color: 0x111111, near: 10, far: 100 });
    expect(result.sceneRoot.scene.fog).not.toBeNull();
    result.unmount();
    expect(result.sceneRoot.scene.fog).toBeNull();
  });

  it('replacing fog updates color/near/far in place (no leftover Fog object)', async () => {
    const result = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
    });
    result.setEnvironmentFog({ color: 0x111111, near: 10, far: 100 });
    result.setEnvironmentFog({ color: 0x222222, near: 50, far: 500 });
    const fog = result.sceneRoot.scene.fog as THREE.Fog | null;
    expect(fog).not.toBeNull();
    expect(fog!.color.getHex()).toBe(0x222222);
    expect(fog!.near).toBe(50);
    expect(fog!.far).toBe(500);
    result.unmount();
  });
});

// ---------------------------------------------------------------------------
// 3. Camera-locked scale-to-cover (FOV + aspect aware).
// ---------------------------------------------------------------------------

describe('EB-07-03 — camera-locked layer is sized scale-to-cover the camera frustum', () => {
  it('camera-locked plane width is proportional to camera aspect (covers viewport)', async () => {
    // Mount once at default (800x600 → aspect 4/3) and capture the geometry
    // width. Then mount at a wide aspect (1600x600 → aspect 8/3) and verify
    // the width grows proportionally — proving "scale-to-cover" and not a
    // fixed magic number.
    const a = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
      width: 800,
      height: 600,
    });
    a.setBackgroundLayers([
      Object.freeze({
        id: 'h', attachment: 'camera-locked' as const,
        sourceUrl: null, z: -200, opacity: 1,
      } as CompiledHubBackgroundLayer),
    ]);
    const hudA = a.sceneRoot.camera.children.find(
      (c) => c.userData?.role === 'camera-locked-background',
    ) as THREE.Mesh;
    const widthA = (hudA.geometry as THREE.PlaneGeometry).parameters.width;
    const heightA = (hudA.geometry as THREE.PlaneGeometry).parameters.height;

    const b = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
      width: 1600,
      height: 600,
    });
    b.setBackgroundLayers([
      Object.freeze({
        id: 'h', attachment: 'camera-locked' as const,
        sourceUrl: null, z: -200, opacity: 1,
      } as CompiledHubBackgroundLayer),
    ]);
    const hudB = b.sceneRoot.camera.children.find(
      (c) => c.userData?.role === 'camera-locked-background',
    ) as THREE.Mesh;
    const widthB = (hudB.geometry as THREE.PlaneGeometry).parameters.width;
    const heightB = (hudB.geometry as THREE.PlaneGeometry).parameters.height;

    // Same height (same FOV + same |z|), wider aspect → wider width.
    expect(Math.abs(heightA - heightB)).toBeLessThan(0.5);
    expect(widthB).toBeGreaterThan(widthA * 1.5);
    a.unmount();
    b.unmount();
  });

  it('camera-locked plane covers the camera frustum at its z (height = 2*|z|*tan(fov/2))', async () => {
    const result = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
      width: 800,
      height: 600,
    });
    const layer: CompiledHubBackgroundLayer = Object.freeze({
      id: 'h', attachment: 'camera-locked',
      sourceUrl: null, z: -300, opacity: 1,
    });
    result.setBackgroundLayers([layer]);
    const hud = result.sceneRoot.camera.children.find(
      (c) => c.userData?.role === 'camera-locked-background',
    ) as THREE.Mesh;
    const geo = hud.geometry as THREE.PlaneGeometry;
    const halfFov = (result.sceneRoot.camera.fov * Math.PI) / 360;
    const expectedHeight = 2 * 300 * Math.tan(halfFov);
    // Allow a small overscan factor; height MUST be >= the exact frustum
    // height so panning never reveals an edge.
    expect(geo.parameters.height).toBeGreaterThanOrEqual(expectedHeight * 0.999);
    result.unmount();
  });
});

// ---------------------------------------------------------------------------
// 4. Viewport-fixed scale-to-cover (regression carry-over from EB-06-06).
// ---------------------------------------------------------------------------

describe('EB-07-03 — viewport-fixed regression: still scale-to-cover', () => {
  it('viewport-fixed plane width grows with aspect', async () => {
    const a = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
      width: 800, height: 600,
    });
    a.setBackgroundLayers([
      Object.freeze({
        id: 'v', attachment: 'viewport-fixed' as const,
        sourceUrl: null, z: 0, opacity: 1,
      } as CompiledHubBackgroundLayer),
    ]);
    const fa = a.sceneRoot.camera.children.find(
      (c) => c.userData?.role === 'viewport-fixed-background',
    ) as THREE.Mesh;
    const widthA = (fa.geometry as THREE.PlaneGeometry).parameters.width;

    const b = await mountFromGraphSource(undefined, baseSource(), ctxStub(), {
      noRenderer: true,
      width: 1600, height: 600,
    });
    b.setBackgroundLayers([
      Object.freeze({
        id: 'v', attachment: 'viewport-fixed' as const,
        sourceUrl: null, z: 0, opacity: 1,
      } as CompiledHubBackgroundLayer),
    ]);
    const fb = b.sceneRoot.camera.children.find(
      (c) => c.userData?.role === 'viewport-fixed-background',
    ) as THREE.Mesh;
    const widthB = (fb.geometry as THREE.PlaneGeometry).parameters.width;

    expect(widthB).toBeGreaterThan(widthA * 1.5);
    a.unmount();
    b.unmount();
  });
});
