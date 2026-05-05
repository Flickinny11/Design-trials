// T07 unit — buildVisualSpecSliders contract.
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §13 L477 — "sliders bound to
// visualSpec fields"; §5 (render modes) determines which sliders apply.
// halt-check (ralph-state.json T07): "Visual tab renders 5+ node types
// live via R3F sub-canvas. Slider feedback under 100ms. Save & Verify
// integrates with regen API."

import { describe, expect, it } from 'vitest';
import { buildVisualSpecSliders } from '@/lib/prism-graph/visual-spec-sliders';
import type { PrismNode } from '@/lib/prism-graph/types';

function baseNode(over: Partial<PrismNode> & { nodeId: string }): PrismNode {
  return {
    nodeId: over.nodeId,
    subtype: 'card',
    parentHubId: 'home',
    serviceTag: 'demo',
    visual: { sourceAsset: 'a.png', transform: { x: 0, y: 0, width: 100, height: 100, z: 0 }, alpha: 1 },
    intent: {
      caption: 'x',
      behaviorSpec: { interactions: [], apiCalls: [], dataBindings: [], emits: [], listens: [], triggersDownstream: [] },
      stateEffects: [],
      visualSpec: { textContent: [], layers: [] },
      contracts: { inputs: {}, outputs: {} },
    },
    codeRef: 'x.js',
    backendRef: null,
    renderMode: 'sprite',
    depthMapUrl: null,
    meshUrl: null,
    cinematicPrimitives: [],
    scenePosition: { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
    ...over,
  };
}

describe('T07 buildVisualSpecSliders', () => {
  it('returns at least 5 sliders for any node (covers transform + visual)', () => {
    const sliders = buildVisualSpecSliders(baseNode({ nodeId: 'a' }));
    expect(sliders.length).toBeGreaterThanOrEqual(5);
  });

  it('every slider has a unique key', () => {
    const sliders = buildVisualSpecSliders(baseNode({ nodeId: 'a' }));
    const keys = sliders.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every slider has a sane bounded range', () => {
    const sliders = buildVisualSpecSliders(baseNode({ nodeId: 'a' }));
    for (const s of sliders) {
      expect(s.max).toBeGreaterThan(s.min);
      expect(s.value).toBeGreaterThanOrEqual(s.min);
      expect(s.value).toBeLessThanOrEqual(s.max);
      expect(s.step).toBeGreaterThan(0);
    }
  });

  it('includes pos.x, pos.y, pos.z, rot.y, scale, alpha for every render mode', () => {
    const required = ['pos.x', 'pos.y', 'pos.z', 'rot.y', 'scale.uniform', 'visual.alpha'];
    for (const mode of ['sprite', 'plane', 'parallax-plane', 'mesh'] as const) {
      const sliders = buildVisualSpecSliders(baseNode({ nodeId: 'a', renderMode: mode }));
      const keys = sliders.map((s) => s.key);
      for (const r of required) expect(keys).toContain(r);
    }
  });

  it('parallax-plane adds a depth-related slider', () => {
    const sliders = buildVisualSpecSliders(
      baseNode({ nodeId: 'a', renderMode: 'parallax-plane', depthMapUrl: 'd.png' }),
    );
    const keys = sliders.map((s) => s.key.toLowerCase());
    expect(keys.some((k) => k.includes('depth') || k.includes('displ'))).toBe(true);
  });

  it('mesh adds a mesh-rotation slider', () => {
    const sliders = buildVisualSpecSliders(
      baseNode({ nodeId: 'a', renderMode: 'mesh', meshUrl: 'm.glb' }),
    );
    const keys = sliders.map((s) => s.key.toLowerCase());
    expect(keys.some((k) => k.includes('mesh') || k.includes('rot'))).toBe(true);
  });

  it('uses scenePosition.x as initial value of pos.x slider', () => {
    const sliders = buildVisualSpecSliders(
      baseNode({
        nodeId: 'a',
        scenePosition: { x: 1.5, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
      }),
    );
    const posX = sliders.find((s) => s.key === 'pos.x');
    expect(posX?.value).toBe(1.5);
  });

  it('uses visual.alpha as initial value of alpha slider', () => {
    const sliders = buildVisualSpecSliders(
      baseNode({ nodeId: 'a', visual: { sourceAsset: 'a.png', transform: { x: 0, y: 0, width: 100, height: 100, z: 0 }, alpha: 0.4 } }),
    );
    const alpha = sliders.find((s) => s.key === 'visual.alpha');
    expect(alpha?.value).toBe(0.4);
  });

  it('groups sliders by transform / visual / render-mode', () => {
    const sliders = buildVisualSpecSliders(baseNode({ nodeId: 'a', renderMode: 'mesh', meshUrl: 'm.glb' }));
    const groups = new Set(sliders.map((s) => s.group));
    expect(groups.has('transform')).toBe(true);
    expect(groups.has('visual')).toBe(true);
    expect(groups.has('render-mode')).toBe(true);
  });
});
