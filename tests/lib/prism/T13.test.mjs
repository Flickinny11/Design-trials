#!/usr/bin/env node
// T13 — Verify §10.22 + §10.23: components/editor/ tree + package.json
// deltas vs the pre-Prism baseline.
//
// Spec refs: §10.22 (extract L1215) — "All files in `components/editor/`
// except the replaced `MockApp.tsx` → `PrismHost.tsx` swap are byte-identical
// to before". §10.23 (L1217) — "`package.json` shows the new dependencies
// added, old ones removed".
//
// The spec references `MockApp.tsx`, but the actual pre-Prism tree for this
// codebase used `src/components/editor/preview/LivePreview.tsx` as the
// marketing-landing preview shell. Per CLAUDE.md ("src/components/editor/
// preview/ — replaced by src/components/prism-player/PrismHost.tsx"), the
// relocation swaps LivePreview (under editor/) → PrismHost (under
// prism-player/). The spec's MockApp→PrismHost language is interpreted
// through that mapping.
//
// Pre-Prism baseline: commit 9e72d15 "Migrate Prism Editor source from
// Vercel CLI deployment" — the last commit before the first Prism scaffold
// (8c58518 / 3f40748). `git show 9e72d15:kid-kode-landing/...` is the
// canonical source-of-truth; this test does not copy the baseline into
// tests/baseline/ because the git blob is already immutable and the extra
// round-trip adds no safety.
//
// Acceptance contract (24 checks):
//   A1 baseline commit reachable     B1-B2 MockApp→PrismHost relocation
//   A2 baseline editor tree = 11     B3.x 9 files byte-identical
//                                    B4 GraphScene delta = 3 ts-expect-error
//                                       lines replaced with whitespace, no
//                                       other edits
//                                    B5 current editor tree = 10 files, same
//                                       paths as baseline minus LivePreview
//   C1 html-to-image removed         C5 dev script prepends build:prism
//   C2 pixi.js + jszip added to deps C6 build script prepends build:prism
//   C3 prism build tools in devDeps  C7 start/lint scripts byte-identical
//   C4 new scripts (provision /
//      build:atlas / :msdf / :prism)
//   D1 baseline deps still present   D2 baseline devDeps still present

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// tests/lib/prism/T13.test.mjs → repo root
const REPO_ROOT = path.resolve(__dirname, '../../../');
const APP_ROOT = path.join(REPO_ROOT, 'kid-kode-landing');

const BASELINE_COMMIT = '9e72d15';
const BASELINE_PATH_PREFIX = 'kid-kode-landing';

// Pre-Prism src/components/editor/ tree at 9e72d15 — 11 files
const BASELINE_EDITOR_FILES = [
  'graph/GraphScene.tsx',
  'icons/Icon.tsx',
  'icons/IconPrimitives.ts',
  'overlays/DetailCard.tsx',
  'overlays/HubNav.tsx',
  'overlays/Minimap.tsx',
  'overlays/SearchPalette.tsx',
  'overlays/TopBar.tsx',
  'panels/ColorPicker.tsx',
  'panels/Inspector.tsx',
  'preview/LivePreview.tsx',
];

// Files expected to be untouched (byte-identical blob) vs pre-Prism baseline.
// graph/GraphScene.tsx is excluded because commit 1e1100f stripped 3
// `@ts-expect-error` directives — B4 locks that specific delta as the only
// permitted change.
// preview/LivePreview.tsx is excluded because §10.22's relocation removes it.
const UNCHANGED_FILES = BASELINE_EDITOR_FILES.filter(
  (f) => f !== 'graph/GraphScene.tsx' && f !== 'preview/LivePreview.tsx'
);

