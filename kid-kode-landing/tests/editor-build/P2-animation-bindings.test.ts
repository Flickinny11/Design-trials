// P2 TOOLBAR WIRING — animationBindings PLAYBACK (canvas-spec §8.2/§8.3).
//
// Verifies the binding player (src/lib/prism/animatable/bindings.ts) end to
// end against a SYNTHETIC mounted artifact (a Group with a Mesh child — the
// same shape default-factory.ts mounts):
//
//   - a registry primitive attaches and returns a detach();
//   - the wrapped PrimitiveResult carries a real gsap timeline whose seeking
//     mutates the subject (fade-up: position.y + material opacity);
//   - Infinity-duration primitives (float) ride the FrameDriver tick path;
//   - binding.params land through the ControlSchema surface (setControl);
//   - the scroll driver scrubs by LIVE hub input (driver-dispatch wiring);
//   - INV-6: the timeline (keyframes) is identical regardless of driver;
//   - detach() restores the subject, kills the timeline, removes the player's
//     added group, and is idempotent;
//   - diagnostics-registry hygiene: detach removes ONLY this player's results;
//   - a binding naming a NONEXISTENT primitive is skipped without throwing
//     (forward-compat), as is an unmountable category (glass etc.);
//   - animationBindings round-trip through the persist payload (the exact
//     saveToServer wire shape, replicated like tests/text/textspec-roundtrip).
//
// Node env, no GPU: fade-up / float are CPU-driven transform/fade primitives.

import { describe, it, expect } from 'vitest';
import { Group, Mesh, MeshStandardMaterial, PlaneGeometry, Scene } from 'three';

import {
  attachAnimationBindings,
  BINDING_PLAYERS_KEY,
  UNMOUNTABLE_CATEGORIES,
  type AnimationBindingPlayer,
} from '@/lib/prism/animatable/bindings';
import { registerAllPrimitives } from '@/lib/prism/animatable/primitives';
import { getPrimitive, listByCategory, registerPrimitive } from '@/lib/prism/animatable/registry';
import { createDriverHub } from '@/lib/prism/runtime/shared/drivers';
import { makeNodeDrivers } from '@/lib/prism/runtime/shared/driver-dispatch';
import type { PrimitiveResult } from '@/lib/prism/runtime/shared/primitives/types';
import { loadFromHomeHub } from '@/lib/prism-graph/loader';
import type {
  AnimationBinding,
  GraphSource,
  HomeHubJson,
  PrismHub,
  PrismNode,
} from '@/lib/prism-graph/types';

registerAllPrimitives();

// ── Fixtures ────────────────────────────────────────────────────────────────

const HUB: PrismHub = {
  hubId: 'home',
  title: 'Home',
  layout: {
    viewportWidth: 1440,
    viewportHeight: 900,
    contentHeight: 2400,
    backgroundColor: '#101014',
  },
};

function makeNode(overrides: Partial<PrismNode> = {}): PrismNode {
  return {
    nodeId: 'bind-card',
    subtype: 'card',
    parentHubId: HUB.hubId,
    serviceTag: 'demo',
    visual: { transform: { x: 0, y: 0, width: 320, height: 80, z: 2 } },
    intent: {
      caption: 'binding playback card',
      behaviorSpec: {
        interactions: [],
        apiCalls: [],
        dataBindings: [],
        emits: [],
        listens: [],
        triggersDownstream: [],
      },
      stateEffects: [],
      visualSpec: { textContent: [], layers: [] },
      contracts: { inputs: {}, outputs: {} },
    },
    codeRef: 'bind-card.js',
    backendRef: null,
    renderMode: 'sprite',
    ...overrides,
  };
}

/** Synthetic mounted artifact: scene → root Group → Mesh child, the same
 *  shape the factory mounts (root is what popRef points at in GraphScene). */
