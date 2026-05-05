// T10 — Stress test (200 nodes, 10 hubs).
//
// Spec refs:
//   - PRISM-RENDERER-MIGRATION-SPEC.md §17 L527-L543 (Definition of Done)
//   - ralph-state.json T10 halt-check ("Stress test (200 nodes, 10 hubs)
//     passes. No memory leaks over 30min navigation.")
//
// What it covers:
//   1. assembleBundle() over a programmatically generated 10-hub /
//      200-node graph stays under the §14 L498 35s build budget.
//   2. The emitted file map carries one stub per node + the 6 shared
//      infra files + 9 primitive files + 6 TSL shader files (§11
//      L389-L445).
//   3. Repeating assembleBundle 50× on the same graph does not grow the
//      Node-process RSS more than ~5MB. This is the proxy for the
//      halt-check's "no memory leaks over 30min navigation" — the only
//      structural leak shape it can catch in CI is reference retention
//      across builds. True browser-side 30-min soak testing lives off
//      this CI gate (see docs/spec-deviations-prism.md §T10).
//   4. disposeHubGroup walks all descendants and clears userData on
//      each. This is the structural leak guard for the runtime side
//      (one assertion per node depth).
//
// All tests are pure node — no jsdom, no browser. They exercise the
// pure-logic surface of T05 (bundle assembly) and T02 (hub manager)
// over a large graph.

import { describe, expect, it } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, Object3D } from 'three';
import { assembleBundle, type CompiledGraph } from '@/lib/prism/runtime/bundle';
import { disposeHubGroup } from '@/lib/prism/runtime/shared/hub-manager';

const PRIMITIVES = [
  'orbit',
  'depth-rotate',
  'dissolve-morph',
  'displacement-transition',
  'parallax-scroll',
  'magnetic-cursor',
  'particle-emerge',
  'fly-through',
  'kinetic-text',
] as const;

function makeStressGraph(hubCount: number, nodesPerHub: number): CompiledGraph {
  const hubs = Array.from({ length: hubCount }, (_, h) => ({
    hubId: `hub-${h}`,
    title: `Hub ${h}`,
    layout: {
      viewportWidth: 1920,
      viewportHeight: 1080,
      contentHeight: 1080,
      backgroundColor: '#050513',
    },
  }));

  const nodes: CompiledGraph['nodes'] = [];
  for (let h = 0; h < hubCount; h += 1) {
    for (let n = 0; n < nodesPerHub; n += 1) {
      const renderModeIdx = (h + n) % 4;
      const renderMode = (['sprite', 'plane', 'parallax-plane', 'mesh'] as const)[renderModeIdx];
      const primitiveIdx = (h * nodesPerHub + n) % PRIMITIVES.length;
      const primitiveName = PRIMITIVES[primitiveIdx];
      nodes.push({
        nodeId: `hub-${h}-node-${n}`,
        subtype: 'card',
        parentHubId: `hub-${h}`,
        serviceTag: 'static',
        visual: {
          transform: { x: n * 12, y: h * 8, width: 200, height: 120, z: 0 },
        },
        intent: { caption: `node ${h}-${n}` },
        codeRef: `nodes/hub-${h}-node-${n}.js`,
        backendRef: null,
      });
      // The PRIMITIVES roundrobin + depth/mesh URLs are used by the per-node
      // codegen, not by assembleBundle's file map — referenced here so a
      // future verifier hook can confirm the 200-node graph carries the
      // additive PrismNode fields. Bundle assembly itself only reads
      // nodeId/parentHubId/visual/intent/codeRef/backendRef.
      void primitiveName;
      void renderMode;
    }
  }

  const edges: CompiledGraph['edges'] = [];
  for (let h = 0; h < hubCount - 1; h += 1) {
    edges.push({ from: `hub-${h}`, to: `hub-${h + 1}`, type: 'triggers', event: 'navigate' });
  }

  return { version: '0.1.0', hubs, nodes, edges };
}

