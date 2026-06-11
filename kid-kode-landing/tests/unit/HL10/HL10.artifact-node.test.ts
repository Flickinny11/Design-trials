// HL10 — Editor renders artifacts (ArtifactNode + GlassNode delegation)
//
// Spec refs:
//   - Plan §P10 (Editor renders artifacts)
//   - Editor invariant ("one graph, two views")
//
// Halt-check shape: ArtifactNode wraps factory-produced Object3D in R3F
// `<primitive object={obj} />`. GlassNode delegates to ArtifactNode when the
// node has artifact data (sourceAsset URL OR meshUrl OR codeRef); falls back
// to existing sphere when intent-only. ArtifactNode caches by
// nodeId+codeRef (re-build only on identity change) and uses
// `getSharedNodeContext({ runPrimitives: false })`.
//
// This vitest unit test exercises the contract surface that does not require
// React+R3F:
//   1. The `hasArtifactData` predicate that drives delegation.
//   2. The artifact-resolution pipeline used by ArtifactNode internals
//      (`buildPerNodeFactory(defaultRenderModeFactory)`) — that >=3 artifact
//      nodes from the canonical live-graph fixture each yield an
//      `Object3D` with `userData.cleanup` callable.
//   3. The cache key contract: same `nodeId+codeRef` reuses the cached
//      `Object3D`; identity change rebuilds.
//
// The Playwright spec (`tests/browser/editor-artifacts.spec.ts`) covers the
// browser-side smoke; this vitest covers the contract logic in isolation
// without booting a full Next.js render.

import { describe, expect, it, beforeEach } from 'vitest';
import { Group, Object3D } from 'three';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  hasArtifactData,
  resolveArtifactObject,
  __resetArtifactNodeCache,
} from '@/components/editor/graph/ArtifactNode';
import { __resetSharedContext } from '@/lib/prism/runtime/shared-context';
import type { HomeHubJson, PrismNode } from '@/lib/prism-graph/types';

// W3: frozen copy of the 6-node canonical seed (the LIVE graph is now the
// ORRERY showcase and evolves with design work — this contract test pins the
// known fixture instead of tracking demo content).
const fixturePath = resolve(__dirname, 'fixtures', 'hl10-live-graph.fixture.json');
const liveGraph = JSON.parse(readFileSync(fixturePath, 'utf8')) as HomeHubJson;

beforeEach(() => {
  __resetArtifactNodeCache();
  __resetSharedContext();
});