function gitShow(rev, repoRelPath) {
  return execSync(`git show ${rev}:${repoRelPath}`, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}
function gitShowBuf(rev, repoRelPath) {
  return execSync(`git show ${rev}:${repoRelPath}`, {
    cwd: REPO_ROOT,
    encoding: 'buffer',
  });
}
function sha256(x) {
  return crypto.createHash('sha256').update(x).digest('hex');
}

function diffLinesEq(base, cur) {
  const b = base.split('\n');
  const c = cur.split('\n');
  const out = {
    sameLength: b.length === c.length,
    baseLines: b.length,
    curLines: c.length,
    diffs: [],
  };
  if (!out.sameLength) return out;
  for (let i = 0; i < b.length; i++) {
    if (b[i] !== c[i]) out.diffs.push({ line: i + 1, base: b[i], cur: c[i] });
  }
  return out;
}

let passed = 0;
let failed = 0;
const failures = [];

function check(label, fn) {
  try {
    fn();
    console.log(`✓ ${label}`);
    passed++;
  } catch (e) {
    console.log(`✗ ${label}`);
    console.log(`  ${e.message}`);
    failed++;
    failures.push({ label, message: e.message });
  }
}

// ─── A. baseline accessibility ───────────────────────────────────────────
check('A1 baseline commit 9e72d15 is reachable as a git commit', () => {
  const type = execSync(`git cat-file -t ${BASELINE_COMMIT}`, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  }).trim();
  if (type !== 'commit') throw new Error(`expected "commit", got "${type}"`);
});

check('A2 baseline src/components/editor/ tree has exactly 11 files', () => {
  const raw = execSync(
    `git ls-tree -r ${BASELINE_COMMIT} -- ${BASELINE_PATH_PREFIX}/src/components/editor/`,
    { cwd: REPO_ROOT, encoding: 'utf8' }
  ).trim();
  const paths = raw
    .split('\n')
    .map((l) => l.split('\t')[1])
    .map((p) => p.replace(`${BASELINE_PATH_PREFIX}/src/components/editor/`, ''))
    .sort();
  const expected = [...BASELINE_EDITOR_FILES].sort();
  if (paths.length !== expected.length) {
    throw new Error(
      `expected ${expected.length} files, got ${paths.length}:\n${paths.join('\n')}`
    );
  }
  for (let i = 0; i < expected.length; i++) {
    if (paths[i] !== expected[i]) {
      throw new Error(
        `baseline editor tree divergence at index ${i}: expected "${expected[i]}", got "${paths[i]}"`
      );
    }
  }
});

// ─── B. §10.22 — components/editor/ byte-identity ────────────────────────
check('B1 preview/LivePreview.tsx has been removed from current tree', () => {
  const p = path.join(APP_ROOT, 'src/components/editor/preview/LivePreview.tsx');
  if (existsSync(p)) {
    throw new Error(
      `${p} still exists — §10.22 requires its removal (MockApp→PrismHost relocation)`
    );
  }
});

check('B2 PrismHost.tsx present at src/components/prism-player/', () => {
  const p = path.join(APP_ROOT, 'src/components/prism-player/PrismHost.tsx');
  if (!existsSync(p)) {
    throw new Error(
      `${p} missing — §7 (editor integration) requires PrismHost.tsx under prism-player/`
    );
  }
});

for (const f of UNCHANGED_FILES) {
  check(`B3.${f} byte-identical to baseline`, () => {
    const baseBuf = gitShowBuf(
      BASELINE_COMMIT,
      `${BASELINE_PATH_PREFIX}/src/components/editor/${f}`
    );
    const curBuf = readFileSync(path.join(APP_ROOT, 'src/components/editor', f));
    const bHash = sha256(baseBuf);
    const cHash = sha256(curBuf);
    if (bHash !== cHash) {
      throw new Error(
        `sha256 mismatch for ${f}: base=${bHash.slice(0, 16)}… current=${cHash.slice(0, 16)}…`
      );
    }
  });
}

