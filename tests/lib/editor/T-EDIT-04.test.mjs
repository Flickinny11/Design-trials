#!/usr/bin/env node
// T-EDIT-04 — Phase 4 of the editor-integration plan.
//
// Plan ref: /Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md §Phase 4.
//
// Acceptance contract:
//
//   A. populate-element-images.ts — boot module that loads the atlas at
//      editor start and dispatches captured per-node images into
//      useElementImageStore.setImages(...). Lights up the GlassNode inner
//      sphere texture path the editor was already wired for.
//      A1 src/lib/editor/populate-element-images.ts exists
//      A2 exports a function `populateElementImages` (default or named)
//      A3 references the atlas-regions.json filename
//      A4 references the atlas-0.avif filename
//      A5 imports the element image store (useElementImageStore)
//      A6 calls setImages(...) on the store
//      A7 uses an HTMLCanvasElement and drawImage to extract regions
//
//   B. The boot module is invoked at editor start (page-level useEffect).
//      B1 src/app/page.tsx references populateElementImages
//      B2 page.tsx mounts the call inside a useEffect
//
//   C. HubLabels.tsx — new component renders hub.title as a 3D label
//      modeled on NodeLabels.
//      C1 src/components/editor/graph/HubLabels.tsx exists
//      C2 default-exports a React component named HubLabels
//      C3 reads hubs from useGraphSourceStore OR receives them as a prop
//      C4 references hub.title (or hub.name) — the rendered text
//      C5 uses Three's Sprite/CanvasTexture pipeline (sprite + canvas-rendered
//         text) — same vocabulary as NodeLabels
//
//   D. GraphScene.tsx upgrades — HubHulls now carries the mockup texture,
//      MeshPhysicalMaterial, brighter glow; HubLabels mounts in the scene.
//      D1 imports HubLabels
//      D2 mounts <HubLabels ... /> inside SceneContent
//      D3 HubHulls function body references MeshPhysicalMaterial (the new
//         hub material — different IOR / transmission / clearcoat / emissive)
//      D4 HubHulls function body references CanvasTexture (mockup image
//         wrapped on the inner sphere)
//      D5 HubHulls function body references the mockup filename
//         'scifi-mockup-v1.png' (loaded via fetch + Image + canvas)
//      D6 HubHulls function body references at least one of: transmission,
//         clearcoat, ior — the upgraded material vocabulary
//      D7 HubHulls function body bumps point-light intensity (modest glow
//         increase) — the active intensity is > 1.6 (was 1.6 before)
//
//   E. TypeScript compile is clean.
//      E1 npx tsc --noEmit -p tsconfig.json exits 0
//
// Run: node tests/lib/editor/T-EDIT-04.test.mjs

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

const populatePath  = join(APP_ROOT, 'src', 'lib', 'editor', 'populate-element-images.ts');
const hubLabelsPath = join(APP_ROOT, 'src', 'components', 'editor', 'graph', 'HubLabels.tsx');
const graphScenePath = join(APP_ROOT, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx');
const pagePath = join(APP_ROOT, 'src', 'app', 'page.tsx');

const populateSrc  = existsSync(populatePath)  ? readFileSync(populatePath,  'utf8') : '';
const hubLabelsSrc = existsSync(hubLabelsPath) ? readFileSync(hubLabelsPath, 'utf8') : '';
const graphSceneSrc = existsSync(graphScenePath) ? readFileSync(graphScenePath, 'utf8') : '';
const pageSrc = existsSync(pagePath) ? readFileSync(pagePath, 'utf8') : '';

// ── Phase A: populate-element-images.ts ─────────────────────────────────────

check('A1 — populate-element-images.ts exists',
  existsSync(populatePath));
check('A2 — exports populateElementImages function',
  /export\s+(default\s+)?(async\s+)?function\s+populateElementImages\b/.test(populateSrc) ||
  /export\s+const\s+populateElementImages\s*=/.test(populateSrc) ||
  /export\s+\{[^}]*\bpopulateElementImages\b[^}]*\}/.test(populateSrc));
check('A3 — references atlas-regions.json',
  /atlas-regions\.json/.test(populateSrc));
check('A4 — references atlas-0.avif',
  /atlas-0\.avif/.test(populateSrc));
