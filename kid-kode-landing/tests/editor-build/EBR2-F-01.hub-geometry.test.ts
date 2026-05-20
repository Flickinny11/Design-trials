// EBR2-F-01 — hub-geometry: getHubWorldPositions + findNearestHub.
//
// Spec refs:
//   §R2-F SC-077 — During Clone-drag, a transient tether renders from the
//                  cursor's world position to the nearest hub center
//                  (Euclidean distance via `hub-geometry.findNearestHub`).
//                  The tether snaps as the cursor crosses hub-bisecting
//                  planes.
//
// haltCheck (from ralph-state.json):
//   "hub-geometry.ts exports getHubWorldPositions(hubs): Map<hubId, Vector3>
//    (reuses Phase 3 orbital math) and findNearestHub(point: Vector3,
//    hubs: PrismHub[]): {hubId, distance}. Unit tests cover ≥3 hub layouts."
//
// Notes
//   - `PrismHub` (not `EditorHubView`) is the spec-required identity (uses
//     `hubId`, NOT `id`). See types.ts line 181. EBR2-F-05 wires
//     `parentHubId: PrismHub.hubId` so this module must speak `hubId`.
//   - Phase 3 orbital math = the FNV-1a + ring layout in
//     `src/lib/useForceGraph.ts::computeGalaxyHubCenters`. Positions MUST
//     agree by `hubId`: feeding a `PrismHub[]` through `getHubWorldPositions`
//     must produce the same (x,y,z) per id as feeding the equivalent
//     `EditorHubView[]` through `computeGalaxyHubCenters`. (Otherwise the
//     drag-tether and the rendered hub centers diverge.)
//   - Vector3 import is from `'three'` (not `'three/webgpu'`); the broader
//     editor codebase uses the same.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Vector3 } from 'three';

import {
  getHubWorldPositions,
  findNearestHub,
} from '../../src/lib/prism-graph/hub-geometry';
import { computeGalaxyHubCenters } from '../../src/lib/useForceGraph';
import type { PrismHub } from '../../src/lib/prism-graph/types';

const repoRoot = join(__dirname, '..', '..');
const hubGeomSrc = readFileSync(
  join(repoRoot, 'src', 'lib', 'prism-graph', 'hub-geometry.ts'),
  'utf8',
);

// Minimal PrismHub fixture. `getHubWorldPositions` reads only `hubId`; the
// other fields are required by the type but irrelevant to the layout.
function mkHub(hubId: string): PrismHub {
  return {
    hubId,
    title: hubId,
    layout: {
      viewportWidth: 1440,
      viewportHeight: 900,
      contentHeight: 900,
      backgroundColor: '#000',
    },
  };
}

// Mirror fixture for the legacy EditorHubView shape so we can cross-check
// positions against `computeGalaxyHubCenters`.
function mkEditorHub(id: string) {
  return {
    id,
    name: id,
    route: `/${id}`,
    glyph: '*',
    color: '#fff',
    accentColor: '#fff',
    mockupUrl: null,
  };
}

