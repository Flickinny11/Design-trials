#!/usr/bin/env node
// T-EDIT-03 — Phase 3 of the editor-integration plan.
//
// Plan ref: /Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md §Phase 3.
//
// Acceptance contract:
//
//   A. Store extensions — useGraphEditorStore gains hub-selection state
//      A1 selectedHubId field declared in the store interface
//      A2 selectHub action declared
//      A3 selectHub implementation sets selectedHubId AND clears selectedNodeId
//         AND opens inspector (mutual-exclusion + auto-open like selectNode)
//      A4 selectNode implementation clears selectedHubId (mutual exclusion)
//
//   B. HubInspector component — exists with correct shape
//      B1 src/components/editor/panels/HubInspector.tsx exists
//      B2 default-exports a React component
//      B3 reads selectedHubId from useGraphEditorStore
//      B4 reads from useGraphSourceStore (live home-hub.json source)
//      B5 renders the same six tab IDs as Inspector
//         (visual, behavior, code, animation, connections, backend)
//      B6 panel chrome mirrors Inspector — gradient bg, blur, INSPECTOR
//         tag, slide-in animation class
//      B7 Connections tab lists nodes whose parentHubId === hub.hubId
//         (clickable to switch selection back to a node)
//      B8 Visual tab references hub.layout AND hub.responsiveBreakpoints
//      B9 Code tab references manifest.json / artifactHash (read-only metadata)
//
//   C. RightPane wrapper — chooses Inspector vs HubInspector
//      C1 src/components/editor/panels/RightPane.tsx exists
//      C2 imports BOTH Inspector and HubInspector
//      C3 reads selectedNodeId AND selectedHubId from useGraphEditorStore
//      C4 page.tsx mounts RightPane (no longer mounts Inspector directly)
//
//   D. GraphScene HubHulls clickability
//      D1 GraphScene.tsx HubHulls accepts/uses selectHub from the store
//      D2 group has onClick / onPointerDown calling selectHub(hub.id)
//      D3 cursor:pointer feedback on hub hover (parallels GlassNode)
//
//   E. TypeScript compile clean
//      E1 npx tsc --noEmit exits 0
//
// Run: node tests/lib/editor/T-EDIT-03.test.mjs

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const storePath        = join(APP_ROOT, 'src', 'stores', 'useGraphEditorStore.ts');
const hubInspectorPath = join(APP_ROOT, 'src', 'components', 'editor', 'panels', 'HubInspector.tsx');
const rightPanePath    = join(APP_ROOT, 'src', 'components', 'editor', 'panels', 'RightPane.tsx');
const inspectorPath    = join(APP_ROOT, 'src', 'components', 'editor', 'panels', 'Inspector.tsx');
const graphScenePath   = join(APP_ROOT, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx');
const pagePath         = join(APP_ROOT, 'src', 'app', 'page.tsx');

const storeSrc        = existsSync(storePath)        ? readFileSync(storePath, 'utf8')        : '';
const hubInspectorSrc = existsSync(hubInspectorPath) ? readFileSync(hubInspectorPath, 'utf8') : '';
const rightPaneSrc    = existsSync(rightPanePath)    ? readFileSync(rightPanePath, 'utf8')    : '';
const graphSceneSrc   = existsSync(graphScenePath)   ? readFileSync(graphScenePath, 'utf8')   : '';
const pageSrc         = existsSync(pagePath)         ? readFileSync(pagePath, 'utf8')         : '';

// ── Phase A: useGraphEditorStore additions ─────────────────────────────────

check('A1 — store declares selectedHubId field',
  /selectedHubId\s*:\s*string\s*\|\s*null/.test(storeSrc));
check('A2 — store declares selectHub action',
  /selectHub\s*:\s*\(\s*\w+\s*:\s*string\s*\|\s*null\s*\)\s*=>\s*void/.test(storeSrc) ||
  /selectHub\s*:\s*\(\s*\w+\s*:\s*string\s*\)\s*=>\s*void/.test(storeSrc));
// A3: selectHub implementation should set selectedHubId, clear selectedNodeId, set inspectorOpen=true
const selectHubImplMatch = storeSrc.match(/selectHub\s*:\s*\([^)]*\)\s*=>\s*set\(\{[^}]+\}\)/);
const selectHubImpl = selectHubImplMatch ? selectHubImplMatch[0] : '';
check('A3 — selectHub sets selectedHubId, clears selectedNodeId, opens inspector',
  /selectedHubId\s*:/.test(selectHubImpl) &&
  /selectedNodeId\s*:\s*null/.test(selectHubImpl) &&
  /inspectorOpen\s*:\s*true/.test(selectHubImpl),
  selectHubImpl ? '' : 'no selectHub implementation found');