check(
  'B4 GraphScene.tsx delta = exactly 3 @ts-expect-error lines replaced with whitespace',
  () => {
    const base = gitShow(
      BASELINE_COMMIT,
      `${BASELINE_PATH_PREFIX}/src/components/editor/graph/GraphScene.tsx`
    );
    const cur = readFileSync(
      path.join(APP_ROOT, 'src/components/editor/graph/GraphScene.tsx'),
      'utf8'
    );
    if (sha256(base) === sha256(cur)) {
      throw new Error(
        'GraphScene.tsx is byte-identical to baseline; this test assumes the documented 3-line ts-expect-error cleanup was applied (commit 1e1100f). If GraphScene is now truly unchanged, move it into UNCHANGED_FILES and delete this assertion.'
      );
    }
    const d = diffLinesEq(base, cur);
    if (!d.sameLength) {
      throw new Error(
        `line-count drift: baseline=${d.baseLines}, current=${d.curLines} — only in-place @ts-expect-error→blank replacements permitted`
      );
    }
    if (d.diffs.length !== 3) {
      throw new Error(
        `expected exactly 3 differing lines, got ${d.diffs.length}:\n${d.diffs
          .slice(0, 8)
          .map(
            (x) => `  L${x.line}: base="${x.base.trim()}" cur="${x.cur.trim()}"`
          )
          .join('\n')}`
      );
    }
    for (const diff of d.diffs) {
      if (!/@ts-expect-error/.test(diff.base)) {
        throw new Error(
          `line ${diff.line}: baseline content "${diff.base}" does not contain @ts-expect-error — un-whitelisted change`
        );
      }
      if (diff.cur.trim() !== '') {
        throw new Error(
          `line ${diff.line}: current content "${diff.cur}" is not whitespace-only — cleanup should blank out the directive, not replace it with new code`
        );
      }
    }
  }
);

check('B5 current src/components/editor/ tree = baseline minus LivePreview', () => {
  const raw = execSync('git ls-files src/components/editor/', {
    cwd: APP_ROOT,
    encoding: 'utf8',
  }).trim();
  const paths = raw
    .split('\n')
    .map((p) => p.replace('src/components/editor/', ''))
    .sort();
  const expected = BASELINE_EDITOR_FILES.filter(
    (f) => f !== 'preview/LivePreview.tsx'
  ).sort();
  if (paths.length !== expected.length) {
    throw new Error(
      `expected ${expected.length} files, got ${paths.length}:\n  expected: ${expected.join(
        ', '
      )}\n  actual:   ${paths.join(', ')}`
    );
  }
  for (let i = 0; i < expected.length; i++) {
    if (paths[i] !== expected[i]) {
      throw new Error(
        `editor tree divergence at index ${i}: expected "${expected[i]}", got "${paths[i]}"`
      );
    }
  }
});

// ─── C. §10.23 — package.json deltas ─────────────────────────────────────
const baseRaw = gitShow(BASELINE_COMMIT, `${BASELINE_PATH_PREFIX}/package.json`);
const basePkg = JSON.parse(baseRaw);
const curPkg = JSON.parse(
  readFileSync(path.join(APP_ROOT, 'package.json'), 'utf8')
);

check('C1 html-to-image removed (baseline had it; current has none)', () => {
  if (!/"html-to-image"/.test(baseRaw)) {
    throw new Error(
      'baseline package.json does not contain html-to-image — baseline choice is wrong'
    );
  }
  const inDeps = Object.keys(curPkg.dependencies || {}).includes('html-to-image');
  const inDev = Object.keys(curPkg.devDependencies || {}).includes('html-to-image');
  if (inDeps || inDev) {
    throw new Error(
      `html-to-image still listed in current package.json (deps=${inDeps}, devDeps=${inDev}) — §10.23 / §1.4.6 forbid the dependency`
    );
  }
});

check('C2 current dependencies add pixi.js + jszip (new vs baseline)', () => {
  const deps = curPkg.dependencies || {};
  for (const d of ['pixi.js', 'jszip']) {
    if (!deps[d]) throw new Error(`missing runtime dep: ${d}`);
    if ((basePkg.dependencies || {})[d]) {
      throw new Error(
        `baseline already had ${d} — not a new addition per §10.23`
      );
    }
  }
});