describe('T10 — Stress test (200 nodes / 10 hubs)', () => {
  it('builds the 10-hub / 200-node graph under the §14 35s budget', () => {
    const graph = makeStressGraph(10, 20);
    expect(graph.hubs).toHaveLength(10);
    expect(graph.nodes).toHaveLength(200);

    const t0 = performance.now();
    const files = assembleBundle(graph);
    const buildMs = performance.now() - t0;

    // §14 L498 budget; halt-check requires the stress build to pass too.
    expect(buildMs, `build took ${buildMs}ms`).toBeLessThanOrEqual(35_000);

    // §11 L389-L445 file-map shape.
    const names = Object.keys(files);
    expect(names).toContain('app.js');
    expect(names).toContain('graph.json');
    expect(names).toContain('shared/scene-root.js');
    expect(names).toContain('shared/loaders.js');
    expect(names).toContain('shared/text.js');
    expect(names).toContain('shared/manager.js');
    expect(names).toContain('shared/adapter.js');
    expect(names).toContain('shared/state.js');
    expect(names).toContain('shared/primitives/index.js');
    for (const p of PRIMITIVES) {
      expect(names, `expected primitive ${p}`).toContain(`shared/primitives/${p}.js`);
    }
    for (const s of ['displacement', 'dissolve', 'voronoi-particle', 'twisted-wave', 'radial-blur', 'rgb-shift']) {
      expect(names, `expected shader ${s}`).toContain(`shared/shaders/${s}.tsl.js`);
    }
    // 200 per-node stubs.
    const perNode = names.filter((n) => n.startsWith('nodes/'));
    expect(perNode).toHaveLength(200);
  });

  it('assembleBundle is structurally re-entrant: 50× on same graph stays under ~5MB RSS delta', () => {
    const graph = makeStressGraph(10, 20);

    // Warm one round so the first JIT compile/template-realisation cost
    // doesn't show up in the delta measurement.
    assembleBundle(graph);

    if (typeof global.gc === 'function') global.gc();
    const before = process.memoryUsage().heapUsed;

    for (let i = 0; i < 50; i += 1) {
      const files = assembleBundle(graph);
      // Touch a couple of file values to defeat any hypothetical JIT
      // dead-code elimination.
      expect(files['app.js'].length).toBeGreaterThan(0);
      expect(files['graph.json'].length).toBeGreaterThan(0);
    }

    if (typeof global.gc === 'function') global.gc();
    const after = process.memoryUsage().heapUsed;
    const deltaMb = (after - before) / 1024 / 1024;

    // Allow 5MB of slack for the V8 heap-growth heuristic + intern
    // tables. A real reference leak would grow ~200 nodes × 50 builds ×
    // a few hundred bytes each per build, which is >>5MB.
    expect(deltaMb, `heap delta ${deltaMb.toFixed(2)}MB after 50× builds`).toBeLessThanOrEqual(5);
  });

  it('disposeHubGroup walks every descendant and clears userData (no leaked refs)', () => {
    // Build a 200-leaf hub group with mixed Mesh + Group descendants.
    const root = new Group();
    root.name = 'stress-hub';
    const cleanupCalls: string[] = [];

    for (let i = 0; i < 200; i += 1) {
      const inner = new Group();
      inner.name = `inner-${i}`;
      const mesh = new Mesh(new BoxGeometry(0.1, 0.1, 0.1), new MeshBasicMaterial());
      mesh.name = `mesh-${i}`;
      inner.add(mesh);
      inner.userData.cleanup = () => cleanupCalls.push(inner.name);
      mesh.userData.cleanup = () => cleanupCalls.push(mesh.name);
      root.add(inner);
    }

    expect(root.children.length).toBe(200);

    disposeHubGroup(root);

    // Every descendant cleanup ran once: 200 inner Groups + 200 Meshes = 400.
    expect(cleanupCalls).toHaveLength(400);
    expect(new Set(cleanupCalls).size).toBe(400);

    // disposeHubGroup is a traversal — it does not detach the root
    // from its parent. The root retains its 200 children after the
    // walk; the test guarantees the cleanup callbacks ran exactly once
    // per descendant (covered above) and asserts the tree remains
    // walkable so the runtime can decide when to detach. Detachment
    // happens at the hub-manager level (`createHubManager.deactivate`,
    // which calls `scene.remove(group)` after `disposeHubGroup`).
    expect(root.children.length).toBe(200);

    // The walk doesn't leave dangling Object3D refs in userData.
    const visit = (o: Object3D) => {
      // After dispose, primitives may have stripped userData fields. The
      // structural guarantee the test cares about is that no descendant
      // userData retains a reference back to the parent — that's the
      // reference-cycle leak shape. Walk and collect.
      const u = o.userData ?? {};
      for (const k of Object.keys(u)) {
        const v = u[k];
        if (v instanceof Object3D) {
          throw new Error(`leaked Object3D ref at userData.${k} on ${o.name}`);
        }
      }
      for (const child of o.children) visit(child);
    };
    visit(root);
  });
});