function makeMounted() {
  const scene = new Scene();
  const root = new Group();
  root.name = 'artifact-root';
  const mesh = new Mesh(
    new PlaneGeometry(1, 1),
    new MeshStandardMaterial({ transparent: true, opacity: 1 }),
  );
  mesh.name = 'artifact-mesh';
  root.add(mesh);
  scene.add(root);
  return { scene, root, mesh };
}

function makeDrivers() {
  const hub = createDriverHub();
  return { hub, drivers: makeNodeDrivers(hub) };
}

function playersOf(root: Group): AnimationBindingPlayer[] {
  return (root.userData[BINDING_PLAYERS_KEY] ?? []) as AnimationBindingPlayer[];
}

const binding = (over: Partial<AnimationBinding> = {}): AnimationBinding => ({
  id: 'ab-1',
  primitive: 'fade-up',
  driver: 'time',
  ...over,
});

// ── Attach + playback ───────────────────────────────────────────────────────

describe('attachAnimationBindings — registry primitive on a mounted node', () => {
  it('attaches fade-up, returns a detach fn, and seeking the timeline mutates the subject', () => {
    const { root, mesh } = makeMounted();
    const { hub, drivers } = makeDrivers();
    const node = makeNode({ animationBindings: [binding({ driver: 'event' })] });
    const baseY = mesh.position.y;

    const detach = attachAnimationBindings({ node, root, drivers });
    expect(typeof detach).toBe('function');

    const players = playersOf(root);
    expect(players).toHaveLength(1);
    expect(players[0].primitive).toBe('fade-up');
    // Registered in the hub diagnostics registry, factory-style.
    expect(hub.getNodeResults(node.nodeId)).toHaveLength(1);

    // A real gsap timeline over the primitive's own duration.
    const tl = players[0].result.timeline;
    expect(tl.duration()).toBeGreaterThan(0);

    // Seeking mutates the subject: fade-up drives position.y (rise) and
    // material opacity (its priority channel).
    tl.progress(0.5);
    expect(mesh.position.y).not.toBe(baseY);
    const mat = mesh.material as MeshStandardMaterial;
    expect(mat.opacity).toBeGreaterThan(0);
    expect(mat.opacity).toBeLessThan(1);

    detach();
  });

  it('Infinity-duration primitives (float) ride the FrameDriver tick path', () => {
    const { root, mesh } = makeMounted();
    const { drivers } = makeDrivers();
    const node = makeNode({
      animationBindings: [binding({ primitive: 'float', driver: 'time' })],
    });
    const baseY = mesh.position.y;

    const detach = attachAnimationBindings({ node, root, drivers });
    const [player] = playersOf(root);
    expect(player.result.needsTick).toBe(true);
    expect(typeof player.result.onTick).toBe('function');

    // The master clock (SceneDriverHost ticks hub.frame per rendered frame)
    // advances the stateful primitive; here we tick it directly.
    player.result.onTick!(0.5);
    expect(mesh.position.y).not.toBe(baseY);

    detach();
    // dispose + snapshot restore: back at the authored pose.
    expect(mesh.position.y).toBeCloseTo(baseY, 6);
  });

  it('binding.params land through the ControlSchema surface (setControl)', () => {
    const { root } = makeMounted();
    const { drivers } = makeDrivers();
    const node = makeNode({
      animationBindings: [binding({ params: { rise: 2.5, duration: 2 } })],
    });

    const detach = attachAnimationBindings({ node, root, drivers });
    const [player] = playersOf(root);
    expect(player.animatable.getParams().rise).toBe(2.5);
    expect(player.animatable.getParams().duration).toBe(2);
    // The wrapped timeline spans the overridden duration.
    expect(player.result.timeline.duration()).toBe(2);
    detach();
  });

  it("the scroll driver scrubs the timeline by LIVE hub input (dispatch wiring)", () => {
    const { root, mesh } = makeMounted();
    const { hub, drivers } = makeDrivers();
    const node = makeNode({ animationBindings: [binding({ driver: 'scroll' })] });

    const detach = attachAnimationBindings({ node, root, drivers });
    // Dispatch seeds at the current progress (0) — a no-op render on a fresh
    // paused timeline, so the artifact keeps its AUTHORED look until the
    // first live scroll input arrives (no invisible nodes at rest).
    const mat = mesh.material as MeshStandardMaterial;
    expect(mat.opacity).toBe(1);

    hub.scroll.set(0.5);
    expect(mat.opacity).toBeGreaterThan(0);
    expect(mat.opacity).toBeLessThan(1);
    const yMid = mesh.position.y;

    hub.scroll.set(1);
    expect(mat.opacity).toBeCloseTo(1, 6);
    expect(mesh.position.y).not.toBe(yMid);

    detach();
  });

  it('INV-6: changing driver never mutates keyframes — identical timeline + params per driver', () => {
    const results: Array<{ duration: number; params: Record<string, unknown> }> = [];
    for (const driver of ['time', 'scroll', 'pointer', 'state', 'event'] as const) {
      const { root } = makeMounted();
      const { drivers } = makeDrivers();
      const node = makeNode({
        animationBindings: [binding({ driver, params: { rise: 1.5 } })],
      });
      const detach = attachAnimationBindings({ node, root, drivers });
      const [player] = playersOf(root);
      results.push({
        duration: player.result.timeline.duration(),
        params: player.animatable.getParams(),
      });
      detach();
    }
    for (const r of results.slice(1)) {
      expect(r.duration).toBe(results[0].duration);
      expect(r.params).toStrictEqual(results[0].params);
    }
  });

  it('stacking: multiple bindings attach in `order`, not array order', () => {
    const { root } = makeMounted();
    const { drivers } = makeDrivers();
    const node = makeNode({
      animationBindings: [
        binding({ id: 'ab-second', primitive: 'float', driver: 'time', order: 2 }),
        binding({ id: 'ab-first', primitive: 'fade-up', driver: 'time', order: 1 }),
      ],
    });
    const detach = attachAnimationBindings({ node, root, drivers });
    const players = playersOf(root);
    expect(players.map((p) => p.bindingId)).toEqual(['ab-first', 'ab-second']);
    detach();
  });
});

