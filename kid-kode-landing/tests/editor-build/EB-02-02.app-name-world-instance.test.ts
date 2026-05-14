// EB-02-02 — Insert App_Name_World instance in home-hub fixture; uniqueness
// assertion through validateRootNode.
//
// Spec refs:
//   §5 SC-005 — PrismRootNode type with D1 fields (verified by EB-02-01).
//   §5 SC-006 — exactly one PrismRootNode instance per valid GraphSource;
//               runtime assertion enforces uniqueness.
//   §8 INV-18 — additive schema growth: no rename/delete/required-field
//               addition to PrismNode / PrismHub / PrismRootNode /
//               GraphSource. The fixture additions exercise the new optional
//               rootNodes field; legacy graphs still validate without it.
//   §9 RA-07 — App_Name_World is a dedicated PrismRootNode interface
//               co-existing with PrismNode in GraphSource (option B).
//
// haltCheck:
//   - kid-kode-landing/src/lib/prism/mock-app-source/hubs/home-hub.legacy.json
//     (the build-time fixture; HL03 / Plan §P4 renamed home-hub.json →
//     home-hub.legacy.json) carries exactly one rootNodes entry of type
//     App_Name_World with all 11 D1 fields.
//   - kid-kode-landing/public/prism-mock/home/live-graph.json (the runtime
//     fixture loaded by useGraphSourceStore) carries the same entry so the
//     editor sees rootNodes after the initial fetch.
//   - loadFromHomeHub threads rootNodes from HomeHubJson into GraphSource.
//   - validateRootNode returns ok=true on the loaded GraphSource.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateRootNode, type PrismRootNode } from '@/lib/prism-graph/root-node';
import { loadFromHomeHub } from '@/lib/prism-graph/loader';
import type { HomeHubJson } from '@/lib/prism-graph/types';

const repoRoot = join(__dirname, '..', '..');
const legacyHubPath = join(
  repoRoot,
  'src',
  'lib',
  'prism',
  'mock-app-source',
  'hubs',
  'home-hub.legacy.json',
);
const liveGraphPath = join(
  repoRoot,
  'public',
  'prism-mock',
  'home',
  'live-graph.json',
);

const D1_FIELDS = [
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
] as const;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

describe('EB-02-02 — App_Name_World instance in home-hub fixture (SC-005, SC-006)', () => {
  it('home-hub.legacy.json carries exactly one rootNodes entry', () => {
    const json = readJson(legacyHubPath) as { rootNodes?: unknown };
    expect(Array.isArray(json.rootNodes)).toBe(true);
    expect((json.rootNodes as unknown[]).length).toBe(1);
  });

  it('home-hub.legacy.json rootNode has all 11 D1 fields populated (SC-005)', () => {
    const json = readJson(legacyHubPath) as { rootNodes: PrismRootNode[] };
    const root = json.rootNodes[0];
    for (const field of D1_FIELDS) {
      expect(root).toHaveProperty(field);
    }
    expect(typeof root.appNameWorldId).toBe('string');
    expect(root.appNameWorldId.length).toBeGreaterThan(0);
    for (const arrField of [
      'memoryLog',
      'hubRegistry',
      'nodeRegistry',
      'globalDependencies',
      'validationRules',
      'aiRoutingRules',
      'capabilityRefs',
    ] as const) {
      expect(Array.isArray(root[arrField])).toBe(true);
    }
    for (const objField of ['spec', 'designSpec', 'buildPlan'] as const) {
      expect(root[objField]).toBeTruthy();
      expect(typeof root[objField]).toBe('object');
    }
  });

  it('public/prism-mock/home/live-graph.json carries the same single rootNodes entry', () => {
    const live = readJson(liveGraphPath) as { rootNodes?: PrismRootNode[] };
    expect(Array.isArray(live.rootNodes)).toBe(true);
    expect((live.rootNodes as PrismRootNode[]).length).toBe(1);
    const liveRoot = (live.rootNodes as PrismRootNode[])[0];
    const legacyRoot = (readJson(legacyHubPath) as { rootNodes: PrismRootNode[] })
      .rootNodes[0];
    expect(liveRoot.appNameWorldId).toBe(legacyRoot.appNameWorldId);
  });

  it('loadFromHomeHub threads rootNodes through to the GraphSource', () => {
    const json = readJson(legacyHubPath) as HomeHubJson & { rootNodes: PrismRootNode[] };
    const graph = loadFromHomeHub(json);
    expect(Array.isArray(graph.rootNodes)).toBe(true);
    expect((graph.rootNodes ?? []).length).toBe(1);
    expect(graph.rootNodes![0].appNameWorldId).toBe(json.rootNodes[0].appNameWorldId);
  });

  it('validateRootNode returns ok=true on the loaded GraphSource (SC-006)', () => {
    const json = readJson(legacyHubPath) as HomeHubJson & { rootNodes: PrismRootNode[] };
    const graph = loadFromHomeHub(json);
    const result = validateRootNode(graph);
    expect(result.ok).toBe(true);
    expect(result.root).not.toBeNull();
    expect(result.reason).toBeNull();
  });

  it('validateRootNode rejects a graph carrying two rootNodes (uniqueness, SC-006)', () => {
    const json = readJson(legacyHubPath) as HomeHubJson & { rootNodes: PrismRootNode[] };
    const graph = loadFromHomeHub(json);
    const duplicated = {
      ...graph,
      rootNodes: [...(graph.rootNodes ?? []), ...(graph.rootNodes ?? [])],
    };
    const result = validateRootNode(duplicated);
    expect(result.ok).toBe(false);
    expect(result.root).toBeNull();
    expect(result.reason).toMatch(/exactly one/i);
  });

  it('legacy graphs without rootNodes still parse (INV-18 additive)', () => {
    const json = readJson(legacyHubPath) as HomeHubJson & { rootNodes?: unknown };
    const stripped = { ...json, rootNodes: undefined };
    const graph = loadFromHomeHub(stripped as HomeHubJson);
    expect(graph.hubs.length).toBeGreaterThan(0);
    expect(graph.rootNodes === undefined || (graph.rootNodes ?? []).length === 0).toBe(true);
  });
});
