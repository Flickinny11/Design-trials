#!/usr/bin/env node
// W-VIS D7.4 — bundle preparer for the D7 lane runs (same pipeline as
// d1-bundles: fence-strip, dep pre-gate, esbuild ESM->CJS; /bakeoff-lab
// serves unchanged). Scans ALL runs for the model and emits bundles for any
// tag not yet bundled (idempotent across stages).
//
// Usage: node scripts/wvis/d7-bundles.mjs --model claude-sonnet-5

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, WVIS, extractModule, scanImports } from './wvis-lib.mjs';

const require_ = createRequire(import.meta.url);
const esbuild = require_(path.join(ROOT, 'node_modules', 'esbuild'));

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const MODEL = argOf('--model', null);
if (!MODEL) { console.error('need --model'); process.exit(2); }

const D7 = path.join(WVIS, 'd7');
const RUNS_DIR = path.join(D7, 'runs', MODEL);
const BUNDLES_ROOT = path.join(ROOT, 'notes', 'bakeoff', 'renders', 'bundles', 'wvis-d7', MODEL);
const CORPUS = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'visual', 'cases');
const cases = new Map(readdirSync(CORPUS).filter((f) => f.endsWith('.json'))
  .map((f) => { const c = JSON.parse(readFileSync(path.join(CORPUS, f), 'utf8')); return [c.caseId, c]; }));

mkdirSync(BUNDLES_ROOT, { recursive: true });
const index = [];
for (const f of readdirSync(RUNS_DIR).filter((x) => x.endsWith('.json')).sort()) {
  const rec = JSON.parse(readFileSync(path.join(RUNS_DIR, f), 'utf8'));
  if (!rec.ok) continue;
  const m = /^(.*)-r(\d+)\.json$/.exec(f);
  if (!m) continue;
  const caseId = m[1]; const run = Number(m[2]);
  const c = cases.get(caseId);
  if (!c) continue;
  const tag = `${caseId}-r${run}`;
  const ex = extractModule(rec.output);
  const bundle = { id: `wvis-d7/${MODEL}/${tag}`, contestant: MODEL, caseId, run, stage: rec.stage, node: c.node, sceneSpec: c.sceneSpec, parsed: ex.parsed, fenced: ex.fenced, depGate: { sources: [], violations: [] }, cjs: null, transformError: null };
  if (ex.parsed && ex.source) {
    bundle.depGate = scanImports(ex.source);
    try { bundle.cjs = esbuild.transformSync(ex.source, { format: 'cjs', loader: 'ts', target: 'es2022' }).code; }
    catch (err) { bundle.transformError = String(err?.message ?? err).slice(0, 400); }
  }
  writeFileSync(path.join(BUNDLES_ROOT, `${tag}.json`), JSON.stringify(bundle, null, 2));
  index.push({ id: bundle.id, contestant: MODEL, caseId, run, stage: rec.stage, renderable: Boolean(bundle.cjs), parsed: ex.parsed, fenced: ex.fenced, depViolations: bundle.depGate.violations, transformError: bundle.transformError });
}
index.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(path.join(D7, `bundles-index-${MODEL}.json`), JSON.stringify({ bundles: index }, null, 2));
console.log(`[d7-bundles ${MODEL}] ${index.length} bundles (${index.filter((b) => b.renderable).length} renderable)`);
