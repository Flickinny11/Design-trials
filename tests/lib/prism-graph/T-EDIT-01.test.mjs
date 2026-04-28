#!/usr/bin/env node
// T-EDIT-01 — Phase 1 of the editor-integration plan.
//
// Plan ref: /Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md §Phase 1.
//
// Acceptance contract:
//
//   A. Files exist
//      A1 src/lib/prism-graph/types.ts
//      A2 src/lib/prism-graph/loader.ts
//      A3 src/lib/prism-graph/view-model.ts
//      A4 src/stores/useGraphSourceStore.ts
//
//   B. types.ts exports the canonical interfaces
//      B1 PrismHub                  B2 PrismNode
//      B3 PrismEdge                 B4 GraphSource
//      B5 The eight 2026-04-27 intent sub-fields are reachable via the
//         PrismNode type (string match on intent.{samHints, alphaCutout,
//         visualSpec.layers, animationSpec, visualNeighbors,
//         interactionNeighbors, responsiveSizing, visibility}).
//
//   C. loader.ts exposes loadFromHomeHub() that maps home-hub.json to
//      { hubs, nodes, edges } with the expected shape:
//      C1 returns { hubs, nodes, edges }
//      C2 hubs is a non-empty array; first hub has hubId === 'home-hub'
//      C3 nodes.length === 40
//      C4 edges.length === 15
//      C5 every node has nodeId, parentHubId, intent.caption
//      C6 first hub has caption + responsiveBreakpoints (2026-04-27 fields)
//      C7 the eight 2026-04-27 fields are preserved on a representative
//         node (page-background carries samHints + alphaCutout + animationSpec
//         + visualNeighbors + interactionNeighbors; navbar-link-home carries
//         the same plus textContent layers).
//      C8 loader.ts also exports loadFromPrismArtifact (signature only — not
//         exercised in this test; full unzip path tested by T03's archive test).
//
//   D. view-model.ts exposes the 12+ documented accessors:
//      D1 getCaption(node)               D2 getElementType(node)
//      D3 getTextContent(node)           D4 getInteractions(node)
//      D5 getStateCount(node)            D6 getVerificationScore(node)
//      D7 getHasAnimation(node)          D8 getAnimationFrames(node)
//      D9 getBackendContract(node)       D10 getEdges(graph, nodeId)
//      D11 getSamHints / getAlphaCutout / getLayers / getAnimationSpec /
//          getVisualNeighbors / getInteractionNeighbors / getResponsiveSizing /
//          getVisibility (8 first-class accessors for the 2026-04-27 fields)
//      D12 getNodeName(node) — derives titleCase from nodeId
//      D13 getHubIds(node) — returns [parentHubId]
//      Each accessor returns the right value for a representative node.
//
//   E. useGraphSourceStore.ts is a Zustand store that exposes
//      { hubs, nodes, edges, ready, error } and a load() action.
//
//   F. TypeScript compile is clean (npx tsc --noEmit).
//
//   G. No runtime behavior change — Inspector + GraphScene still import GRAPH
//      from mockGraph at this phase. Verified by string match on Inspector
//      source and GraphScene source.
//
// Run: node tests/lib/prism-graph/T-EDIT-01.test.mjs

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// tests/lib/prism-graph/T-EDIT-01.test.mjs → repo root
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const APP_ROOT = join(REPO_ROOT, 'kid-kode-landing');

const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', RESET = '\x1b[0m';
const failures = [];
function check(label, pass, detail = '') {
  const marker = pass ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`[${marker}] ${label}${detail ? `  ${DIM}${detail}${RESET}` : ''}`);
  if (!pass) failures.push({ label, detail });
}

const typesPath = join(APP_ROOT, 'src', 'lib', 'prism-graph', 'types.ts');
const loaderPath = join(APP_ROOT, 'src', 'lib', 'prism-graph', 'loader.ts');
const viewModelPath = join(APP_ROOT, 'src', 'lib', 'prism-graph', 'view-model.ts');
const storePath = join(APP_ROOT, 'src', 'stores', 'useGraphSourceStore.ts');
const homeHubPath = join(APP_ROOT, 'src', 'lib', 'prism', 'mock-app-source', 'hubs', 'home-hub.json');

