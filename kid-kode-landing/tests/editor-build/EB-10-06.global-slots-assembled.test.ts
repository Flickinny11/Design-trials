// EB-10-06 - assembled Canvas/Preview node scope.
//
// The root editor must be able to render authored global header/footer nodes
// once across every page without replacing the existing Prism runtime path.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  getSharedChromeSignature,
  resolveAssembledNodesForHub,
} from '../../src/lib/prism-graph/assembled-nodes';
import type { PrismNode } from '../../src/lib/prism-graph/types';

const repoRoot = join(__dirname, '..', '..');
const graphSceneSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx'),
  'utf8',
);
const liveGraph = JSON.parse(readFileSync(
  join(repoRoot, 'public', 'prism-mock', 'home', 'live-graph.json'),
  'utf8',
));

function node(id: string, parentHubId: string, patch: Partial<PrismNode> = {}): PrismNode {
  return {
    nodeId: id,
    subtype: patch.subtype ?? 'product-card',
    parentHubId,
    serviceTag: 'test',
    visual: { transform: { x: 0, y: 0, z: 0, width: 1, height: 1 } },
    intent: {
      caption: id,
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
    codeRef: '',
    backendRef: null,
    ...patch,
  };
}

describe('EB-10-06 - assembled global slots', () => {
  it('includes active page content plus global slots across pages', () => {
    const nodes = [
      node('arrival-content', 's1-arrival'),
      node('movement-content', 's2-movement'),
      node('global-header-bar', 's1-arrival', { subtype: 'app-header', globalSlot: 'header' }),
      node('overlay-spec-card', '', { isGlobalElement: true }),
    ];

    const scope = resolveAssembledNodesForHub(nodes, 's2-movement');
    expect(scope.nodes.map((n) => n.nodeId)).toEqual([
      'movement-content',
      'global-header-bar',
    ]);
    expect(scope.globalSlotNodes.map((n) => n.nodeId)).toEqual(['global-header-bar']);
    expect(scope.hubNodes.map((n) => n.nodeId)).toEqual(['movement-content']);
  });

  it('hides matching duplicated page chrome only after a global chrome counterpart exists', () => {
    const nodes = [
      node('shell-header-bar', 'global', { subtype: 'app-header', globalSlot: 'header' }),
      node('shell-2_movement-header-bar', 's2-movement', { subtype: 'app-header' }),
      node('shell-2_movement-footer-brand', 's2-movement', { subtype: 'footer-brand' }),
      node('movement-content', 's2-movement'),
    ];

    expect(getSharedChromeSignature(nodes[0])).toBe(getSharedChromeSignature(nodes[1]));

    const scope = resolveAssembledNodesForHub(nodes, 's2-movement');
    expect(scope.nodes.map((n) => n.nodeId)).toEqual([
      'shell-header-bar',
      'shell-2_movement-footer-brand',
      'movement-content',
    ]);
    expect(scope.hiddenDuplicateChromeIds).toEqual(['shell-2_movement-header-bar']);
  });

  it('uses authored global slots for exact repeated shell chrome in the current graph', () => {
    const currentScope = resolveAssembledNodesForHub(liveGraph.nodes, 's2-movement');

    expect(currentScope.globalSlotNodes).toHaveLength(10);
    expect(currentScope.globalSlotNodes.map((n) => n.nodeId)).toEqual(expect.arrayContaining([
      'shell-footer-bar',
      'shell-footer-brand',
      'shell-footer-legal',
      'shell-nav-arrival-navhit',
      'shell-brand-mark-brandhit',
      'shell-footer-brand-brandhit',
    ]));
    expect(currentScope.hiddenDuplicateChromeIds).toEqual(expect.arrayContaining([
      'shell-2_movement-footer-bar',
      'shell-2_movement-footer-brand',
      'shell-2_movement-footer-legal',
      'shell-2_movement-nav-arrival-navhit',
    ]));
    expect(currentScope.hiddenDuplicateChromeIds).not.toContain('shell-2_movement-header-bar');
    expect(currentScope.hiddenDuplicateChromeIds).not.toContain('shell-2_movement-footer-links');
  });

  it('wires the resolver into the live root GraphScene', () => {
    expect(graphSceneSrc).toMatch(/resolveAssembledNodesForHub/);
    expect(graphSceneSrc).toMatch(/__PRISM_ASSEMBLED_NODE_SCOPE__/);
    expect(graphSceneSrc).not.toMatch(/EditorShellScene/);
  });
});