check(
  'C3 current devDependencies add @fal-ai/client, dotenv, ffmpeg-static, sharp, maxrects-packer, globby, msdf-bmfont-xml',
  () => {
    const dev = curPkg.devDependencies || {};
    const newDev = [
      '@fal-ai/client',
      'dotenv',
      'ffmpeg-static',
      'sharp',
      'maxrects-packer',
      'globby',
      'msdf-bmfont-xml',
    ];
    for (const d of newDev) {
      if (!dev[d]) throw new Error(`missing devDep: ${d}`);
      if ((basePkg.devDependencies || {})[d]) {
        throw new Error(
          `baseline already had devDep ${d} — not a new addition per §10.23`
        );
      }
    }
  }
);

check(
  'C4 new scripts added: provision-assets + build:atlas + build:msdf + build:prism',
  () => {
    const scripts = curPkg.scripts || {};
    for (const s of ['provision-assets', 'build:atlas', 'build:msdf', 'build:prism']) {
      if (!scripts[s]) throw new Error(`missing script: ${s}`);
      if ((basePkg.scripts || {})[s]) {
        throw new Error(
          `baseline already had script: ${s} — not a new addition per §8 / §10.23`
        );
      }
    }
  }
);

check(
  'C5 dev script prepends build:prism (per §8 execution order: build:prism && next dev)',
  () => {
    const dev = (curPkg.scripts || {}).dev || '';
    if (!/(npm run|pnpm run) build:prism\s*&&\s*next dev/.test(dev)) {
      throw new Error(
        `dev script does not prepend build:prism: "${dev}" (expected "<npm|pnpm> run build:prism && next dev")`
      );
    }
  }
);

check('C6 build script prepends build:prism', () => {
  const b = (curPkg.scripts || {}).build || '';
  if (!/(npm run|pnpm run) build:prism\s*&&\s*next build/.test(b)) {
    throw new Error(
      `build script does not prepend build:prism: "${b}" (expected "<npm|pnpm> run build:prism && next build")`
    );
  }
});

check('C7 start + lint scripts byte-identical to baseline', () => {
  const baseScripts = basePkg.scripts || {};
  const curScripts = curPkg.scripts || {};
  if (curScripts.start !== baseScripts.start) {
    throw new Error(
      `start drifted: base="${baseScripts.start}" cur="${curScripts.start}"`
    );
  }
  if (curScripts.lint !== baseScripts.lint) {
    throw new Error(
      `lint drifted: base="${baseScripts.lint}" cur="${curScripts.lint}"`
    );
  }
});

// ─── D. regression — baseline deps still present at same versions ────────
check(
  'D1 every baseline dependency (minus html-to-image) still present with matching version range',
  () => {
    for (const [d, ver] of Object.entries(basePkg.dependencies || {})) {
      if (d === 'html-to-image') continue;
      const cur = (curPkg.dependencies || {})[d];
      if (!cur) throw new Error(`baseline runtime dep dropped: ${d}`);
      if (cur !== ver) {
        throw new Error(
          `runtime dep ${d} version drift: base="${ver}" cur="${cur}"`
        );
      }
    }
  }
);

check(
  'D2 every baseline devDependency still present with matching version range',
  () => {
    for (const [d, ver] of Object.entries(basePkg.devDependencies || {})) {
      const cur = (curPkg.devDependencies || {})[d];
      if (!cur) throw new Error(`baseline devDep dropped: ${d}`);
      if (cur !== ver) {
        throw new Error(
          `devDep ${d} version drift: base="${ver}" cur="${cur}"`
        );
      }
    }
  }
);

// ─── summary ─────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  ✗ ${f.label}\n    ${f.message}`);
  }
  process.exit(1);
}
process.exit(0);