describe('EBR2-F-01 — hub-geometry (SC-077)', () => {
  it('hub-geometry.ts exists at the spec-required path', () => {
    expect(
      existsSync(
        join(repoRoot, 'src', 'lib', 'prism-graph', 'hub-geometry.ts'),
      ),
    ).toBe(true);
  });

  it('exports getHubWorldPositions and findNearestHub as functions', () => {
    expect(typeof getHubWorldPositions).toBe('function');
    expect(typeof findNearestHub).toBe('function');
  });

  it('getHubWorldPositions returns a Map keyed by hubId with Vector3 values', () => {
    const hubs = ['home', 'auth', 'profile'].map(mkHub);
    const out = getHubWorldPositions(hubs);
    expect(out).toBeInstanceOf(Map);
    expect(out.size).toBe(3);
    for (const h of hubs) {
      expect(out.has(h.hubId)).toBe(true);
      const v = out.get(h.hubId)!;
      expect(v).toBeInstanceOf(Vector3);
    }
  });

  it('reuses Phase 3 orbital math: positions agree with computeGalaxyHubCenters by id', () => {
    const ids = ['home', 'auth', 'profile', 'settings', 'inbox'];
    const phPrism = getHubWorldPositions(ids.map(mkHub));
    const phEditor = computeGalaxyHubCenters(ids.map(mkEditorHub));
    for (const id of ids) {
      const v = phPrism.get(id)!;
      const ref = phEditor[id];
      // Exact equality — both code paths are pure deterministic functions of
      // the id string; any drift means the orbital math was forked and the
      // drag-tether will visibly miss the rendered hubs.
      expect(v.x).toBeCloseTo(ref.x, 10);
      expect(v.y).toBeCloseTo(ref.y, 10);
      expect(v.z).toBeCloseTo(ref.z, 10);
    }
  });

  // Layout #1 — minimal (single hub).
  it('Layout 1: single-hub graph still orbits in galaxy space (does NOT collapse to origin)', () => {
    const out = getHubWorldPositions([mkHub('only')]);
    const v = out.get('only')!;
    expect(v.length()).toBeGreaterThan(30);
  });

  // Layout #2 — small (3 hubs).
  it('Layout 2: small graph (3 hubs) maps each hubId to a unique Vector3', () => {
    const out = getHubWorldPositions(['home', 'auth', 'profile'].map(mkHub));
    const seen = new Set<string>();
    for (const v of out.values()) {
      const tag = `${v.x.toFixed(4)}|${v.y.toFixed(4)}|${v.z.toFixed(4)}`;
      expect(seen.has(tag)).toBe(false);
      seen.add(tag);
    }
    expect(out.size).toBe(3);
  });

  // Layout #3 — medium (10 hubs spanning multiple rings).
  it('Layout 3: medium graph (10 hubs) occupies at least 2 ring radii', () => {
    const hubs = [
      'home', 'auth', 'profile', 'settings', 'inbox',
      'admin', 'dashboard', 'reports', 'billing', 'team',
    ].map(mkHub);
    const out = getHubWorldPositions(hubs);
    const radii = new Set<number>();
    for (const v of out.values()) {
      radii.add(Math.round(v.length()));
    }
    expect(radii.size).toBeGreaterThanOrEqual(2);
  });

  it('is deterministic: two calls with the same hubs yield identical Vector3 values', () => {
    const hubs = ['a', 'b', 'c', 'd'].map(mkHub);
    const m1 = getHubWorldPositions(hubs);
    const m2 = getHubWorldPositions(hubs);
    for (const h of hubs) {
      const v1 = m1.get(h.hubId)!;
      const v2 = m2.get(h.hubId)!;
      expect(v1.x).toBe(v2.x);
      expect(v1.y).toBe(v2.y);
      expect(v1.z).toBe(v2.z);
    }
  });

  it('is a function of hubId, not array order — reordering preserves per-hub position', () => {
    const a = getHubWorldPositions(['home', 'auth', 'profile', 'settings'].map(mkHub));
    const b = getHubWorldPositions(['settings', 'home', 'profile', 'auth'].map(mkHub));
    for (const id of ['home', 'auth', 'profile', 'settings']) {
      const va = a.get(id)!;
      const vb = b.get(id)!;
      expect(va.x).toBe(vb.x);
      expect(va.y).toBe(vb.y);
      expect(va.z).toBe(vb.z);
    }
  });

  it('source has no Math.random / Date.now / performance.now (purity guard)', () => {
    expect(hubGeomSrc).not.toMatch(/Math\.random\s*\(/);
    expect(hubGeomSrc).not.toMatch(/Date\.(now|UTC)\s*\(/);
    expect(hubGeomSrc).not.toMatch(/performance\.now\s*\(/);
  });

  it('findNearestHub returns {hubId, distance} with Euclidean distance (SC-077)', () => {
    const hubs = ['home', 'auth', 'profile'].map(mkHub);
    const positions = getHubWorldPositions(hubs);
    const target = hubs[1];
    const v = positions.get(target.hubId)!;
    const result = findNearestHub(v.clone(), hubs);
    expect(result.hubId).toBe(target.hubId);
    expect(result.distance).toBeCloseTo(0, 6);
  });

  it('findNearestHub picks the closest hub when the point is shifted slightly', () => {
    const hubs = ['home', 'auth', 'profile', 'settings', 'inbox'].map(mkHub);
    const positions = getHubWorldPositions(hubs);
    for (const h of hubs) {
      const v = positions.get(h.hubId)!;
      // Nudge by a small offset; should still resolve to the same hub.
      const point = new Vector3(v.x + 0.1, v.y - 0.2, v.z + 0.05);
      const result = findNearestHub(point, hubs);
      expect(result.hubId).toBe(h.hubId);
      expect(result.distance).toBeGreaterThan(0);
      expect(result.distance).toBeLessThan(1);
    }
  });

  it('findNearestHub snaps across hub-bisecting planes (SC-077 snap behavior)', () => {
    // Pick two hubs whose midpoint we can probe. On either side of the
    // bisecting plane, the nearest-hub answer must flip.
    const hubs = ['home', 'auth', 'profile', 'settings', 'inbox'].map(mkHub);
    const positions = getHubWorldPositions(hubs);
    const ha = positions.get('home')!;
    const hb = positions.get('auth')!;
    const mid = new Vector3().addVectors(ha, hb).multiplyScalar(0.5);
    const dir = new Vector3().subVectors(hb, ha).normalize();
    const epsBefore = mid.clone().addScaledVector(dir, -0.001);
    const epsAfter = mid.clone().addScaledVector(dir, 0.001);
    // The "before" side is closer to home; the "after" side is closer to auth.
    // But because there are 5 hubs, we can't blindly assume only those two
    // are candidates. Constrain by passing only the two-hub subset to make
    // the bisecting-plane snap unambiguous.
    const subset = hubs.filter((h) => h.hubId === 'home' || h.hubId === 'auth');
    expect(findNearestHub(epsBefore, subset).hubId).toBe('home');
    expect(findNearestHub(epsAfter, subset).hubId).toBe('auth');
  });

  it('findNearestHub returns the only hub when given a single-hub graph', () => {
    const hubs = [mkHub('only')];
    const result = findNearestHub(new Vector3(1234, -567, 89), hubs);
    expect(result.hubId).toBe('only');
    expect(result.distance).toBeGreaterThan(0);
  });
});
