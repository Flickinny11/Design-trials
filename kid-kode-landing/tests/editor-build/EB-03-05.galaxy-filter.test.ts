// EB-03-05 — Galaxy mode: global filter overlay greys/dims non-matching items.
//
// Spec ref:
//   §3 SC-016 — "Global filter overlay greys/dims non-matching hubs and nodes;
//                selection still allowed on matching items."
//
// haltCheck (from ralph-state.json):
//   "Filter overlay UI ships; applying a filter greys/dims non-matching
//    hubs+nodes; matching items remain interactive; clearing the filter
//    restores original appearance."
//
// Contract:
//   - `computeGalaxyFilterMatches(query, hubs, nodes)` is a pure function
//     exported from `src/lib/galaxy-filter.ts`. It returns
//       { active: boolean; matchedHubIds: Set<string>; matchedNodeIds: Set<string> }
//     where `active === false` iff `query.trim() === ''`. When inactive, both
//     match sets are empty; renderers MUST treat "inactive" as "everything
//     matches" (no dim).
//   - A node matches if any of name / elementType / caption contain the query
//     (case-insensitive, trimmed).
//   - A hub matches if name / route contains the query, OR any of its nodes
//     matches (presence-by-membership lifts node matches up to their hubs so
//     the parent hub stays interactive).
//   - Same input → same output (no RNG, no clock).
//
// Renderer wiring (GraphScene.tsx):
//   - GraphScene reads `filterQuery` from the editor store and computes the
//     match set once per render via `computeGalaxyFilterMatches`.
//   - The dim factor (`GALAXY_FILTER_DIM_OPACITY`) applies to non-matching
//     hubs and nodes ONLY when `viewMode === 'galaxy'` and the filter is
//     active. Matching items render at full opacity and remain pointer-event
//     interactive. When the filter is cleared, the dim factor is dropped.
//
// Store contract (useGraphEditorStore):
//   - Adds `filterOpen: boolean`, `filterQuery: string`, plus `toggleFilter`,
//     `setFilterQuery(q)`, `clearFilter()` actions. These are independent of
//     the existing search palette (Cmd+K) — search is for fly-to, filter is
//     for scene dimming.
//
// UI:
//   - `src/components/editor/overlays/GalaxyFilterOverlay.tsx` is a default
//     export. It only renders when `viewMode === 'galaxy' && filterOpen`. It
//     exposes a text input wired to `filterQuery` and a Clear control wired
//     to `clearFilter`.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  computeGalaxyFilterMatches,
  GALAXY_FILTER_DIM_OPACITY,
} from '../../src/lib/galaxy-filter';

const repoRoot = join(__dirname, '..', '..');
const filterSrc = readFileSync(
  join(repoRoot, 'src', 'lib', 'galaxy-filter.ts'),
  'utf8',
);
const storeSrc = readFileSync(
  join(repoRoot, 'src', 'stores', 'useGraphEditorStore.ts'),
  'utf8',
);
const overlaySrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'overlays', 'GalaxyFilterOverlay.tsx'),
  'utf8',
);
const graphSceneSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx'),
  'utf8',
);
const pageSrc = readFileSync(
  join(repoRoot, 'src', 'app', 'page.tsx'),
  'utf8',
);

function mkHub(id: string, name: string, route = '/') {
  return {
    id,
    name,
    route,
    glyph: 'home',
    color: '#5d8bff',
    accentColor: '#a978ff',
    mockupUrl: null,
  };
}

function mkNode(id: string, hubId: string, name: string, elementType = 'element', caption = '') {
  return {
    id,
    name,
    elementType,
    hubIds: [hubId],
    caption,
    status: 'verified' as const,
    verificationScore: 1,
    hasBackend: false,
    hasAnimation: false,
    animationFrames: 0,
    stateCount: 0,
    code: '',
    visualSpec: {
      primaryColor: '#fff',
      secondaryColor: '#fff',
      font: 'Inter',
      radius: 1,
      shadow: 'none' as const,
    },
    textContent: [],
    interactions: [],
  };
}

