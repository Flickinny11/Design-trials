// EB-02-03 — Render App_Name_World in galaxy mode (basic geometry + click target).
//
// Spec refs:
//   §6 SC-005 — PrismRootNode type with D1 fields (already satisfied by EB-02-01).
//   §6 SC-012 — In viewMode === 'galaxy', hubs render in orbit around the
//               App_Name_World node at deterministic positions. EB-02-03 owns the
//               "App_Name_World renders as a distinct central object (the sun)"
//               slice; EB-03-01 owns the hub orbit positions.
//   §9 RA-07 — App_Name_World is a dedicated PrismRootNode (option B).
//
// haltCheck (from ralph-state.json):
//   "In viewMode='galaxy', App_Name_World renders as a distinct central object
//    (the sun); clicking it sets selectedNodeId to the root node id and
//    inspectorOpen=true; outer.png shows the central object."
//
// Source-shape strategy (matches the SHOULD-FIX-flagged pattern used by
// EB-01-04 / EB-02-02 — see those tests). The galaxy renderer lives inside the
// React Three Fiber Canvas tree, which is non-trivial to instantiate in a
// vitest node env. The renderer's runtime correctness is asserted by the
// two-runtime snapshot (kid-kode-landing/notes/ralph-snapshots/EB-02-03/).
// These assertions verify the *source contract* that makes the snapshot
// possible.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const graphSceneSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx'),
  'utf8',
);
const graphSourceStoreSrc = readFileSync(
  join(repoRoot, 'src', 'stores', 'useGraphSourceStore.ts'),
  'utf8',
);

describe('EB-02-03 — App_Name_World central sun in galaxy mode (SC-005, SC-012)', () => {
  it('useGraphSourceStore state carries a rootNodes field typed as PrismRootNode[]', () => {
    // The store must expose rootNodes so GraphScene can read the loaded
    // App_Name_World without re-parsing JSON. Additive (INV-18).
    expect(graphSourceStoreSrc).toMatch(/rootNodes\s*:\s*PrismRootNode\[\]/);
  });

  it('useGraphSourceStore.load threads rootNodes from the loaded GraphSource (SC-006)', () => {
    // The loader already populates GraphSource.rootNodes; the store must
    // forward it into set({...}). Without this the galaxy sun has no
    // appNameWorldId to bind to.
    expect(graphSourceStoreSrc).toMatch(
      /set\(\s*\{[\s\S]{0,400}?rootNodes:\s*graph\.rootNodes\s*\??\?\?\s*\[\]/,
    );
  });

  it('useGraphSourceStore.reset clears rootNodes', () => {
    expect(graphSourceStoreSrc).toMatch(
      /reset:\s*\(\)\s*=>\s*\{[\s\S]{0,400}?rootNodes:\s*\[\]/,
    );
  });

  it('GraphScene defines a WorldSun component (the central App_Name_World object)', () => {
    expect(graphSceneSrc).toMatch(/function\s+WorldSun\s*\(/);
  });

  it('WorldSun renders only when viewMode === "galaxy" (SC-012 gating)', () => {
    // The component must early-return (or be conditionally mounted) on any
    // non-galaxy mode. Source-shape: WorldSun's body contains a
    // `viewMode === 'galaxy'` predicate, and the SceneContent (or whichever
    // mount site) gates it with the same predicate so it never paints in
    // hub-world / canvas / preview-*.
    expect(graphSceneSrc).toMatch(
      /viewMode\s*===\s*['"]galaxy['"][\s\S]{0,200}?<WorldSun/,
    );
  });

  it('WorldSun click handler calls selectNode(appNameWorldId) and openInspector()', () => {
    // Sliced from the haltCheck. The click target binds the root-node id (the
    // appNameWorldId) into useGraphEditorStore.selectedNodeId, and opens the
    // inspector so the App_Name_World D1 surfaces are reachable (SC-007's
    // dedicated tab is owned by EB-02-04; this task just opens whichever tab
    // the inspector last had so the haltCheck's "inspectorOpen=true" passes).
    const worldSunBlockMatch = graphSceneSrc.match(
      /function\s+WorldSun\s*\([\s\S]*?\n\}\n/,
    );
    expect(worldSunBlockMatch).not.toBeNull();
    const block = worldSunBlockMatch![0];
    expect(block).toMatch(/selectNode\(\s*[a-zA-Z_$][\w$]*\.appNameWorldId\s*\)/);
    expect(block).toMatch(/openInspector\(/);
  });

  it('WorldSun reads its rootNode from useGraphSourceStore.rootNodes', () => {
    const block =
      graphSceneSrc.match(/function\s+WorldSun\s*\([\s\S]*?\n\}\n/)?.[0] ?? '';
    expect(block).toMatch(
      /useGraphSourceStore\(\s*\(\s*s\s*\)\s*=>\s*s\.rootNodes/,
    );
  });

  it('WorldSun is mounted inside the topology scene tree (galaxy currently routes through TopologySceneContent per RA-06)', () => {
    // page.tsx routes both galaxy + hub-world through GraphScene; GraphScene
    // routes 'scene' → AssembledSceneContent, 'topology' → TopologySceneContent.
    // Galaxy mode renders the topology path (the existing 3D constellation),
    // so the WorldSun mount lives inside the TopologySceneContent JSX tree.
    const tscMatch = graphSceneSrc.match(
      /function\s+TopologySceneContent\s*\([\s\S]*?\n\}\n/,
    );
    expect(tscMatch).not.toBeNull();
    expect(tscMatch![0]).toMatch(/<WorldSun/);
  });

  it('EB-02-03 snapshot directory contains outer.png + inner.png + state.json (post-implementation gate)', () => {
    const dir = join(repoRoot, 'notes', 'ralph-snapshots', 'EB-02-03');
    expect(existsSync(dir)).toBe(true);
    const files = readdirSync(dir);
    for (const name of ['outer.png', 'inner.png', 'state.json']) {
      expect(files).toContain(name);
    }
  });
});