// ── Phase A: file existence ─────────────────────────────────────────────────

check('A1 — types.ts exists',           existsSync(typesPath),     typesPath);
check('A2 — loader.ts exists',          existsSync(loaderPath),    loaderPath);
check('A3 — view-model.ts exists',      existsSync(viewModelPath), viewModelPath);
check('A4 — useGraphSourceStore.ts exists', existsSync(storePath), storePath);

// If foundation files are missing, abort early — downstream checks can't run.
if (!existsSync(typesPath) || !existsSync(loaderPath) || !existsSync(viewModelPath) || !existsSync(storePath)) {
  console.log('\n' + failures.length + ' failure(s). Foundation files missing — aborting.');
  process.exit(1);
}

// ── Phase B: types.ts has the canonical interfaces ──────────────────────────

const typesSrc = readFileSync(typesPath, 'utf8');
check('B1 — PrismHub interface declared',  /export\s+interface\s+PrismHub\b/.test(typesSrc));
check('B2 — PrismNode interface declared', /export\s+interface\s+PrismNode\b/.test(typesSrc));
check('B3 — PrismEdge interface declared', /export\s+interface\s+PrismEdge\b/.test(typesSrc));
check('B4 — GraphSource type declared',    /export\s+(interface|type)\s+GraphSource\b/.test(typesSrc));

const eightFields = [
  'samHints', 'alphaCutout', 'animationSpec',
  'visualNeighbors', 'interactionNeighbors',
  'responsiveSizing', 'visibility',
  'layers', // visualSpec.layers
];
for (const f of eightFields) {
  check(`B5 — types.ts references intent field "${f}"`, typesSrc.includes(f));
}

// ── Phase C: loader.ts maps home-hub.json correctly ─────────────────────────

let loaderMod;
try {
  loaderMod = await import(pathToFileURL(loaderPath).href);
} catch (e) {
  check('C0 — loader.ts imports cleanly via Node type-strip', false, e.message);
}

if (loaderMod) {
  check('C0 — loader.ts imports cleanly via Node type-strip', true);
  check('C0a — loader exports loadFromHomeHub',          typeof loaderMod.loadFromHomeHub === 'function');
  check('C0b — loader exports loadFromPrismArtifact',    typeof loaderMod.loadFromPrismArtifact === 'function');

  if (typeof loaderMod.loadFromHomeHub === 'function') {
    const homeHubJson = JSON.parse(readFileSync(homeHubPath, 'utf8'));
    let result;
    try {
      result = await loaderMod.loadFromHomeHub(homeHubJson);
    } catch (e) {
      check('C1 — loadFromHomeHub(json) returns without throw', false, e.message);
    }
    if (result) {
      check('C1 — loadFromHomeHub(json) returns without throw', true);
      check('C1a — result has hubs',  Array.isArray(result.hubs));
      check('C1b — result has nodes', Array.isArray(result.nodes));
      check('C1c — result has edges', Array.isArray(result.edges));
      check('C2 — first hub.hubId === "home-hub"',
        result.hubs?.[0]?.hubId === 'home-hub',
        `got: ${result.hubs?.[0]?.hubId}`);
      check('C3 — nodes.length === 40', result.nodes?.length === 40, `got: ${result.nodes?.length}`);
      check('C4 — edges.length === 15', result.edges?.length === 15, `got: ${result.edges?.length}`);

      // Every node carries the canonical fields
      const allNodesHaveFields = result.nodes?.every((n) =>
        typeof n.nodeId === 'string' &&
        typeof n.parentHubId === 'string' &&
        n.intent && typeof n.intent.caption === 'string'
      );
      check('C5 — every node has nodeId + parentHubId + intent.caption', !!allNodesHaveFields);

      // 2026-04-27 hub-level fields
      const hub0 = result.hubs?.[0];
      check('C6a — hub.caption is a non-empty string',
        typeof hub0?.caption === 'string' && hub0.caption.length > 50);
      check('C6b — hub.responsiveBreakpoints has mobile/tablet/desktop',
        !!hub0?.responsiveBreakpoints?.mobile &&
        !!hub0?.responsiveBreakpoints?.tablet &&
        !!hub0?.responsiveBreakpoints?.desktop);

      // 2026-04-27 node-level fields preserved on representative nodes
      const pageBg = result.nodes?.find((n) => n.nodeId === 'page-background');
      check('C7a — page-background.intent.samHints preserved',
        !!pageBg?.intent?.samHints && typeof pageBg.intent.samHints.elementType === 'string');
      check('C7b — page-background.intent.alphaCutout preserved',
        !!pageBg?.intent?.alphaCutout && typeof pageBg.intent.alphaCutout.necessity === 'string');
      check('C7c — page-background.intent.animationSpec preserved (object)',
        typeof pageBg?.intent?.animationSpec === 'object');
      check('C7d — page-background.intent.visualNeighbors preserved',
        !!pageBg?.intent?.visualNeighbors);
      check('C7e — page-background.intent.interactionNeighbors preserved',
        !!pageBg?.intent?.interactionNeighbors);

      const navLink = result.nodes?.find((n) => n.nodeId === 'navbar-link-home');
      check('C7f — navbar-link-home.intent.visualSpec.layers preserved',
        Array.isArray(navLink?.intent?.visualSpec?.layers) &&
        navLink.intent.visualSpec.layers.length >= 1);
      check('C7g — navbar-link-home.intent.visualSpec.textContent preserved',
        Array.isArray(navLink?.intent?.visualSpec?.textContent) &&
        navLink.intent.visualSpec.textContent.length >= 1);
    }
  }
}

