#!/usr/bin/env node
// W-VIS D1.4 — bundle preparer for D1 revision/control outputs. Identical
// pipeline to W-BAKEB bundles-b.mjs (fence-strip extraction, deterministic
// dep pre-gate vs the allowlist, esbuild ESM->CJS) so the dev-only
// /bakeoff-lab route serves the bundles unchanged.
//
// Bundles: notes/bakeoff/renders/bundles/wvis/<contestant>/<tag>.json
// Index:   notes/wvis/d1/bundles-index-<phase>.json
//
// Usage: node scripts/wvis/d1-bundles.mjs --phase iter1|iter2|control

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, WVIS, extractModule, scanImports } from './wvis-lib.mjs';

const require_ = createRequire(import.meta.url);
const esbuild = require_(path.join(ROOT, 'node_modules', 'esbuild'));

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PHASE = argOf('--phase', null);
if (!['iter1', 'iter2', 'control'].includes(PHASE)) { console.error('need --phase iter1|iter2|control'); process.exit(2); }

const D1 = path.join(WVIS, 'd1');
const RUNS_DIR = path.join(D1, 'runs', PHASE);
const BUNDLES_ROOT = path.join(ROOT, 'notes', 'bakeoff', 'renders', 'bundles', 'wvis');
const CORPUS = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'visual', 'cases');

const cases = new Map(readdirSync(CORPUS).filter((f) => f.endsWith('.json'))
  .map((f) => { const c = JSON.parse(readFileSync(path.join(CORPUS, f), 'utf8')); return [c.caseId, c]; }));

mkdirSync(BUNDLES_ROOT, { recursive: true });
const index = [];
let contestants = [];
try { contestants = readdirSync(RUNS_DIR).filter((d) => { try { return statSync(path.join(RUNS_DIR, d)).isDirectory(); } catch { return false; } }); } catch { contestants = []; }
for (const cid of contestants) {
  const outDir = path.join(BUNDLES_ROOT, cid);
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(path.join(RUNS_DIR, cid)).filter((x) => x.endsWith('.json'))) {
    const rec = JSON.parse(readFileSync(path.join(RUNS_DIR, cid, f), 'utf8'));
    if (!rec.ok) continue;
    const m = /^(.*)-r(\d+)\.json$/.exec(f);
    if (!m) continue;
    const caseId = m[1]; const run = Number(m[2]);
    const c = cases.get(caseId);
    if (!c) continue;
    const tag = `${caseId}-r${run}`;
    const ex = extractModule(rec.output);
    const bundle = { id: `wvis/${cid}/${tag}`, contestant: cid, caseId, run, phase: PHASE, arm: rec.arm ?? null, node: c.node, sceneSpec: c.sceneSpec, parsed: ex.parsed, fenced: ex.fenced, depGate: { sources: [], violations: [] }, cjs: null, transformError: null };
    if (ex.parsed && ex.source) {
      bundle.depGate = scanImports(ex.source);
      try { bundle.cjs = esbuild.transformSync(ex.source, { format: 'cjs', loader: 'ts', target: 'es2022' }).code; }
      catch (err) { bundle.transformError = String(err?.message ?? err).slice(0, 400); }
    }
    writeFileSync(path.join(outDir, `${tag}.json`), JSON.stringify(bundle, null, 2));
    index.push({ id: bundle.id, contestant: cid, caseId, run, phase: PHASE, arm: rec.arm ?? null, renderable: Boolean(bundle.cjs), parsed: ex.parsed, fenced: ex.fenced, depViolations: bundle.depGate.violations, transformError: bundle.transformError });
  }
}
index.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(path.join(D1, `bundles-index-${PHASE}.json`), JSON.stringify({ bundles: index }, null, 2));
const renderable = index.filter((b) => b.renderable).length;
console.log(`[d1-bundles ${PHASE}] ${index.length} bundles (${renderable} renderable, ${index.length - renderable} unrenderable — scored as rendered artifacts)`);