describe('EB-03-05 — computeGalaxyFilterMatches (SC-016)', () => {
  it('exports computeGalaxyFilterMatches as a pure function', () => {
    expect(typeof computeGalaxyFilterMatches).toBe('function');
  });

  it('exports a numeric GALAXY_FILTER_DIM_OPACITY constant in (0, 1)', () => {
    expect(typeof GALAXY_FILTER_DIM_OPACITY).toBe('number');
    expect(GALAXY_FILTER_DIM_OPACITY).toBeGreaterThan(0);
    expect(GALAXY_FILTER_DIM_OPACITY).toBeLessThan(1);
  });

  it('treats an empty / whitespace-only query as INACTIVE (no filter)', () => {
    const hubs = [mkHub('a', 'Auth')];
    const nodes = [mkNode('n1', 'a', 'Login Button')];
    const empty = computeGalaxyFilterMatches('', hubs, nodes);
    const blank = computeGalaxyFilterMatches('   \t  ', hubs, nodes);
    expect(empty.active).toBe(false);
    expect(blank.active).toBe(false);
    expect(empty.matchedHubIds.size).toBe(0);
    expect(empty.matchedNodeIds.size).toBe(0);
  });

  it('is deterministic — same input → same output', () => {
    const hubs = [mkHub('a', 'Auth'), mkHub('b', 'Billing')];
    const nodes = [mkNode('n1', 'a', 'Login Button')];
    const a = computeGalaxyFilterMatches('login', hubs, nodes);
    const b = computeGalaxyFilterMatches('login', hubs, nodes);
    expect(a.active).toBe(b.active);
    expect(Array.from(a.matchedHubIds).sort()).toEqual(Array.from(b.matchedHubIds).sort());
    expect(Array.from(a.matchedNodeIds).sort()).toEqual(Array.from(b.matchedNodeIds).sort());
  });

  it('matches a hub by its name (case-insensitive)', () => {
    const hubs = [mkHub('a', 'Auth'), mkHub('b', 'Billing')];
    const nodes: ReturnType<typeof mkNode>[] = [];
    const out = computeGalaxyFilterMatches('auth', hubs, nodes);
    expect(out.active).toBe(true);
    expect(out.matchedHubIds.has('a')).toBe(true);
    expect(out.matchedHubIds.has('b')).toBe(false);
  });

  it('matches a hub by its route', () => {
    const hubs = [mkHub('a', 'Home', '/settings'), mkHub('b', 'Billing', '/billing')];
    const out = computeGalaxyFilterMatches('settings', hubs, []);
    expect(out.matchedHubIds.has('a')).toBe(true);
    expect(out.matchedHubIds.has('b')).toBe(false);
  });

  it('matches a node by name and lifts its hub into matchedHubIds', () => {
    // SC-016: matching items remain interactive. A hub that contains a
    // matching node MUST also be marked matched so the parent visual + hit
    // surface stays bright; otherwise users could see a dim hub with a bright
    // node inside it, which looks broken.
    const hubs = [mkHub('a', 'Auth'), mkHub('b', 'Billing')];
    const nodes = [
      mkNode('n1', 'a', 'Login Button'),
      mkNode('n2', 'b', 'Card Number'),
    ];
    const out = computeGalaxyFilterMatches('login', hubs, nodes);
    expect(out.matchedNodeIds.has('n1')).toBe(true);
    expect(out.matchedNodeIds.has('n2')).toBe(false);
    expect(out.matchedHubIds.has('a')).toBe(true);
    expect(out.matchedHubIds.has('b')).toBe(false);
  });

  it('matches a node by elementType and by caption', () => {
    const hubs = [mkHub('a', 'Auth')];
    const nodes = [
      mkNode('n1', 'a', 'X', 'button', 'tap to sign in'),
      mkNode('n2', 'a', 'Y', 'input', 'card number'),
    ];
    const elT = computeGalaxyFilterMatches('button', hubs, nodes);
    expect(elT.matchedNodeIds.has('n1')).toBe(true);
    expect(elT.matchedNodeIds.has('n2')).toBe(false);
    const cap = computeGalaxyFilterMatches('sign in', hubs, nodes);
    expect(cap.matchedNodeIds.has('n1')).toBe(true);
  });

  it('returns disjoint sets when query matches neither hubs nor nodes', () => {
    const hubs = [mkHub('a', 'Auth')];
    const nodes = [mkNode('n1', 'a', 'Login Button')];
    const out = computeGalaxyFilterMatches('zzz-no-hits', hubs, nodes);
    expect(out.active).toBe(true);
    expect(out.matchedHubIds.size).toBe(0);
    expect(out.matchedNodeIds.size).toBe(0);
  });

  it('uses no RNG and no clock', () => {
    expect(filterSrc).not.toMatch(/Math\.random\s*\(/);
    expect(filterSrc).not.toMatch(/Date\.(now|UTC)\s*\(/);
    expect(filterSrc).not.toMatch(/performance\.now\s*\(/);
  });
});

describe('EB-03-05 — useGraphEditorStore filter state', () => {
  it('declares a filterOpen boolean field', () => {
    expect(storeSrc).toMatch(/filterOpen:\s*boolean/);
  });

  it('declares a filterQuery string field', () => {
    expect(storeSrc).toMatch(/filterQuery:\s*string/);
  });

  it('exposes a toggleFilter action', () => {
    expect(storeSrc).toMatch(/toggleFilter:\s*\(/);
  });

  it('exposes a setFilterQuery action', () => {
    expect(storeSrc).toMatch(/setFilterQuery:\s*\(/);
  });

  it('exposes a clearFilter action', () => {
    expect(storeSrc).toMatch(/clearFilter:\s*\(/);
  });
});

describe('EB-03-05 — GalaxyFilterOverlay UI', () => {
  it('is a client-component default export', () => {
    expect(overlaySrc).toMatch(/^'use client';/m);
    expect(overlaySrc).toMatch(/export\s+default\s+function/);
  });

  it('reads filterQuery / filterOpen / viewMode from useGraphEditorStore', () => {
    expect(overlaySrc).toMatch(/filterQuery/);
    expect(overlaySrc).toMatch(/filterOpen/);
    expect(overlaySrc).toMatch(/viewMode/);
  });

  it('gates rendering on viewMode === "galaxy" and filterOpen', () => {
    expect(overlaySrc).toMatch(
      /viewMode\s*!==\s*['"]galaxy['"]|viewMode\s*===\s*['"]galaxy['"]/,
    );
    expect(overlaySrc).toMatch(/filterOpen/);
  });

  it('wires a text input to setFilterQuery', () => {
    expect(overlaySrc).toMatch(/setFilterQuery/);
    expect(overlaySrc).toMatch(/<input/);
  });

  it('wires a Clear control to clearFilter', () => {
    expect(overlaySrc).toMatch(/clearFilter/);
  });

  it('is mounted in the editor root layout (page.tsx)', () => {
    expect(pageSrc).toMatch(/GalaxyFilterOverlay/);
  });
});

describe('EB-03-05 — GraphScene wires the galaxy filter dim', () => {
  it('imports computeGalaxyFilterMatches and GALAXY_FILTER_DIM_OPACITY from galaxy-filter', () => {
    expect(graphSceneSrc).toMatch(/computeGalaxyFilterMatches/);
    expect(graphSceneSrc).toMatch(/GALAXY_FILTER_DIM_OPACITY/);
    expect(graphSceneSrc).toMatch(/from\s+['"]@\/lib\/galaxy-filter['"]/);
  });

  it('subscribes to filterQuery from the editor store', () => {
    expect(graphSceneSrc).toMatch(/filterQuery/);
  });

  it('computes match sets and gates dim treatment on viewMode === "galaxy"', () => {
    // The dim factor only applies in galaxy mode; hub-world / canvas /
    // preview-* MUST NOT inherit the dim effect when a filter is active.
    expect(graphSceneSrc).toMatch(
      /viewMode\s*===\s*['"]galaxy['"][\s\S]{0,3000}?computeGalaxyFilterMatches\(/,
    );
  });

  it('does NOT mutate existing EDGE_COLORS entries (renderer-migration RA-15: additive only)', () => {
    // 2026-06-09 UI design overhaul: frozen values re-pinned to the
    // Observatory Brass design-system tokens (see EB-03-04 for rationale —
    // the table stays frozen, at the new Logan-sanctioned values).
    expect(graphSceneSrc).toMatch(/contains:\s*dsAlpha\(DS\.brass400, 0\.45\)/);
    expect(graphSceneSrc).toMatch(/'navigates-to':\s*DS\.ice300/);
    expect(graphSceneSrc).toMatch(/triggers:\s*dsAlpha\(DS\.ok, 0\.45\)/);
    expect(graphSceneSrc).toMatch(/'data-flow':\s*dsAlpha\(DS\.ok, 0\.45\)/);
    expect(graphSceneSrc).toMatch(/'shares-state':\s*DS\.brass300/);
    expect(graphSceneSrc).toMatch(/'depends-on':\s*DS\.neutral/);
  });
});

describe('EB-03-05 — two-runtime snapshot artifacts', () => {
  it('EB-03-05 snapshot directory contains outer.png + inner.png + state.json (post-implementation gate)', () => {
    const dir = join(repoRoot, 'notes', 'ralph-snapshots', 'EB-03-05');
    expect(existsSync(dir)).toBe(true);
    const files = readdirSync(dir);
    for (const name of ['outer.png', 'inner.png', 'state.json']) {
      expect(files).toContain(name);
    }
  });
});