check('A5 — imports useElementImageStore',
  /useElementImageStore/.test(populateSrc) &&
  /from\s+['"][^'"]*useElementImageStore['"]/.test(populateSrc));
check('A6 — calls setImages on the store',
  /setImages\s*\(/.test(populateSrc));
check('A7 — uses canvas + drawImage to extract regions',
  /createElement\(['"]canvas['"]\)/.test(populateSrc) &&
  /drawImage\s*\(/.test(populateSrc));

// ── Phase B: populate is invoked at editor boot ─────────────────────────────

check('B1 — page.tsx references populateElementImages',
  /populateElementImages/.test(pageSrc));
check('B2 — page.tsx mounts the call inside useEffect',
  /useEffect\([^]*?populateElementImages\(/m.test(pageSrc));

// ── Phase C: HubLabels.tsx ──────────────────────────────────────────────────

check('C1 — HubLabels.tsx exists',
  existsSync(hubLabelsPath));
check('C2 — HubLabels default-exports a React component',
  /export\s+default\s+function\s+HubLabels/.test(hubLabelsSrc) ||
  /export\s+default\s+HubLabels/.test(hubLabelsSrc));
check('C3 — HubLabels reads hubs (store or prop)',
  /useGraphSourceStore/.test(hubLabelsSrc) ||
  /hubs\s*:\s*[A-Za-z]/.test(hubLabelsSrc) ||
  /hubs\s*\}\s*:/.test(hubLabelsSrc));
check('C4 — HubLabels renders hub title text',
  /hub\.title\b/.test(hubLabelsSrc) || /hub\.name\b/.test(hubLabelsSrc));
check('C5 — HubLabels uses Three Sprite + CanvasTexture vocabulary',
  /Sprite\b/.test(hubLabelsSrc) &&
  /CanvasTexture\b/.test(hubLabelsSrc));

// ── Phase D: GraphScene HubHulls upgrades + HubLabels mount ─────────────────

check('D1 — GraphScene imports HubLabels',
  /import\s+HubLabels\s+from\s+['"][^'"]*HubLabels['"]/.test(graphSceneSrc));
check('D2 — GraphScene mounts <HubLabels',
  /<HubLabels\b/.test(graphSceneSrc));

// Look only inside the HubHulls function body to avoid GlassNode confusing the regex.
const hubHullsMatch = graphSceneSrc.match(/function\s+HubHulls\s*\(\s*\{[\s\S]*?^\}\s*$/m);
const hubHullsBody = hubHullsMatch ? hubHullsMatch[0] : '';

check('D3 — HubHulls body uses MeshPhysicalMaterial (or meshPhysicalMaterial JSX)',
  /MeshPhysicalMaterial|meshPhysicalMaterial/.test(hubHullsBody),
  hubHullsBody ? '' : 'HubHulls function body not located');
check('D4 — HubHulls body references CanvasTexture (mockup wrapping)',
  /CanvasTexture/.test(hubHullsBody));
check('D5 — HubHulls body references mockup filename scifi-mockup-v1.png',
  /scifi-mockup-v1\.png/.test(hubHullsBody));
check('D6 — HubHulls body uses transmission/clearcoat/ior material vocabulary',
  /transmission|clearcoat|ior/.test(hubHullsBody));

// D7: brighter active glow. Old code: `intensity={isActive ? 1.6 : 0.6}`.
// Plan says "bump existing pointLight intensity up modestly" — accept any
// active value strictly greater than 1.6. The test parses pointLight blocks
// inside HubHulls.
const pointLightActiveMatch = hubHullsBody.match(/intensity\s*=\s*\{\s*isActive\s*\?\s*([0-9.]+)\s*:\s*[0-9.]+\s*\}/);
const activeIntensity = pointLightActiveMatch ? parseFloat(pointLightActiveMatch[1]) : NaN;
check('D7 — HubHulls active pointLight intensity bumped (> 1.6)',
  Number.isFinite(activeIntensity) && activeIntensity > 1.6,
  pointLightActiveMatch ? `active intensity = ${activeIntensity}` : 'no isActive intensity ternary found');

// ── Phase E: TypeScript compile is clean ────────────────────────────────────

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
  console.log(`${GREEN}T-EDIT-04: all checks passed${RESET}`);
}
