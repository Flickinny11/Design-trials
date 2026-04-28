#!/usr/bin/env node
// T-EDIT-02 — Phase 2 of the editor-integration plan.
//
// Plan ref: /Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md §Phase 2.
//
// Acceptance contract:
//
//   A. Editor data-source swap (Inspector + GraphScene)
//      A1 Inspector.tsx no longer imports `GRAPH` from '@/data/mockGraph'
//      A2 Inspector.tsx imports from '@/stores/useGraphSourceStore'
//      A3 Inspector.tsx imports from '@/lib/prism-graph/view-model'
//      A4 GraphScene.tsx no longer imports `GRAPH` from '@/data/mockGraph'
//      A5 GraphScene.tsx imports from '@/stores/useGraphSourceStore'
//      A6 GraphScene.tsx imports from '@/lib/prism-graph/view-model'
//
//   B. mockGraph.ts kept as on-disk fallback (NOT deleted) — plan §Phase 2:
//      "kept on disk as a fallback fixture for editor-only demos / tests, but
//      no longer imported by Inspector or GraphScene."
//      B1 src/data/mockGraph.ts still on disk
//
//   C. view-model.ts gains the editor-view adapter
//      C1 toEditorView(graph) returns { hubs, nodes, edges }
//      C2 toEditorNode(node) returns the legacy editor-node shape
//      C3 toEditorHub(hub) returns the legacy editor-hub shape
//      C4 toEditorEdge(edge) returns the legacy editor-edge shape
//
//   D. Field reconciliation (functional checks against home-hub.json)
//      D1 toEditorNode(node).id === node.nodeId
//      D2 toEditorNode(node).hubIds === [node.parentHubId]
//      D3 toEditorNode(node).caption === node.intent.caption
//      D4 toEditorNode(node).name === titleCase(node.nodeId)
//      D5 toEditorNode(node).elementType is a string from samHints (or default)
//      D6 toEditorNode(node).interactions[i].{event,action,target} maps from
//         behaviorSpec.interactions(event/effect) + triggersDownstream
//      D7 toEditorNode(node).hasBackend === !!node.backendRef
//      D8 toEditorNode(node).hasAnimation reflects animationSpec/frameCount
//      D9 toEditorNode(node).stateCount === intent.stateEffects.length
//     D10 toEditorNode(node).status (default 'verified')
//     D11 toEditorNode(node).verificationScore (default 0.85)
//     D12 toEditorNode(node).visualSpec has primaryColor + font + radius
//     D13 toEditorNode(node).textContent matches intent.visualSpec.textContent
//         shape ({ text, role, renderMethod })
//     D14 toEditorNode(node).backendContract is non-null when backendRef is set
//     D15 toEditorNode(node).code is a non-empty string
//
//   E. Hub field reconciliation
//      E1 toEditorHub(hub).id === hub.hubId
//      E2 toEditorHub(hub).name === hub.title
//      E3 toEditorHub(hub).color is a non-empty hex string
//
//   F. Edge field reconciliation
//      F1 toEditorEdge(edge).source === edge.from
//      F2 toEditorEdge(edge).target === edge.to
//      F3 toEditorEdge(edge).type === edge.type
//      F4 toEditorEdge(edge).id is a non-empty string
//
//   G. Store auto-initializes from home-hub.json
//      G1 useGraphSourceStore source mentions home-hub.json (static import)
//      G2 store source mentions an init/eager call to load()
//
//   H. Loader-store integration: loadFromHomeHub on the actual JSON yields
//      40 nodes, 15 edges, 1 hub.
//      H1 toEditorView returns 40 editor-nodes + 15 edges + 1 hub.
//
//   I. TypeScript compile is clean (`npx tsc --noEmit`).
//
// Run: node tests/lib/prism-graph/T-EDIT-02.test.mjs

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const APP_ROOT = join(REPO_ROOT, 'kid-kode-landing');

const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', RESET = '\x1b[0m';
const failures = [];
function check(label, pass, detail = '') {
  const marker = pass ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`[${marker}] ${label}${detail ? `  ${DIM}${detail}${RESET}` : ''}`);
  if (!pass) failures.push({ label, detail });
}

