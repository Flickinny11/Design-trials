#!/usr/bin/env node
// T-EDIT-06 — Phase 6 of the editor-integration plan: documentation update.
//
// Plan ref: /Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md §Phase 6
// (line 471): "Documentation: append a §'Editor view-model mapping' subsection
// to mockup-pipeline.md describing how Inspector tabs map to JSON fields, plus
// a progress entry in prism-mock-progress.md."
//
// Acceptance contract:
//
//   A. mockup-pipeline.md gains an "Editor view-model mapping" subsection.
//      A1 mockup-pipeline.md exists and is non-empty.
//      A2 A heading containing "Editor view-model mapping" is present.
//      A3 The new subsection links to view-model.ts (the accessor surface).
//      A4 The new subsection links to home-hub.json (the canonical schema).
//      A5 The new subsection links to Inspector.tsx (the consumer).
//      A6 The new subsection mentions all six Inspector tab IDs:
//         visual, behavior, code, animation, connections, backend.
//
//   B. The 6-row tab × accessor mapping table from plan Phase 1 is rendered.
//      B1 The subsection contains a markdown table whose rows describe
//         Visual, Behavior, Code, Animation, Connections (Links), Backend.
//      B2 The table cites view-model accessors: getCaption, getInteractions,
//         getAnimationSpec, getEdges, getBackendContract appear somewhere in
//         the new subsection.
//
//   C. Cross-links resolve on disk.
//      C1 view-model.ts exists.
//      C2 home-hub.json exists.
//      C3 Inspector.tsx exists.
//
//   D. Progress entry appended to prism-mock-progress.md.
//      D1 prism-mock-progress.md exists.
//      D2 The "## Ralph iterations" section contains an `iter 21` entry that
//         names T-EDIT-06.
//
// Run: node tests/lib/editor/T-EDIT-06.test.mjs

import { existsSync, readFileSync } from 'node:fs';
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

const pipelinePath  = join(APP_ROOT, 'notes', 'mockup-pipeline.md');
const progressPath  = join(APP_ROOT, 'notes', 'prism-mock-progress.md');
const viewModelPath = join(APP_ROOT, 'src', 'lib', 'prism-graph', 'view-model.ts');
const homeHubPath   = join(APP_ROOT, 'src', 'lib', 'prism', 'mock-app-source', 'hubs', 'home-hub.json');
const inspectorPath = join(APP_ROOT, 'src', 'components', 'editor', 'panels', 'Inspector.tsx');

const pipelineSrc = existsSync(pipelinePath) ? readFileSync(pipelinePath, 'utf8') : '';
const progressSrc = existsSync(progressPath) ? readFileSync(progressPath, 'utf8') : '';

// ── Phase A: new "Editor view-model mapping" subsection ─────────────────────

check('A1 — mockup-pipeline.md exists and is non-empty',
  pipelineSrc.length > 0);

check('A2 — heading containing "Editor view-model mapping" present',
  /^#{1,6}\s+.*Editor view-model mapping/im.test(pipelineSrc));

// Pull out the new subsection so subsequent checks scope to it. The section
// runs from its heading until the next top-level `## ` heading, the next
// horizontal rule on its own line, or end-of-file. (Subsection headings like
// `### 12.1` must NOT terminate the scope — they are part of it.)
const sectionMatch = pipelineSrc.match(
  /^##\s+[^\n]*Editor view-model mapping[\s\S]*?(?=\n##\s|\n---\s*\n|$(?![\s\S]))/im,
);
const sectionSrc = sectionMatch ? sectionMatch[0] : '';

check('A3 — subsection links to view-model.ts',
  /view-model\.ts/.test(sectionSrc));

check('A4 — subsection links to home-hub.json',
  /home-hub\.json/.test(sectionSrc));

check('A5 — subsection links to Inspector.tsx',
  /Inspector\.tsx/.test(sectionSrc));

const tabIds = ['visual', 'behavior', 'code', 'animation', 'connections', 'backend'];
for (const tab of tabIds) {
  // Match case-insensitively so either lowercase tab IDs or capitalized labels pass.
  check(`A6.${tab} — subsection mentions Inspector tab "${tab}"`,
    new RegExp(`\\b${tab}\\b`, 'i').test(sectionSrc));
}

// ── Phase B: the 6-row tab × accessor mapping table ─────────────────────────

const tableRows = ['Visual', 'Behavior', 'Code', 'Animation', 'Connections', 'Backend'];
for (const row of tableRows) {
  // Each tab name must appear in a markdown table cell context: `| Visual |`,
  // `| **Visual** |`, or `| **Visual** (\`visual\`) |` are all canonical. We
  // accept any leading `|`, optional bold/code wrapping, then the label, then
  // any cell content, then a closing `|` separator.
  const re = new RegExp(`\\|\\s*\\**\\s*${row}\\b[^\\n]*\\|`, 'i');
  check(`B1.${row} — table row for "${row}" present`,
    re.test(sectionSrc));
}

const accessors = [
  'getCaption',
  'getInteractions',
  'getAnimationSpec',
  'getEdges',
  'getBackendContract',
];
for (const acc of accessors) {
  check(`B2.${acc} — accessor "${acc}" cited in subsection`,
    new RegExp(`\\b${acc}\\b`).test(sectionSrc));
}

// ── Phase C: cross-links resolve on disk ────────────────────────────────────

check('C1 — view-model.ts exists at referenced path',
  existsSync(viewModelPath));

check('C2 — home-hub.json exists at referenced path',
  existsSync(homeHubPath));

check('C3 — Inspector.tsx exists at referenced path',
  existsSync(inspectorPath));

// ── Phase D: progress log entry ─────────────────────────────────────────────

check('D1 — prism-mock-progress.md exists and is non-empty',
  progressSrc.length > 0);

const ralphSectionMatch = progressSrc.match(/^##\s+Ralph iterations[\s\S]*?(?=\n## |\Z)/m);
const ralphSection = ralphSectionMatch ? ralphSectionMatch[0] : '';
check('D2 — Ralph iterations section contains an "iter 21" entry naming T-EDIT-06',
  /iter\s+21\b[^\n]*T-EDIT-06/i.test(ralphSection));

// ──────────────────────────────────────────────────────────────────────────

console.log();
if (failures.length > 0) {
  console.log(`${RED}${failures.length} check(s) failed${RESET}`);
  process.exit(1);
} else {
  console.log(`${GREEN}T-EDIT-06: all checks passed${RESET}`);
}
