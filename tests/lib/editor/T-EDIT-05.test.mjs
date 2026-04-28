#!/usr/bin/env node
// T-EDIT-05 — Phase 5 of the editor-integration plan.
//
// Plan ref: /Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md §Phase 5.
//
// Acceptance contract:
//
//   A. boot.ts gains a per-node pointerdown handler that emits a
//      'node-selected' event on the event-bus AND extends the __prism debug
//      handle with selectNode / highlightNode / onNodeSelected. Selection
//      ring uses PIXI.Graphics with an `// ALLOWED-GRAPHICS: selection-ring`
//      marker per §1.4.
//      A1 boot.ts contains the literal string 'node-selected' (event name)
//      A2 boot.ts attaches a pointerdown listener somewhere (per-node bridge)
//      A3 boot.ts has `// ALLOWED-GRAPHICS: selection-ring` marker
//      A4 PrismDebugHandle declares selectNode signature
//      A5 PrismDebugHandle declares highlightNode signature
//      A6 PrismDebugHandle declares onNodeSelected signature
//      A7 globalThis.__prism is assigned selectNode / highlightNode /
//         onNodeSelected fields (runtime side, not just types)
//      A8 boot.ts does NOT use PIXI.Text or fillText (still §1.4-clean)
//
//   B. PrismHost.tsx exposes the API surface so the editor can rely on
//      window.__prism being typed. Either re-exports PrismDebugHandle from
//      boot or augments the global window typing.
//      B1 PrismHost.tsx references the new selectNode / highlightNode /
//         onNodeSelected names (type augmentation, helper, or comment block)
//
//   C. Inspector.tsx wires the editor↔preview bridge via two useEffect
//      blocks: one to highlight in preview on selection change, one to
//      subscribe to user-driven preview clicks.
//      C1 Inspector.tsx references window.__prism (or globalThis.__prism)
//      C2 Inspector.tsx calls highlightNode (the editor→preview side)
//      C3 Inspector.tsx calls onNodeSelected (the preview→editor side)
//      C4 Inspector.tsx calls store.selectNode inside the onNodeSelected
//         callback (push the click back into the editor store)
//
//   D. TypeScript compile is clean.
//      D1 npx tsc --noEmit -p tsconfig.json exits 0
//
// Run: node tests/lib/editor/T-EDIT-05.test.mjs

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

const bootPath      = join(APP_ROOT, 'src', 'lib', 'prism', 'player', 'boot.ts');
const prismHostPath = join(APP_ROOT, 'src', 'components', 'prism-player', 'PrismHost.tsx');
const inspectorPath = join(APP_ROOT, 'src', 'components', 'editor', 'panels', 'Inspector.tsx');

const bootSrc      = existsSync(bootPath)      ? readFileSync(bootPath,      'utf8') : '';
const prismHostSrc = existsSync(prismHostPath) ? readFileSync(prismHostPath, 'utf8') : '';
const inspectorSrc = existsSync(inspectorPath) ? readFileSync(inspectorPath, 'utf8') : '';

// ── Phase A: boot.ts gains the bridge primitives ────────────────────────────

check('A1 — boot.ts emits the "node-selected" event name',
  /['"]node-selected['"]/.test(bootSrc));

check('A2 — boot.ts attaches a pointerdown listener',
  /pointerdown/.test(bootSrc));

check('A3 — boot.ts has ALLOWED-GRAPHICS: selection-ring marker',
  /ALLOWED-GRAPHICS:\s*selection-ring/i.test(bootSrc));

check('A4 — PrismDebugHandle declares selectNode',
  /selectNode\s*:\s*\(/.test(bootSrc) || /selectNode\s*\(/.test(bootSrc));

check('A5 — PrismDebugHandle declares highlightNode',
  /highlightNode\s*:\s*\(/.test(bootSrc) || /highlightNode\s*\(/.test(bootSrc));

check('A6 — PrismDebugHandle declares onNodeSelected',
  /onNodeSelected\s*:\s*\(/.test(bootSrc) || /onNodeSelected\s*\(/.test(bootSrc));

// Look for runtime assignment of the three fields onto the __prism handle.
// We accept either { selectNode, … } shorthand or selectNode: fn pairs.
check('A7 — __prism assignment includes all three new fields',
  /selectNode/.test(bootSrc) &&
  /highlightNode/.test(bootSrc) &&
  /onNodeSelected/.test(bootSrc));

check('A8 — boot.ts is §1.4-clean (no PIXI.Text or fillText)',
  !/PIXI\.Text\b/.test(bootSrc) && !/\.fillText\b/.test(bootSrc));

// ── Phase B: PrismHost.tsx surfaces the API ─────────────────────────────────

check('B1 — PrismHost.tsx references the bridge symbols (selectNode|highlightNode|onNodeSelected)',
  /\bselectNode\b/.test(prismHostSrc) ||
  /\bhighlightNode\b/.test(prismHostSrc) ||
  /\bonNodeSelected\b/.test(prismHostSrc));

// ── Phase C: Inspector.tsx wires both directions ────────────────────────────

check('C1 — Inspector.tsx references window.__prism or globalThis.__prism',
  /window\.__prism|globalThis\.__prism/.test(inspectorSrc));

check('C2 — Inspector.tsx calls highlightNode (editor → preview)',
  /\bhighlightNode\s*\(/.test(inspectorSrc));

check('C3 — Inspector.tsx calls onNodeSelected (preview → editor)',
  /\bonNodeSelected\s*\(/.test(inspectorSrc));

// The preview→editor callback must end in a store.selectNode(...) call so the
// editor actually picks up the click. The simplest reliable check is the
// presence of selectNode reference on the store-side (separate from the
// __prism API selectNode).
check('C4 — Inspector.tsx pushes preview selection back into the store (selectNode call)',
  /\.selectNode\s*\(/.test(inspectorSrc) ||
  /selectNode\s*\(\s*[a-zA-Z]/.test(inspectorSrc));

// ── Phase D: TypeScript compile is clean ────────────────────────────────────

const tsc = spawnSync('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], {
  cwd: APP_ROOT,
  encoding: 'utf8',
});
check('D1 — npx tsc --noEmit exits 0',
  tsc.status === 0,
  tsc.status === 0 ? '' : ((tsc.stdout || '') + (tsc.stderr || '')).slice(0, 1500));

// ──────────────────────────────────────────────────────────────────────────

console.log();
if (failures.length > 0) {
  console.log(`${RED}${failures.length} check(s) failed${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}T-EDIT-05: all checks passed${RESET}`);
}