// ── Phase D: view-model.ts accessors ────────────────────────────────────────

let viewModelMod;
try {
  viewModelMod = await import(pathToFileURL(viewModelPath).href);
} catch (e) {
  check('D0 — view-model.ts imports cleanly', false, e.message);
}

if (viewModelMod && loaderMod && typeof loaderMod.loadFromHomeHub === 'function') {
  check('D0 — view-model.ts imports cleanly', true);

  const accessors = [
    'getCaption', 'getElementType', 'getTextContent', 'getInteractions',
    'getStateCount', 'getVerificationScore', 'getHasAnimation', 'getAnimationFrames',
    'getBackendContract', 'getEdges',
    'getSamHints', 'getAlphaCutout', 'getLayers', 'getAnimationSpec',
    'getVisualNeighbors', 'getInteractionNeighbors', 'getResponsiveSizing', 'getVisibility',
    'getNodeName', 'getHubIds',
  ];
  for (const name of accessors) {
    check(`D — view-model exports ${name}`, typeof viewModelMod[name] === 'function');
  }

  // Functional checks against a representative node (hero-card-cta)
  const homeHubJson = JSON.parse(readFileSync(homeHubPath, 'utf8'));
  const result = await loaderMod.loadFromHomeHub(homeHubJson);
  const cta = result.nodes.find((n) => n.nodeId === 'hero-card-cta');
  const navLink = result.nodes.find((n) => n.nodeId === 'navbar-link-home');
  const pageBg = result.nodes.find((n) => n.nodeId === 'page-background');

  if (cta && navLink && pageBg && viewModelMod.getCaption) {
    check('D-fn — getCaption(cta) starts with "Centered call-to-action"',
      typeof viewModelMod.getCaption(cta) === 'string' &&
      viewModelMod.getCaption(cta).startsWith('Centered call-to-action'));

    check('D-fn — getElementType(cta) === "button"',
      viewModelMod.getElementType(cta) === 'button',
      `got: ${viewModelMod.getElementType(cta)}`);

    check('D-fn — getTextContent(navLink) length === 1',
      Array.isArray(viewModelMod.getTextContent(navLink)) &&
      viewModelMod.getTextContent(navLink).length === 1);

    check('D-fn — getInteractions(cta) maps event/effect to event/action',
      Array.isArray(viewModelMod.getInteractions(cta)) &&
      viewModelMod.getInteractions(cta)[0]?.event === 'pointertap' &&
      typeof viewModelMod.getInteractions(cta)[0]?.action === 'string');

    check('D-fn — getHasAnimation(cta) === true',
      viewModelMod.getHasAnimation(cta) === true);

    check('D-fn — getAnimationFrames(cta) === 0 (no frameCount on CTA)',
      viewModelMod.getAnimationFrames(cta) === 0,
      `got: ${viewModelMod.getAnimationFrames(cta)}`);

    check('D-fn — getBackendContract(cta) has service from backendRef',
      viewModelMod.getBackendContract(cta)?.service === 'hero-card-cta');

    check('D-fn — getEdges(graph, cta.nodeId) length === 3 (cta has 3 outgoing edges)',
      Array.isArray(viewModelMod.getEdges(result, 'hero-card-cta')) &&
      viewModelMod.getEdges(result, 'hero-card-cta').length === 3);

    check('D-fn — getSamHints(cta).elementType === "button"',
      viewModelMod.getSamHints(cta)?.elementType === 'button');

    check('D-fn — getAlphaCutout(cta).necessity === "soft"',
      viewModelMod.getAlphaCutout(cta)?.necessity === 'soft');

    check('D-fn — getLayers(cta).length === 3 (glow + base + shimmer)',
      Array.isArray(viewModelMod.getLayers(cta)) &&
      viewModelMod.getLayers(cta).length === 3);

    check('D-fn — getNodeName(cta) === "Hero Card Cta"',
      viewModelMod.getNodeName(cta) === 'Hero Card Cta',
      `got: ${viewModelMod.getNodeName(cta)}`);

    check('D-fn — getHubIds(cta) === ["home-hub"]',
      JSON.stringify(viewModelMod.getHubIds(cta)) === JSON.stringify(['home-hub']));
  }
}

