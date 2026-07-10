#!/usr/bin/env node
// W-BAKE D3 — bundle preparer: raw Axis-2 generations → renderable bundles.
//
// Per output: (1) extract the module (fence-strip allowed, recorded);
// (2) DETERMINISTIC DEPENDENCY PRE-GATE (wave prompt #12): scan import/require
// sources against ALLOWED_IMPORT_SOURCES — any other source is an automatic
// MUST-FIX recorded against that model (render still judged); (3) esbuild
// transform ESM→CJS so /bakeoff-lab can execute it against the app's own
// bundled dependency instances.
//
// Outputs: notes/bakeoff/renders/bundles/<contestant>/<case>-r<n>.json
//          notes/bakeoff/renders/bundles/index.json

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './contestants.mjs';

const require_ = createRequire(import.meta.url);
const esbuild = require_(path.join(ROOT, 'node_modules', 'esbuild'));

const VISUAL = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'visual');
const RUNS_DIR = path.join(ROOT, 'notes', 'bakeoff', 'runs', 'axis2');
const BUNDLES_DIR = path.join(ROOT, 'notes', 'bakeoff', 'renders', 'bundles');

const ALLOWED = new Set(['three/webgpu', 'three/tsl', 'gsap', '@/primitives', '@/text']);

function extractModule(raw) {
  const t = (raw ?? '').trim();
  if (!t) return { parsed: false, source: null, fenced: false };
  if (!t.includes('```')) {
    const ok = t.includes('export default');
    return { parsed: ok, source: ok ? t : null, fenced: false };
  }
  const blocks = [...t.matchAll(/```(?:javascript|js|typescript|ts)?\s*\n([\s\S]*?)```/g)].map((m) => m[1]);
  const best = blocks.sort((a, b) => b.length - a.length)[0] ?? '';
  const ok = best.includes('export default');
  return { parsed: ok, source: ok ? best.trim() : null, fenced: true };
}

function scanImports(src) {
  const sources = new Set();
  for (const m of src.matchAll(/(?:import\s+[^'"]*?from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)) {
    sources.add(m[1]);
  }
  const violations = [...sources].filter((s) => !ALLOWED.has(s));
  return { sources: [...sources], violations };
}

const cases = new Map(
  readdirSync(path.join(VISUAL, 'cases'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const c = JSON.parse(readFileSync(path.join(VISUAL, 'cases', f), 'utf8'));
      return [c.caseId, c];
    }),
);

mkdirSync(BUNDLES_DIR, { recursive: true });
const index = [];
const contestants = existsSync(RUNS_DIR)
  ? readdirSync(RUNS_DIR).filter((d) => { try { return readdirSync(path.join(RUNS_DIR, d)).length > 0; } catch { return false; } })
  : [];
for (const cid of contestants) {
  const outDir = path.join(BUNDLES_DIR, cid);
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(path.join(RUNS_DIR, cid)).filter((x) => x.endsWith('.json'))) {
    const rec = JSON.parse(readFileSync(path.join(RUNS_DIR, cid, f), 'utf8'));
    if (!rec.ok) continue;
    const m = /^(.*)-r(\d+)\.json$/.exec(f);
    if (!m) continue;
    const caseId = m[1];
    const run = Number(m[2]);
    const c = cases.get(caseId);
    if (!c) continue;
    const tag = `${caseId}-r${run}`;
    const ex = extractModule(rec.output);
    const bundle = {
      id: `${cid}/${tag}`,
      contestant: cid,
      caseId,
      run,
      node: c.node,
      sceneSpec: c.sceneSpec,
      parsed: ex.parsed,
      fenced: ex.fenced,
      depGate: { sources: [], violations: [] },
      cjs: null,
      transformError: null,
    };
    if (ex.parsed && ex.source) {
      bundle.depGate = scanImports(ex.source);
      try {
        const out = esbuild.transformSync(ex.source, { format: 'cjs', loader: 'ts', target: 'es2022' });
        bundle.cjs = out.code;
      } catch (err) {
        bundle.transformError = String(err?.message ?? err).slice(0, 400);
      }
    }
    writeFileSync(path.join(outDir, `${tag}.json`), JSON.stringify(bundle, null, 2));
    index.push({
      id: bundle.id, contestant: cid, caseId, run,
      renderable: Boolean(bundle.cjs),
      parsed: ex.parsed, fenced: ex.fenced,
      depViolations: bundle.depGate.violations,
      transformError: bundle.transformError,
    });
  }
}
// Seeded-bad bundles (prepare-seeded-bad.mjs) always ride the index too.
const seededDir = path.join(BUNDLES_DIR, 'seeded-bad');
if (existsSync(seededDir)) {
  for (const f of readdirSync(seededDir).filter((x) => x.endsWith('.json'))) {
    const b = JSON.parse(readFileSync(path.join(seededDir, f), 'utf8'));
    index.push({ id: b.id, contestant: 'seeded-bad', caseId: b.caseId, run: b.run, renderable: Boolean(b.cjs), parsed: true, fenced: false, depViolations: [], transformError: null });
  }
}
index.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(path.join(BUNDLES_DIR, 'index.json'), JSON.stringify({ preparedAt: new Date().toISOString(), bundles: index }, null, 2));
const renderable = index.filter((b) => b.renderable).length;
console.log(`prepared ${index.length} bundles (${renderable} renderable, ${index.length - renderable} unrenderable — scored artifacts)`);
