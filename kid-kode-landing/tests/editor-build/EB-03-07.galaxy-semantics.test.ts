// EB-03-07 — Galaxy semantic overview.
//
// Hubs are app pages and Galaxy nodes are user-meaningful app elements. The
// runtime graph can still contain repeated app shell fragments and invisible
// hit targets for Canvas/Preview, but Galaxy overview must collapse those
// implementation details.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  countGalaxyProjectedNodesForHub,
  countGalaxyOverviewNodesForHub,
  filterEdgesToGalaxyOverview,
  getGalaxyNodeRole,
  getGalaxyOverviewNodes,
  getGalaxyOverviewProjection,
  summarizeGalaxySemantics,
} from '../../src/lib/prism-graph/galaxy-semantics';
import { toEditorView } from '../../src/lib/prism-graph/view-model';

const repoRoot = join(__dirname, '..', '..');
const graphSceneSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx'),
  'utf8',
);
const hubNavSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'overlays', 'HubNav.tsx'),
  'utf8',
);
const minimapSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'overlays', 'Minimap.tsx'),
  'utf8',
);
const liveGraph = JSON.parse(readFileSync(
  join(repoRoot, 'public', 'prism-mock', 'home', 'live-graph.json'),
  'utf8',
));

describe('EB-03-07 — Galaxy semantic overview', () => {
  it('classifies content, app shell, hit targets, global overlays, and hub-owned ambience', () => {
    expect(getGalaxyNodeRole({ id: 'hero-watch', subtype: 'product-hero', hubIds: ['s1'] })).toBe('content');
    expect(getGalaxyNodeRole({ id: 'shell-header-s1', subtype: 'app-header', hubIds: ['s1'] })).toBe('app-shell');
    expect(getGalaxyNodeRole({ id: 'shell-nav-s1-hit', subtype: 'nav-hit', hubIds: ['s1'] })).toBe('hit-target');
    expect(getGalaxyNodeRole({ id: 'overlay-spec-card', isGlobalElement: true })).toBe('global-overlay');
    expect(getGalaxyNodeRole({ id: 'brass-nebula-motes', subtype: 'particle-field', hubIds: ['s1'] })).toBe('ambient-background');
  });

  it('returns only meaningful overview nodes and filters edges to the same set', () => {
    const nodes = [
      { id: 'hero-watch', subtype: 'product-hero', hubIds: ['s1'] },
      { id: 'shell-header-s1', subtype: 'app-header', hubIds: ['s1'] },
      { id: 'shell-nav-hit-s1', subtype: 'nav-hit', hubIds: ['s1'] },
    ];
    const overview = getGalaxyOverviewNodes(nodes);
    expect(overview.map((node) => node.id)).toEqual(['hero-watch']);
    expect(countGalaxyOverviewNodesForHub(nodes, 's1')).toBe(1);
    expect(filterEdgesToGalaxyOverview([
      { source: 'hero-watch', target: 'shell-header-s1' },
      { source: 'hero-watch', target: 'hero-watch' },
    ], new Set(overview.map((node) => node.id)))).toEqual([
      { source: 'hero-watch', target: 'hero-watch' },
    ]);
  });

  it('collapses the current mock app shell and hit-target noise without deleting graph nodes', () => {
    const summary = summarizeGalaxySemantics(liveGraph.nodes.map((node: any) => ({
      id: node.nodeId,
      subtype: node.subtype,
      parentHubId: node.parentHubId,
      isGlobalElement: node.isGlobalElement,
      globalSlot: node.globalSlot,
    })));

    expect(summary.total).toBeGreaterThan(300);
    expect(summary.overview).toBeLessThan(summary.total);
    expect(summary.byRole['app-shell']).toBeGreaterThan(0);
    expect(summary.byRole['hit-target']).toBeGreaterThan(0);
    expect(summary.byRole['ambient-background']).toBe(0);
  });

  it('projects dense page atoms into first-level component clusters', () => {
    const editorGraph = toEditorView(liveGraph);
    const rawOverview = getGalaxyOverviewNodes(editorGraph.nodes);
    const projection = getGalaxyOverviewProjection(editorGraph.nodes);
    const clusters = projection.filter((node) => node.isGalaxyCluster);

    expect(rawOverview).toHaveLength(148);
    expect(projection.length).toBeLessThan(rawOverview.length);
    expect(projection.length).toBeLessThanOrEqual(64);
    expect(countGalaxyOverviewNodesForHub(editorGraph.nodes, 's6-atelier')).toBe(73);
    expect(countGalaxyProjectedNodesForHub(editorGraph.nodes, 's6-atelier')).toBeLessThanOrEqual(18);
    expect(countGalaxyProjectedNodesForHub(editorGraph.nodes, 's3-materia')).toBeLessThanOrEqual(12);
    expect(clusters.map((node) => node.galaxyClusterKind)).toEqual(expect.arrayContaining([
      'atelier-options',
      'material-card',
      'cta',
      'support-layers',
    ]));
    expect(clusters.every((node) => (node.clusterNodeIds?.length ?? 0) > 0)).toBe(true);
  });

  it('wires the policy into GraphScene, HubNav, and Minimap', () => {
    expect(graphSceneSrc).toMatch(/getGalaxyOverviewProjection/);
    expect(graphSceneSrc).toMatch(/filterEdgesToGalaxyOverview/);
    expect(graphSceneSrc).toMatch(/__PRISM_GALAXY_SEMANTICS__/);
    expect(graphSceneSrc).toMatch(/showGalaxyBadges/);
    expect(graphSceneSrc).toMatch(/viewMode === 'galaxy' && showGalaxyBadges/);
    expect(hubNavSrc).toMatch(/countGalaxyProjectedNodesForHub/);
    expect(minimapSrc).toMatch(/getGalaxyOverviewProjection/);
  });
});
