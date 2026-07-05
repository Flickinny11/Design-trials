// EB-02-04 — App_Name_World inspector tab surfaces D1 fields; existing tabs preserved.
//
// Spec refs:
//   §2 SC-007 — "Clicking App_Name_World in any mode opens a dedicated
//               inspector tab surfacing the D1 fields; existing tabs preserved."
//   §4 SC-020 — "Clicking a node opens the inspector with the existing tab set
//               preserved (visual / behavior / code / animation / connections /
//               backend / history)."
//   §8 INV-18 — Additive schema growth (no rename, no delete).
//
// haltCheck (from ralph-state.json):
//   "When App_Name_World is selected, the Inspector renders a dedicated
//    'World' tab with read/write surfaces for spec/designSpec/buildPlan/
//    memoryLog/hubRegistry/nodeRegistry/globalDependencies/validationRules/
//    aiRoutingRules; existing tabs still visible."
//
// Source-shape strategy: matches the established editor-build pattern
// (EB-01-04, EB-02-02, EB-02-03). Inspector.tsx is a non-trivial React
// component reading from two Zustand stores; runtime correctness is gated by
// the two-runtime snapshot (kid-kode-landing/notes/ralph-snapshots/EB-02-04/).
// These assertions verify the *source contract* that makes the snapshot
// possible.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');
const inspectorSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'panels', 'Inspector.tsx'),
  'utf8',
);
const editorStoreSrc = readFileSync(
  join(repoRoot, 'src', 'stores', 'useGraphEditorStore.ts'),
  'utf8',
);
const graphSourceStoreSrc = readFileSync(
  join(repoRoot, 'src', 'stores', 'useGraphSourceStore.ts'),
  'utf8',
);

const D1_FIELDS = [
  'spec',
  'designSpec',
  'buildPlan',
  'memoryLog',
  'hubRegistry',
  'nodeRegistry',
  'globalDependencies',
  'validationRules',
  'aiRoutingRules',
] as const;

describe("EB-02-04 — App_Name_World 'World' inspector tab (SC-007, SC-020)", () => {
  it("InspectorTab union includes 'world' (additive — does not delete existing tabs, INV-18)", () => {
    // Existing union ships visual|behavior|code|animation|connections|backend|history.
    // EB-02-04 adds 'world' as a new alternant. Order-independent.
    expect(editorStoreSrc).toMatch(/export type InspectorTab\s*=\s*[^;]*'world'/);
    for (const existing of [
      'visual', 'behavior', 'code', 'animation', 'connections', 'backend', 'history',
    ]) {
      expect(editorStoreSrc).toMatch(
        new RegExp(`export type InspectorTab\\s*=\\s*[^;]*'${existing}'`),
      );
    }
  });

  it("useGraphSourceStore exposes updateRootNode mutator for D1 read/write surfaces", () => {
    // The haltCheck requires read/write — the inspector must be able to
    // write back to the PrismRootNode. Additive (INV-18); existing mutators
    // (addNode/updateNode/etc.) untouched.
    expect(graphSourceStoreSrc).toMatch(
      /updateRootNode\s*:\s*\([^)]*appNameWorldId[^)]*,[^)]*patch[^)]*\)\s*=>/,
    );
    // Type signature on the state interface.
    expect(graphSourceStoreSrc).toMatch(
      /updateRootNode\s*:\s*\(\s*appNameWorldId\s*:\s*string\s*,\s*patch\s*:\s*Partial<PrismRootNode>\s*\)\s*=>\s*void/,
    );
  });

  it("Inspector defines a TABS entry for 'world' and the existing 6 tabs remain present", () => {
    // Tab bar entries are declared in the TABS array. SC-020 requires the
    // existing tab set to be preserved.
    expect(inspectorSrc).toMatch(/id:\s*'world'/);
    for (const existing of ['visual', 'behavior', 'code', 'animation', 'connections', 'backend']) {
      expect(inspectorSrc).toMatch(new RegExp(`id:\\s*'${existing}'`));
    }
  });

  it("Inspector reads rootNodes from useGraphSourceStore and matches against selectedId === root.appNameWorldId", () => {
    // SC-007: clicking App_Name_World opens the dedicated tab. The Inspector
    // must therefore detect that the selected id is the root-node id, not a
    // regular PrismNode. WorldSun's click handler already calls
    // selectNode(root.appNameWorldId) (see EB-02-03).
    expect(inspectorSrc).toMatch(
      /useGraphSourceStore\(\s*\(\s*s\s*\)\s*=>\s*s\.rootNodes\s*\)/,
    );
    expect(inspectorSrc).toMatch(/\.appNameWorldId/);
  });

  it("Inspector renders the World tab content (a WorldTab component) referencing all 9 D1 fields", () => {
    // The dedicated 'World' tab body must surface every D1 field by name so
    // SC-007's "surfacing the D1 fields" predicate holds. capabilityRefs is
    // owned by EB-02-06 (not asserted here) — see ralph-state.json haltCheck.
    expect(inspectorSrc).toMatch(/function\s+WorldTab\s*\(/);
    const worldTabMatch = inspectorSrc.match(/function\s+WorldTab\s*\([\s\S]*?\n\}\n/);
    expect(worldTabMatch).not.toBeNull();
    const body = worldTabMatch![0];
    for (const field of D1_FIELDS) {
      expect(body).toMatch(new RegExp(`\\b${field}\\b`));
    }
  });

  it("WorldTab includes a read/write surface (textarea) wired through updateRootNode", () => {
    // haltCheck explicitly requires "read/write surfaces". A textarea bound
    // to onChange → updateRootNode satisfies this for the JSON-shaped D1
    // fields. Granular per-field forms are deferred to later phases; this
    // task's gate is that *some* write path exists from the World tab.
    const worldTabMatch = inspectorSrc.match(/function\s+WorldTab\s*\([\s\S]*?\n\}\n/);
    expect(worldTabMatch).not.toBeNull();
    const body = worldTabMatch![0];
    expect(body).toMatch(/<textarea/);
    expect(body).toMatch(/updateRootNode\s*\(/);
  });

  it("Inspector's main render branch handles App_Name_World selection (does not return null when selectedId === root.appNameWorldId)", () => {
    // Before EB-02-04, Inspector returned null whenever
    // editorGraph.nodes.find(...) didn't match selectedId — which is the
    // case for App_Name_World since the root lives in rootNodes, not nodes.
    // Source-shape: there must be a code path that renders the panel when
    // selectedId equals the root's appNameWorldId.
    expect(inspectorSrc).toMatch(
      /isWorldSelected|isRootSelected|selectedId\s*===\s*root\.appNameWorldId/,
    );
  });

  it("Inspector default tab on App_Name_World selection routes to 'world' (auto-switch via useEffect or initial state)", () => {
    // SC-007 says "opens a dedicated inspector tab" — the dedicated tab
    // should be the active one when App_Name_World is selected, not the
    // last-used tab from a previous PrismNode.
    expect(inspectorSrc).toMatch(/setInspectorTab\(\s*['"]world['"]\s*\)|setTab\(\s*['"]world['"]\s*\)/);
  });

  it("EB-02-04 snapshot directory contains outer.png + inner.png + state.json (post-implementation gate)", () => {
    const dir = join(repoRoot, 'notes', 'ralph-snapshots', 'EB-02-04');
    expect(existsSync(dir)).toBe(true);
    const files = readdirSync(dir);
    for (const name of ['outer.png', 'inner.png', 'state.json']) {
      expect(files).toContain(name);
    }
  });
});
