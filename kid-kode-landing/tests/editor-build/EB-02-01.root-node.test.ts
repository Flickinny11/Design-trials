// EB-02-01 — PrismRootNode interface + serializer + validator (additive).
//
// Spec refs: §2 SC-005 ("PrismRootNode type exists ... with the D1 fields as
// typed graph data"), §2 SC-006 ("Exactly one PrismRootNode instance exists in
// any valid GraphSource; runtime assertion enforces uniqueness."), §8 INV-18
// (additive schema growth — no rename/delete/required-field-addition on
// PrismNode, PrismHub, PrismRootNode, GraphSource), §9 RA-07 (a dedicated
// PrismRootNode interface co-exists with PrismNode in GraphSource — option B).
//
// haltCheck: PrismRootNode type exists in src/lib/prism-graph/root-node.ts
// with all D1 fields; validateRootNode rejects graphs without exactly one
// root node; tsc clean; tests for serializer + validator pass.
//
// D1 fields (per gap-analysis lines 275-286, RA-01 / RA-07):
//   appNameWorldId, spec, designSpec, buildPlan, memoryLog, hubRegistry,
//   nodeRegistry, globalDependencies, validationRules, aiRoutingRules,
//   capabilityRefs.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  validateRootNode,
  serializeRootNode,
  deserializeRootNode,
  type PrismRootNode,
} from '@/lib/prism-graph/root-node';
import type { GraphSource } from '@/lib/prism-graph/types';

const repoRoot = join(__dirname, '..', '..');
const rootNodePath = join(repoRoot, 'src', 'lib', 'prism-graph', 'root-node.ts');
const typesPath = join(repoRoot, 'src', 'lib', 'prism-graph', 'types.ts');

function makeRoot(
  overrides: Partial<PrismRootNode> = {},
  id = 'app-name-world-1',
): PrismRootNode {
  return {
    appNameWorldId: id,
    spec: { name: 'TestApp' } as PrismRootNode['spec'],
    designSpec: {} as PrismRootNode['designSpec'],
    buildPlan: {} as PrismRootNode['buildPlan'],
    memoryLog: [],
    hubRegistry: [],
    nodeRegistry: [],
    globalDependencies: [],
    validationRules: [],
    aiRoutingRules: [],
    capabilityRefs: [],
    ...overrides,
  };
}

function makeGraph(roots: PrismRootNode[] = []): GraphSource & { rootNodes?: PrismRootNode[] } {
  return {
    hubs: [],
    nodes: [],
    edges: [],
    rootNodes: roots,
  };
}

describe('EB-02-01 — PrismRootNode interface, serializer, validator', () => {
  it('SC-005: root-node.ts module exists', () => {
    expect(existsSync(rootNodePath)).toBe(true);
  });

  it('SC-005: PrismRootNode type ships all 11 D1 fields (source-shape)', () => {
    const src = readFileSync(rootNodePath, 'utf8');
    const requiredFields = [
      'appNameWorldId',
      'spec',
      'designSpec',
      'buildPlan',
      'memoryLog',
      'hubRegistry',
      'nodeRegistry',
      'globalDependencies',
      'validationRules',
      'aiRoutingRules',
      'capabilityRefs',
    ];
    for (const field of requiredFields) {
      expect(src).toMatch(new RegExp(`\\b${field}\\b\\s*:`));
    }
    // The interface itself must be declared (named export).
    expect(src).toMatch(/export\s+interface\s+PrismRootNode\b/);
  });

  it('RA-07: GraphSource carries rootNodes?: PrismRootNode[] (additive co-existence)', () => {
    const src = readFileSync(typesPath, 'utf8');
    // Additive optional field on GraphSource (INV-18). Reference the symbol so
    // the PrismRootNode type binding flows through types.ts.
    expect(src).toMatch(/rootNodes\?\s*:\s*PrismRootNode\[\]/);
  });

  it('INV-18: PrismNode + PrismHub + GraphSource pre-existing fields not deleted', () => {
    const src = readFileSync(typesPath, 'utf8');
    // Spot-check the canonical PrismNode fields and GraphSource hubs/nodes/edges.
    expect(src).toMatch(/interface\s+PrismNode\s*\{[\s\S]*?nodeId:\s*string/);
    expect(src).toMatch(/interface\s+PrismHub\s*\{[\s\S]*?hubId:\s*string/);
    expect(src).toMatch(/interface\s+GraphSource\s*\{[\s\S]*?hubs:\s*PrismHub\[\]/);
    expect(src).toMatch(/interface\s+GraphSource\s*\{[\s\S]*?nodes:\s*PrismNode\[\]/);
    expect(src).toMatch(/interface\s+GraphSource\s*\{[\s\S]*?edges:\s*PrismEdge\[\]/);
  });

  it('SC-006: validateRootNode accepts a graph with exactly one PrismRootNode', () => {
    const graph = makeGraph([makeRoot()]);
    const result = validateRootNode(graph);
    expect(result.ok).toBe(true);
  });

  it('SC-006: validateRootNode REJECTS a graph with zero PrismRootNode instances', () => {
    const graph = makeGraph([]);
    const result = validateRootNode(graph);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/exactly one|zero|missing/i);
  });

  it('SC-006: validateRootNode REJECTS a graph with two PrismRootNode instances', () => {
    const graph = makeGraph([makeRoot({}, 'root-a'), makeRoot({}, 'root-b')]);
    const result = validateRootNode(graph);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/exactly one|multiple|2|duplicate/i);
  });

  it('SC-006: validateRootNode REJECTS a graph with rootNodes omitted (treated as zero)', () => {
    const graph: GraphSource = { hubs: [], nodes: [], edges: [] };
    const result = validateRootNode(graph as GraphSource & { rootNodes?: PrismRootNode[] });
    expect(result.ok).toBe(false);
  });

  it('serializeRootNode → deserializeRootNode is a byte-identical round-trip', () => {
    const root = makeRoot({
      memoryLog: [{ ts: 1, kind: 'note', body: 'first' } as unknown as PrismRootNode['memoryLog'][number]],
      hubRegistry: [{ hubId: 'home-hub' } as unknown as PrismRootNode['hubRegistry'][number]],
    });
    const json = serializeRootNode(root);
    expect(typeof json).toBe('string');
    const parsed = deserializeRootNode(json);
    expect(parsed).toEqual(root);
    // Stability: serializing the deserialized output yields the same string.
    expect(serializeRootNode(parsed)).toBe(json);
  });
});