// ── Phase E: useGraphSourceStore.ts shape ───────────────────────────────────

const storeSrc = readFileSync(storePath, 'utf8');
check('E1 — store imports zustand',
  /from\s+['"]zustand['"]/.test(storeSrc));
check('E2 — store exposes hubs/nodes/edges/ready/error fields',
  ['hubs', 'nodes', 'edges', 'ready', 'error'].every((f) => storeSrc.includes(f)));
check('E3 — store exports useGraphSourceStore',
  /export\s+const\s+useGraphSourceStore\b/.test(storeSrc));
check('E4 — store has a load() action',
  /\bload\b/.test(storeSrc));

// ── Phase F: TypeScript compile is clean ────────────────────────────────────

const tsc = spawnSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], {
  cwd: APP_ROOT,
  encoding: 'utf8',
});
check('F1 — npx tsc --noEmit exits 0',
  tsc.status === 0,
  tsc.status === 0 ? '' : (tsc.stdout || '') + (tsc.stderr || '').slice(0, 800));

// ── Phase G: no runtime behavior change ─────────────────────────────────────

const inspectorPath = join(APP_ROOT, 'src', 'components', 'editor', 'panels', 'Inspector.tsx');
const graphScenePath = join(APP_ROOT, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx');
const inspectorSrc = readFileSync(inspectorPath, 'utf8');
const graphSceneSrc = readFileSync(graphScenePath, 'utf8');
check('G1 — Inspector still imports GRAPH (Phase 2 will swap)',
  /from\s+['"]@\/data\/mockGraph['"]/.test(inspectorSrc));
check('G2 — GraphScene still imports GRAPH (Phase 2 will swap)',
  /from\s+['"]@\/data\/mockGraph['"]/.test(graphSceneSrc));

// ──────────────────────────────────────────────────────────────────────────

console.log();
if (failures.length > 0) {
  console.log(`${RED}${failures.length} check(s) failed${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}T-EDIT-01: all checks passed${RESET}`);
}
