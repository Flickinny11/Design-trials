// FINISH F-2 — mirror↔truth sync (criteria-reviewer SHOULD-FIX 1).
//
// The parity gate's LIVE mode cross-checks scripts/lib/galaxy-roles.mjs (the
// one script-side mirror) against the in-page __PRISM_GALAXY_PARITY__ probe,
// but the STATIC half wired into `npm run verify` trusts the mirror alone.
// This test closes that blind spot without a browser: it imports BOTH the
// mirror and the real src/lib/prism-graph/galaxy-semantics.ts module and
// asserts identical role classification and identical projection member sets
// over the live watch-app fixture. If someone edits one side without the
// other, this fails in the plain test run.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { roleFor, projectedNodesFor } from '../../scripts/lib/galaxy-roles.mjs';
import {
  getGalaxyNodeRole,
  getGalaxyOverviewProjection,
} from '../../src/lib/prism-graph/galaxy-semantics';
import { toEditorView } from '../../src/lib/prism-graph/view-model';

const repoRoot = join(__dirname, '..', '..');
const liveGraph = JSON.parse(readFileSync(
  join(repoRoot, 'public', 'prism-mock', 'home', 'live-graph.json'),
  'utf8',
));

describe('F2 — scripts/lib/galaxy-roles.mjs mirrors galaxy-semantics.ts exactly', () => {
  it('classifies every live-graph node into the same role as the TS module', () => {
    const mismatches: string[] = [];
    for (const node of liveGraph.nodes) {
      const mirror = roleFor(node);
      const truth = getGalaxyNodeRole({
        id: node.nodeId,
        subtype: node.subtype,
        parentHubId: node.parentHubId,
        hubIds: node.parentHubId ? [node.parentHubId] : [],
        isGlobalElement: node.isGlobalElement,
        globalSlot: node.globalSlot,
      });
      if (mirror !== truth) mismatches.push(`${node.nodeId}: mirror=${mirror} truth=${truth}`);
    }
    expect(mismatches).toEqual([]);
  });

  it('projects the same first-class element member sets as the TS module', () => {
    // Truth: the projection the app renders (editor view, global elements
    // excluded — GraphScene's galaxy scope).
    const editorGraph = toEditorView({
      ...liveGraph,
      nodes: liveGraph.nodes.filter((n: { isGlobalElement?: boolean }) => !n.isGlobalElement),
    });
    const truthMembers = new Set<string>(
      getGalaxyOverviewProjection(editorGraph.nodes).flatMap((el) =>
        el.isGalaxyCluster ? (el.clusterNodeIds ?? []) : [el.id]),
    );

    // Mirror: static-gate path (raw graph nodes, content role, clustered).
    const contentNodes = liveGraph.nodes.filter(
      (n: unknown) => roleFor(n as { nodeId?: string }) === 'content');
    const mirrorMembers = new Set<string>(
      projectedNodesFor(contentNodes).flatMap(
        (el: { clusterNodeIds?: string[]; nodeId: string }) =>
          el.clusterNodeIds ?? [el.nodeId]),
    );

    expect([...mirrorMembers].filter((id) => !truthMembers.has(id))).toEqual([]);
    expect([...truthMembers].filter((id) => !mirrorMembers.has(id))).toEqual([]);
    expect(mirrorMembers.size).toBe(truthMembers.size);

    // Same GROUPING, not just the same member union: a pure regrouping
    // divergence (minSize drift, cluster-key split) must fail too — the
    // first-level entry count is the number every count surface displays.
    expect(projectedNodesFor(contentNodes).length).toBe(
      getGalaxyOverviewProjection(editorGraph.nodes).length,
    );
  });
});