// A4: selectNode implementation should also clear selectedHubId
const selectNodeImplMatch = storeSrc.match(/selectNode\s*:\s*\([^)]*\)\s*=>\s*set\([^)]+\)/);
const selectNodeImpl = selectNodeImplMatch ? selectNodeImplMatch[0] : '';
check('A4 — selectNode clears selectedHubId (mutual exclusion)',
  /selectedHubId\s*:\s*null/.test(selectNodeImpl),
  selectNodeImpl ? '' : 'no selectNode implementation found');

// ── Phase B: HubInspector component ─────────────────────────────────────────

check('B1 — HubInspector.tsx exists',
  existsSync(hubInspectorPath));
check('B2 — HubInspector.tsx default-exports a component',
  /export\s+default\s+function\s+HubInspector/.test(hubInspectorSrc) ||
  /export\s+default\s+HubInspector/.test(hubInspectorSrc));
check('B3 — HubInspector reads selectedHubId from useGraphEditorStore',
  /selectedHubId/.test(hubInspectorSrc) &&
  /useGraphEditorStore/.test(hubInspectorSrc));
check('B4 — HubInspector reads from useGraphSourceStore',
  /useGraphSourceStore/.test(hubInspectorSrc));
const tabIds = ['visual', 'behavior', 'code', 'animation', 'connections', 'backend'];
const allTabs = tabIds.every((id) => new RegExp(`['"]${id}['"]`).test(hubInspectorSrc));
check('B5 — HubInspector references all six tab IDs',
  allTabs);
check('B6 — HubInspector panel chrome mirrors Inspector (INSPECTOR tag + slide-in)',
  /INSPECTOR/.test(hubInspectorSrc) &&
  /animate-slide-in-r/.test(hubInspectorSrc) &&
  /backdropFilter/.test(hubInspectorSrc));
check('B7 — Connections tab references parentHubId filter',
  /parentHubId/.test(hubInspectorSrc));
check('B8 — Visual tab references hub.layout + responsiveBreakpoints',
  /\blayout\b/.test(hubInspectorSrc) &&
  /responsiveBreakpoints/.test(hubInspectorSrc));
check('B9 — Code tab references artifactHash / manifest metadata',
  /artifactHash|manifest/i.test(hubInspectorSrc));

// ── Phase C: RightPane wrapper ──────────────────────────────────────────────

check('C1 — RightPane.tsx exists',
  existsSync(rightPanePath));
check('C2 — RightPane imports both Inspector and HubInspector',
  /import\s+Inspector\s+from\s+['"][^'"]*Inspector['"]/.test(rightPaneSrc) &&
  /import\s+HubInspector\s+from\s+['"][^'"]*HubInspector['"]/.test(rightPaneSrc));
check('C3 — RightPane reads both selection IDs',
  /selectedNodeId/.test(rightPaneSrc) &&
  /selectedHubId/.test(rightPaneSrc));
check('C4 — page.tsx mounts RightPane (replaces direct Inspector mount)',
  /import\s+RightPane\s+from\s+['"][^'"]*RightPane['"]/.test(pageSrc) &&
  /<RightPane\b/.test(pageSrc));

// ── Phase D: GraphScene HubHulls clickability ───────────────────────────────

// D1+D2: HubHulls now uses selectHub.
// Look only inside the HubHulls function body to avoid GlassNode confusing the regex.
const hubHullsMatch = graphSceneSrc.match(/function\s+HubHulls\s*\(\s*\{[\s\S]*?^\}\s*$/m);
const hubHullsBody = hubHullsMatch ? hubHullsMatch[0] : '';
check('D1 — HubHulls body references selectHub',
  /selectHub/.test(hubHullsBody),
  hubHullsBody ? '' : 'HubHulls function body not located');
check('D2 — HubHulls hub group has onClick or onPointerDown calling selectHub',
  /(onClick|onPointerDown)\s*=\s*\{[^}]*selectHub\(/.test(hubHullsBody));
check('D3 — HubHulls hover sets cursor:pointer (UX feedback)',
  /cursor\s*=\s*['"]pointer['"]/.test(hubHullsBody) ||
  /cursor:\s*['"]pointer['"]/.test(hubHullsBody));

// ── Phase E: TypeScript compile is clean ───────────────────────────────────

const tsc = spawnSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], {
  cwd: APP_ROOT,
  encoding: 'utf8',
});
check('E1 — npx tsc --noEmit exits 0',
  tsc.status === 0,
  tsc.status === 0 ? '' : ((tsc.stdout || '') + (tsc.stderr || '')).slice(0, 1500));

// ──────────────────────────────────────────────────────────────────────────

console.log();
if (failures.length > 0) {
  console.log(`${RED}${failures.length} check(s) failed${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}T-EDIT-03: all checks passed${RESET}`);
}
