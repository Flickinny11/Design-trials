// HL06 — /api/prism/regen route handler.
//
// Plan ref: §P6 — Next.js App Router POST that dispatches by body.action:
//   'persist'      → atomic-write public/prism-mock/home/live-graph.json
//   'verify-node'  → applyPlanRendererDefaults + validatePlanRendererFields
//                    + verifyNodeModule (when codeModule provided)
//
// Spec ref: PRISM-RENDERER-MIGRATION-SPEC.md §10 (verifier) +
// plan-output-hook (renderer-migration field defaults + plan-level checks).

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock node:fs/promises BEFORE importing the route, so the route's
// top-level imports bind to the mocks.
const fsCalls: { write: Array<{ path: string; data: string }>; rename: Array<{ from: string; to: string }> } = {
  write: [],
  rename: [],
};
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(async (path: string, data: string) => {
    fsCalls.write.push({ path, data });
  }),
  rename: vi.fn(async (from: string, to: string) => {
    fsCalls.rename.push({ from, to });
  }),
}));

import { POST } from '@/app/api/prism/regen/route';
import type { HomeHubJson, PrismHub, PrismNode } from '@/lib/prism-graph/types';

beforeEach(() => {
  fsCalls.write.length = 0;
  fsCalls.rename.length = 0;
});

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/prism/regen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeMinimalNode(overrides: Partial<PrismNode> = {}): PrismNode {
  return {
    nodeId: 'home-test-node',
    parentHubId: 'home',
    subtype: 'card',
    serviceTag: 'test',
    intent: { caption: 'Test node' },
    visual: { layoutHint: 'card' },
    renderMode: 'sprite',
    depthMapUrl: null,
    meshUrl: null,
    cinematicPrimitives: [],
    scenePosition: {
      x: 0, y: 0, z: 0,
      rotationX: 0, rotationY: 0, rotationZ: 0,
      scaleX: 1, scaleY: 1, scaleZ: 1,
    },
    ...overrides,
  } as PrismNode;
}

function makeMinimalHub(): PrismHub {
  return {
    hubId: 'home',
    title: 'Home',
    layout: { mockupUrl: '/prism-mock/home/mockup.png' },
  } as PrismHub;
}

function makeMinimalGraph(nodes: PrismNode[] = []): HomeHubJson {
  return {
    schemaVersion: '0.1.0',
    hub: makeMinimalHub(),
    nodes,
    edges: [],
  };
}

describe('POST /api/prism/regen (HL06)', () => {
  describe('contract', () => {
    it('returns ok=false with 400 on invalid JSON body', async () => {
      const req = new Request('http://localhost/api/prism/regen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json{',
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
    });

    it('returns ok=false on unknown action', async () => {
      const res = await POST(makeRequest({ action: 'banana' }));
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(String(json.error ?? '')).toContain('banana');
    });
  });

  describe('action: persist', () => {
    it('atomic-writes live-graph.json (writeFile to .tmp, then rename)', async () => {
      const graph = makeMinimalGraph([makeMinimalNode()]);
      const res = await POST(makeRequest({ action: 'persist', graph }));
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(json.regeneratedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(json.verifierStatus).toBe('clean');

      // Atomic write: tmp file written, then renamed to canonical path.
      expect(fsCalls.write).toHaveLength(1);
      expect(fsCalls.rename).toHaveLength(1);
      expect(fsCalls.write[0].path).toMatch(/public\/prism-mock\/home\/live-graph\.json\.tmp$/);
      expect(fsCalls.rename[0].from).toBe(fsCalls.write[0].path);
      expect(fsCalls.rename[0].to).toMatch(/public\/prism-mock\/home\/live-graph\.json$/);
      expect(fsCalls.rename[0].to).not.toMatch(/\.tmp$/);

      // Written content is valid JSON, contains the hub + node.
      const parsed = JSON.parse(fsCalls.write[0].data);
      expect(parsed.hub.hubId).toBe('home');
      expect(parsed.nodes).toHaveLength(1);
    });

    it('rejects persist when body.graph is missing', async () => {
      const res = await POST(makeRequest({ action: 'persist' }));
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(fsCalls.write).toHaveLength(0);
      expect(fsCalls.rename).toHaveLength(0);
    });

    it('persist returns verifierStatus=error and skips rename when a node is invalid', async () => {
      // Bad: parallax-plane requires depthMapUrl; provide none.
      const badNode = makeMinimalNode({
        nodeId: 'home-bad',
        renderMode: 'parallax-plane',
        depthMapUrl: null,
      });
      const graph = makeMinimalGraph([badNode]);
      const res = await POST(makeRequest({ action: 'persist', graph }));
      const json = await res.json();

      expect(json.ok).toBe(false);
      expect(json.verifierStatus).toBe('error');
      expect(Array.isArray(json.violations)).toBe(true);
      expect(json.violations.some((v: { rule: string }) => v.rule === 'PARALLAX_REQUIRES_DEPTH_MAP')).toBe(true);

      // No filesystem write must have happened.
      expect(fsCalls.rename).toHaveLength(0);
    });
  });

  describe('action: verify-node', () => {
    it('returns verifierStatus=clean for a clean codeModule', async () => {
      const cleanModule = `
import { Group, Mesh, PlaneGeometry, MeshBasicNodeMaterial } from 'three/webgpu';
export default function createNode(config, ctx) {
  const group = new Group();
  for (const ref of config.cinematicPrimitives) {
    ctx.primitives[ref.name](group, ref.params);
  }
  group.userData.cleanup = () => {};
  return group;
}
`;
      const res = await POST(
        makeRequest({
          action: 'verify-node',
          node: makeMinimalNode(),
          codeModule: cleanModule,
        }),
      );
      const json = await res.json();

      expect(json.ok).toBe(true);
      expect(json.verifierStatus).toBe('clean');
      expect(json.regeneratedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('flags DOCUMENT_ACCESS for a module that touches document.body', async () => {
      const dirtyModule = `
import { Group } from 'three/webgpu';
export default function createNode(config, ctx) {
  const el = document.body;
  const group = new Group();
  group.userData.cleanup = () => {};
  return group;
}
`;
      const res = await POST(
        makeRequest({
          action: 'verify-node',
          node: makeMinimalNode(),
          codeModule: dirtyModule,
        }),
      );
      const json = await res.json();

      expect(json.ok).toBe(false);
      expect(json.verifierStatus).toBe('error');
      expect(Array.isArray(json.violations)).toBe(true);
      expect(json.violations.some((v: { rule: string }) => v.rule === 'DOCUMENT_ACCESS')).toBe(true);
    });

    it('runs validatePlanRendererFields on the node even without codeModule', async () => {
      // mesh node without meshUrl → should flag MESH_REQUIRES_MESH_URL.
      const node = makeMinimalNode({ renderMode: 'mesh', meshUrl: null });
      const res = await POST(
        makeRequest({ action: 'verify-node', node }),
      );
      const json = await res.json();

      expect(json.ok).toBe(false);
      expect(json.verifierStatus).toBe('error');
      expect(json.violations.some((v: { rule: string }) => v.rule === 'MESH_REQUIRES_MESH_URL')).toBe(true);
    });

    it('returns ok=false with 400 when node is missing', async () => {
      const res = await POST(makeRequest({ action: 'verify-node' }));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
    });
  });
});