// ── Detach / cleanup ────────────────────────────────────────────────────────

describe('attachAnimationBindings — detach()', () => {
  it('restores the subject, removes the added group, kills the timeline, idempotent', () => {
    const { root, mesh } = makeMounted();
    const { hub, drivers } = makeDrivers();
    const node = makeNode({ animationBindings: [binding({ driver: 'scroll' })] });
    const baseY = mesh.position.y;
    const baseOpacity = (mesh.material as MeshStandardMaterial).opacity;
    const childCountBefore = root.children.length;

    const detach = attachAnimationBindings({ node, root, drivers });
    // The player added its owned group under the artifact root.
    expect(root.children.length).toBe(childCountBefore + 1);
    const tl = playersOf(root)[0].result.timeline;

    hub.scroll.set(0.5); // visibly mid-animation
    expect(mesh.position.y).not.toBe(baseY);

    detach();

    // No leaked children; subject subtree restored to the authored pose.
    expect(root.children.length).toBe(childCountBefore);
    expect(mesh.position.y).toBeCloseTo(baseY, 6);
    expect((mesh.material as MeshStandardMaterial).opacity).toBeCloseTo(baseOpacity, 6);
    // Diagnostics surface removed.
    expect(root.userData[BINDING_PLAYERS_KEY]).toBeUndefined();
    expect(hub.getNodeResults(node.nodeId)).toHaveLength(0);

    // Killed timeline + dead guard: further input/seeks no longer mutate.
    hub.scroll.set(1);
    tl.progress(0.75);
    expect(mesh.position.y).toBeCloseTo(baseY, 6);

    // Idempotent.
    expect(() => detach()).not.toThrow();
  });

  it('preserves OTHER (factory) results in the hub diagnostics registry', () => {
    const { root } = makeMounted();
    const { hub, drivers } = makeDrivers();
    const node = makeNode({ animationBindings: [binding()] });

    // Simulate the factory's own STEP7 registration for the same node.
    const factoryResult = {
      timeline: { kill: () => {} },
      cleanup: () => {},
    } as unknown as PrimitiveResult;
    hub.registerNodeResult(node.nodeId, factoryResult);

    const detach = attachAnimationBindings({ node, root, drivers });
    expect(hub.getNodeResults(node.nodeId)).toHaveLength(2);
    detach();
    const remaining = hub.getNodeResults(node.nodeId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toBe(factoryResult);
  });
});

// ── Forward-compat + skip policy ────────────────────────────────────────────

describe('attachAnimationBindings — skips, never crashes', () => {
  it('a binding naming a NONEXISTENT primitive is skipped without throwing', () => {
    const { root } = makeMounted();
    const { hub, drivers } = makeDrivers();
    const node = makeNode({
      animationBindings: [
        binding({ id: 'ab-ghost', primitive: 'does-not-exist-xyz' }),
        binding({ id: 'ab-real', primitive: 'float' }),
      ],
    });
    let detach: () => void = () => {};
    expect(() => {
      detach = attachAnimationBindings({ node, root, drivers });
    }).not.toThrow();
    // The real one still attached; the ghost contributed nothing.
    expect(playersOf(root)).toHaveLength(1);
    expect(playersOf(root)[0].primitive).toBe('float');
    expect(hub.getNodeResults(node.nodeId)).toHaveLength(1);
    detach();
  });

  it('unmountable categories (rig-dependent material swappers) are skipped', () => {
    const glass = listByCategory('glass')[0];
    expect(glass).toBeDefined();
    expect(UNMOUNTABLE_CATEGORIES.has('glass')).toBe(true);

    const { root } = makeMounted();
    const { drivers } = makeDrivers();
    const node = makeNode({
      animationBindings: [binding({ primitive: glass.name })],
    });
    let detach: () => void = () => {};
    expect(() => {
      detach = attachAnimationBindings({ node, root, drivers });
    }).not.toThrow();
    expect(playersOf(root)).toHaveLength(0);
    detach();
  });

  it('mountable:true overrides the category skip (texture-preserving displacement)', () => {
    // W3 expansion: displacement primitives that PRESERVE the subject's own
    // material/texture may declare `mountable: true` to run on mounted
    // artifacts despite their category being in UNMOUNTABLE_CATEGORIES.
    let seen = 0;
    registerPrimitive({
      name: '__test-mountable-displacement',
      label: 'Test Mountable',
      category: 'displacement',
      difficulty: 'easy',
      subject: 'card',
      defaultDriver: 'time',
      schema: [],
      description: 'test-only texture-preserving displacement',
      mountable: true,
      create: (target) => ({
        name: '__test-mountable-displacement',
        category: 'displacement',
        duration: () => 1,
        seek: (t: number) => {
          seen += 1;
          if (target.subject) target.subject.position.x = t;
        },
        controls: () => [],
        setControl: () => {},
        getParams: () => ({}),
        serialize: () => ({
          name: '__test-mountable-displacement',
          category: 'displacement',
          params: {},
          duration: 1,
        }),
        dispose: () => {},
      }),
    });
    expect(UNMOUNTABLE_CATEGORIES.has('displacement')).toBe(true);

    const { root } = makeMounted();
    const { drivers } = makeDrivers();
    const node = makeNode({
      animationBindings: [binding({ primitive: '__test-mountable-displacement' })],
    });
    const detach = attachAnimationBindings({ node, root, drivers });
    const players = playersOf(root);
    expect(players).toHaveLength(1);
    players[0].result.timeline.progress(0.5);
    expect(seen).toBeGreaterThan(0);
    detach();
    expect(playersOf(root)).toHaveLength(0);
  });

  it('an allowed-category primitive missing its subject is skipped (cold mount)', () => {
    // Root with NO mesh descendant: nothing representative to bind to.
    const scene = new Scene();
    const root = new Group();
    scene.add(root);
    const { drivers } = makeDrivers();
    const node = makeNode({ animationBindings: [binding()] });
    expect(() => attachAnimationBindings({ node, root, drivers })()).not.toThrow();
    expect(playersOf(root)).toHaveLength(0);
  });
});

// ── Persist round-trip (the exact saveToServer wire shape) ─────────────────

/** Mirror of saveToServer's wire payload (useGraphSourceStore.ts ~L404-420):
 *  hub-filtered nodes, `dirty` stripped, rootNodes threaded. Replicated
 *  field-for-field like tests/text/textspec-roundtrip.test.ts. */
function persistWirePayload(nodes: PrismNode[]): string {
  const graph: HomeHubJson = {
    schemaVersion: '0.1.0',
    hub: HUB,
    nodes: nodes
      .filter((n) => n.parentHubId === HUB.hubId)
      .map(({ dirty: _dirty, ...n }) => n as PrismNode),
    edges: [],
    rootNodes: [],
  };
  return JSON.stringify({ action: 'persist', graph });
}

function roundTrip(nodes: PrismNode[]): GraphSource {
  const wire = JSON.parse(persistWirePayload(nodes)) as { graph: HomeHubJson };
  return loadFromHomeHub(wire.graph);
}

describe('animationBindings round-trip through the persist payload', () => {
  const BINDINGS: AnimationBinding[] = [
    { id: 'ab-1', primitive: 'fade-up', driver: 'scroll', params: { rise: 2, duration: 1.5 }, order: 1 },
    { id: 'ab-2', primitive: 'float', driver: 'time', order: 2 },
    { id: 'ab-3', primitive: 'spin', driver: 'event' }, // no params / no order
  ];

  it('survives persist→loadFromHomeHub with deep equality (dirty stripped, only dirty)', () => {
    const node = makeNode({
      animationBindings: structuredClone(BINDINGS),
      dirty: true,
    });
    const loaded = roundTrip([node]);
    expect(loaded.nodes).toHaveLength(1);
    const back = loaded.nodes[0];
    expect(back.animationBindings).toStrictEqual(BINDINGS);
    expect(back.dirty).toBeUndefined();
    expect(back.nodeId).toBe('bind-card');
  });

  it('absent animationBindings stays absent (legacy nodes untouched)', () => {
    const back = roundTrip([makeNode()]).nodes[0];
    expect(back.animationBindings).toBeUndefined();
  });

  it('round-tripped bindings still attach and play (data → playback, end to end)', () => {
    const node = makeNode({ animationBindings: structuredClone(BINDINGS) });
    const back = roundTrip([node]).nodes[0];

    const { root, mesh } = makeMounted();
    const { drivers } = makeDrivers();
    const baseY = mesh.position.y;
    const detach = attachAnimationBindings({ node: back, root, drivers });
    const players = playersOf(root);
    // Absent `order` defaults to 0 → ab-3 (spin) sorts ahead of order 1 / 2.
    expect(players.map((p) => p.primitive)).toEqual(['spin', 'fade-up', 'float']);
    const fadeUp = players.find((p) => p.primitive === 'fade-up')!;
    // Persisted param override landed after the trip.
    expect(fadeUp.animatable.getParams().rise).toBe(2);
    // And the persisted binding actually plays.
    fadeUp.result.timeline.progress(0.5);
    expect(mesh.position.y).not.toBe(baseY);
    detach();
    expect(mesh.position.y).toBeCloseTo(baseY, 6);
  });

  it('sanity: the primitives the fixtures name exist in the registry', () => {
    for (const b of BINDINGS) {
      expect(getPrimitive(b.primitive), b.primitive).toBeDefined();
    }
  });
});