describe('HL10 — hasArtifactData (delegation predicate)', () => {
  it('returns true when node.visual.sourceAsset is set', () => {
    const node = liveGraph.nodes.find((n) => n.nodeId === 'home-feature-card');
    expect(node).toBeDefined();
    expect(hasArtifactData(node!)).toBe(true);
  });

  it('returns true when node.meshUrl is set', () => {
    const node = liveGraph.nodes.find((n) => n.nodeId === 'home-cta-hero');
    expect(node).toBeDefined();
    expect(node!.meshUrl).toBeTruthy();
    expect(hasArtifactData(node!)).toBe(true);
  });

  it('returns true when node.codeRef is set', () => {
    const node: PrismNode = {
      nodeId: 'codeRef-only',
      subtype: 'custom',
      parentHubId: 'home',
      serviceTag: '',
      visual: { transform: { x: 0, y: 0, z: 0, width: 1, height: 1 } },
      intent: {
        caption: '',
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
      codeRef: '/some/module.code.js',
      backendRef: null,
    };
    expect(hasArtifactData(node)).toBe(true);
  });

  it('returns false for intent-only node (no sourceAsset / meshUrl / codeRef)', () => {
    const headline = liveGraph.nodes.find((n) => n.nodeId === 'home-headline');
    expect(headline).toBeDefined();
    expect(headline!.visual.sourceAsset).toBeFalsy();
    expect(headline!.meshUrl).toBeFalsy();
    expect(headline!.codeRef).toBeFalsy();
    expect(hasArtifactData(headline!)).toBe(false);
  });

  it('counts >= 3 artifact-bearing nodes in the live-graph fixture', () => {
    const artifactNodes = liveGraph.nodes.filter(hasArtifactData);
    expect(artifactNodes.length).toBeGreaterThanOrEqual(3);
  });
});

describe('HL10 — resolveArtifactObject (factory pipeline)', () => {
  it('returns a non-null Object3D for an artifact-bearing node', () => {
    const node = liveGraph.nodes.find((n) => n.nodeId === 'home-feature-card')!;
    const obj = resolveArtifactObject(node);
    expect(obj).toBeInstanceOf(Object3D);
    expect((obj.userData as { nodeId?: string }).nodeId).toBe('home-feature-card');
  });

  it('returns the SAME Object3D when called twice with same nodeId+codeRef (cache)', () => {
    const node = liveGraph.nodes.find((n) => n.nodeId === 'home-feature-card')!;
    const a = resolveArtifactObject(node);
    const b = resolveArtifactObject(node);
    expect(a).toBe(b);
  });

  it('rebuilds when codeRef changes for the same nodeId', () => {
    const base = liveGraph.nodes.find((n) => n.nodeId === 'home-cta-hero')!;
    const variantA: PrismNode = { ...base, codeRef: '/a.code.js' };
    const variantB: PrismNode = { ...base, codeRef: '/b.code.js' };
    const a = resolveArtifactObject(variantA);
    const b = resolveArtifactObject(variantB);
    expect(a).not.toBe(b);
  });

  it('produces an Object3D with userData.cleanup callable', () => {
    const node = liveGraph.nodes.find((n) => n.nodeId === 'home-orbit-decor')!;
    const obj = resolveArtifactObject(node);
    const cleanup = (obj.userData as { cleanup?: () => void }).cleanup;
    expect(typeof cleanup).toBe('function');
    expect(() => cleanup!()).not.toThrow();
  });

  it('produces an Object3D for the codeRef-bearing mesh node (graceful)', () => {
    // home-cta-hero has codeRef set — buildPerNodeFactory wraps it as a
    // sync placeholder Group; the dynamic import resolves async. We assert
    // the synchronous return is at minimum a Group.
    const node = liveGraph.nodes.find((n) => n.nodeId === 'home-cta-hero')!;
    const obj = resolveArtifactObject(node);
    expect(obj).toBeInstanceOf(Group);
  });

  it('resets the Object3D local transform to identity (scenePosition ignored in editor view per Plan §P10)', () => {
    // The fixture's nodes carry non-trivial scenePosition values
    // (home-feature-card at x=2.6, y=0.2; home-parallax-stack at
    // x=-2.8, y=-0.5; home-cta-hero at z=1). Both the default factory
    // and the codeRef placeholder apply scenePosition to the returned
    // root. ArtifactNode MUST reset that local transform to identity so
    // the parent force-graph <group position={[x,y,z]}> is the single
    // source of truth — otherwise editor positions compound.
    const ids = ['home-feature-card', 'home-parallax-stack', 'home-cta-hero'];
    for (const id of ids) {
      const node = liveGraph.nodes.find((n) => n.nodeId === id)!;
      const obj = resolveArtifactObject(node);
      expect(obj.position.x, `${id} pos.x`).toBe(0);
      expect(obj.position.y, `${id} pos.y`).toBe(0);
      expect(obj.position.z, `${id} pos.z`).toBe(0);
      expect(obj.rotation.x, `${id} rot.x`).toBe(0);
      expect(obj.rotation.y, `${id} rot.y`).toBe(0);
      expect(obj.rotation.z, `${id} rot.z`).toBe(0);
      expect(obj.scale.x, `${id} scale.x`).toBe(1);
      expect(obj.scale.y, `${id} scale.y`).toBe(1);
      expect(obj.scale.z, `${id} scale.z`).toBe(1);
    }
  });
});