const inspectorPath  = join(APP_ROOT, 'src', 'components', 'editor', 'panels', 'Inspector.tsx');
const graphScenePath = join(APP_ROOT, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx');
const mockGraphPath  = join(APP_ROOT, 'src', 'data', 'mockGraph.ts');
const viewModelPath  = join(APP_ROOT, 'src', 'lib', 'prism-graph', 'view-model.ts');
const loaderPath     = join(APP_ROOT, 'src', 'lib', 'prism-graph', 'loader.ts');
const storePath      = join(APP_ROOT, 'src', 'stores', 'useGraphSourceStore.ts');
const homeHubPath    = join(APP_ROOT, 'src', 'lib', 'prism', 'mock-app-source', 'hubs', 'home-hub.json');

// ── Phase A: editor data-source swap ────────────────────────────────────────

const inspectorSrc  = existsSync(inspectorPath)  ? readFileSync(inspectorPath, 'utf8')  : '';
const graphSceneSrc = existsSync(graphScenePath) ? readFileSync(graphScenePath, 'utf8') : '';

check('A1 — Inspector.tsx no longer imports from @/data/mockGraph',
  !/from\s+['"]@\/data\/mockGraph['"]/.test(inspectorSrc));
check('A2 — Inspector.tsx imports from @/stores/useGraphSourceStore',
  /from\s+['"]@\/stores\/useGraphSourceStore['"]/.test(inspectorSrc));
check('A3 — Inspector.tsx imports from @/lib/prism-graph/view-model',
  /from\s+['"]@\/lib\/prism-graph\/view-model['"]/.test(inspectorSrc));
check('A4 — GraphScene.tsx no longer imports from @/data/mockGraph',
  !/from\s+['"]@\/data\/mockGraph['"]/.test(graphSceneSrc));
check('A5 — GraphScene.tsx imports from @/stores/useGraphSourceStore',
  /from\s+['"]@\/stores\/useGraphSourceStore['"]/.test(graphSceneSrc));
check('A6 — GraphScene.tsx imports from @/lib/prism-graph/view-model',
  /from\s+['"]@\/lib\/prism-graph\/view-model['"]/.test(graphSceneSrc));

// ── Phase B: mockGraph.ts retained on disk ──────────────────────────────────

check('B1 — src/data/mockGraph.ts still on disk', existsSync(mockGraphPath));

// ── Phase C: view-model.ts gains the editor-view adapter ────────────────────

let viewModelMod;
try {
  viewModelMod = await import(pathToFileURL(viewModelPath).href);
} catch (e) {
  check('C0 — view-model.ts imports cleanly', false, e.message);
}

if (viewModelMod) {
  check('C0 — view-model.ts imports cleanly', true);
  check('C1 — view-model exports toEditorView',  typeof viewModelMod.toEditorView  === 'function');
  check('C2 — view-model exports toEditorNode',  typeof viewModelMod.toEditorNode  === 'function');
  check('C3 — view-model exports toEditorHub',   typeof viewModelMod.toEditorHub   === 'function');
  check('C4 — view-model exports toEditorEdge',  typeof viewModelMod.toEditorEdge  === 'function');
}

// ── Phase D-F: field reconciliation against home-hub.json ───────────────────

let loaderMod;
try {
  loaderMod = await import(pathToFileURL(loaderPath).href);
} catch (e) {
  check('D0 — loader.ts imports cleanly', false, e.message);
}

if (loaderMod && viewModelMod && typeof viewModelMod.toEditorView === 'function') {
  const homeHubJson = JSON.parse(readFileSync(homeHubPath, 'utf8'));
  const graph = await loaderMod.loadFromHomeHub(homeHubJson);
  const cta    = graph.nodes.find((n) => n.nodeId === 'hero-card-cta');
  const navLink = graph.nodes.find((n) => n.nodeId === 'navbar-link-home');
  const pageBg  = graph.nodes.find((n) => n.nodeId === 'page-background');
  const heroBg  = graph.nodes.find((n) => n.nodeId === 'hero-section-bg');
  const hub0    = graph.hubs[0];
  const edge0   = graph.edges[0];

  if (cta && hub0 && edge0) {
    const eCta    = viewModelMod.toEditorNode(cta);
    const eHub    = viewModelMod.toEditorHub(hub0);
    const eEdge   = viewModelMod.toEditorEdge(edge0);
    const eNav    = viewModelMod.toEditorNode(navLink);
    const ePageBg = viewModelMod.toEditorNode(pageBg);
    const eHero   = heroBg ? viewModelMod.toEditorNode(heroBg) : null;

    // D — node mapping
    check('D1 — toEditorNode(cta).id === "hero-card-cta"',
      eCta.id === 'hero-card-cta', `got: ${eCta.id}`);
    check('D2 — toEditorNode(cta).hubIds === ["home-hub"]',
      JSON.stringify(eCta.hubIds) === JSON.stringify(['home-hub']));
    check('D3 — toEditorNode(cta).caption matches intent.caption',
      typeof eCta.caption === 'string' && eCta.caption === cta.intent.caption);
    check('D4 — toEditorNode(cta).name === "Hero Card Cta"',
      eCta.name === 'Hero Card Cta', `got: ${eCta.name}`);
    check('D5 — toEditorNode(cta).elementType is a non-empty string',
      typeof eCta.elementType === 'string' && eCta.elementType.length > 0,
      `got: ${eCta.elementType}`);
    check('D6 — toEditorNode(cta).interactions are mapped to (event/action/target) triples',
      Array.isArray(eCta.interactions) &&
      eCta.interactions.length > 0 &&
      eCta.interactions.every((i) =>
        typeof i.event === 'string' &&
        typeof i.action === 'string' &&
        typeof i.target === 'string'));
    check('D7 — toEditorNode(cta).hasBackend === !!backendRef',
      eCta.hasBackend === !!cta.backendRef);
    check('D8 — toEditorNode(navLink).hasAnimation is a boolean',
      typeof eNav.hasAnimation === 'boolean');
    check('D9 — toEditorNode(cta).stateCount === intent.stateEffects.length',
      eCta.stateCount === (Array.isArray(cta.intent.stateEffects) ? cta.intent.stateEffects.length : 0),
      `got: ${eCta.stateCount}, expected: ${cta.intent.stateEffects?.length}`);
    check('D10 — toEditorNode(cta).status is one of the legacy statuses',
      ['verified', 'code_generated', 'image_ready', 'pending', 'failed'].includes(eCta.status),
      `got: ${eCta.status}`);
    check('D11 — toEditorNode(cta).verificationScore is a finite number',
      typeof eCta.verificationScore === 'number' && Number.isFinite(eCta.verificationScore));
    check('D12 — toEditorNode(cta).visualSpec has primaryColor + font + radius',
      typeof eCta.visualSpec?.primaryColor === 'string' &&
      typeof eCta.visualSpec?.font === 'string' &&
      typeof eCta.visualSpec?.radius === 'number');
    check('D13 — toEditorNode(navLink).textContent items have text/role/renderMethod',
      Array.isArray(eNav.textContent) &&
      eNav.textContent.every((t) =>
        typeof t.text === 'string' &&
        typeof t.role === 'string' &&
        typeof t.renderMethod === 'string'));
    check('D14 — toEditorNode(cta).backendContract is non-null (cta has backendRef)',
      eCta.backendContract !== null && eCta.backendContract !== undefined);
    check('D15 — toEditorNode(cta).code is a non-empty string',
      typeof eCta.code === 'string' && eCta.code.length > 0);

    // Page-background — no backend
    check('D14b — toEditorNode(pageBg).hasBackend === false (no backendRef)',
      ePageBg.hasBackend === false);
    if (eHero) {
      check('D8b — toEditorNode(hero-section-bg).hasAnimation === true (frameCount > 1)',
        eHero.hasAnimation === true);
    }

    // E — hub mapping
    check('E1 — toEditorHub(hub).id === hub.hubId',
      eHub.id === hub0.hubId, `got: ${eHub.id}`);
    check('E2 — toEditorHub(hub).name === hub.title',
      eHub.name === hub0.title, `got: ${eHub.name}`);
    check('E3 — toEditorHub(hub).color is a non-empty hex string',
      typeof eHub.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(eHub.color),
      `got: ${eHub.color}`);

    // F — edge mapping
    check('F1 — toEditorEdge(edge).source === edge.from',
      eEdge.source === edge0.from);
    check('F2 — toEditorEdge(edge).target === edge.to',
      eEdge.target === edge0.to);
    check('F3 — toEditorEdge(edge).type === edge.type',
      eEdge.type === edge0.type);
    check('F4 — toEditorEdge(edge).id is a non-empty string',
      typeof eEdge.id === 'string' && eEdge.id.length > 0);
  }
}

// ── Phase G: store auto-initializes from home-hub.json ──────────────────────

const storeSrc = existsSync(storePath) ? readFileSync(storePath, 'utf8') : '';
check('G1 — store imports the home-hub.json fixture',
  /home-hub\.json/.test(storeSrc));
check('G2 — store eagerly calls load() at module init',
  /useGraphSourceStore\.getState\(\)\.load\(/.test(storeSrc) ||
  /\.getState\(\)\s*\.\s*load\(/.test(storeSrc));

// ── Phase H: full toEditorView count check ──────────────────────────────────

if (loaderMod && viewModelMod && typeof viewModelMod.toEditorView === 'function') {
  const homeHubJson = JSON.parse(readFileSync(homeHubPath, 'utf8'));
  const graph = await loaderMod.loadFromHomeHub(homeHubJson);
  const editor = viewModelMod.toEditorView(graph);
  check('H1a — toEditorView(graph).nodes.length === 40',
    editor?.nodes?.length === 40, `got: ${editor?.nodes?.length}`);
  check('H1b — toEditorView(graph).edges.length === 15',
    editor?.edges?.length === 15, `got: ${editor?.edges?.length}`);
  check('H1c — toEditorView(graph).hubs.length === 1',
    editor?.hubs?.length === 1, `got: ${editor?.hubs?.length}`);
}

// ── Phase I: TypeScript compile is clean ────────────────────────────────────

const tsc = spawnSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], {
  cwd: APP_ROOT,
  encoding: 'utf8',
});
check('I1 — npx tsc --noEmit exits 0',
  tsc.status === 0,
  tsc.status === 0 ? '' : (tsc.stdout || '') + (tsc.stderr || '').slice(0, 1200));

// ──────────────────────────────────────────────────────────────────────────

console.log();
if (failures.length > 0) {
  console.log(`${RED}${failures.length} check(s) failed${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}T-EDIT-02: all checks passed${RESET}`);
}
