#!/usr/bin/env node
// W-BAKE-B Axis 2 — design bundle preparer. Raw design generations
// (notes/bakeoff-b/runs/design/<contestant>/) → renderable bundles, same
// pipeline as W-PCP probe-bundles / W-BAKE prepare-axis2-bundles: fence-strip
// extraction, deterministic dependency pre-gate vs the allowlist (D3 item 6 —
// violations recorded, render still judged), esbuild ESM→CJS transform.
// Bundles land under notes/bakeoff/renders/bundles/wbakeb/<contestant>/ so the
// dev-only /bakeoff-lab bundle route serves them unchanged; index at
// notes/bakeoff-b/bundles-index.json (lane = contestant, no arm).

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './contestants-b.mjs';

const require_ = createRequire(import.meta.url);
const esbuild = require_(path.join(ROOT, 'node_modules', 'esbuild'));

const B = path.join(ROOT, 'notes', 'bakeoff-b');
const VISUAL = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'visual');
const RUNS_DIR = path.join(B, 'runs', 'design');
const BUNDLES_ROOT = path.join(ROOT, 'notes', 'bakeoff', 'renders', 'bundles', 'wbakeb');

const ALLOWED = new Set(['three/webgpu', 'three/tsl', 'gsap', '@/primitives', '@/text']);

function extractModule(raw) {
  const t = (raw ?? '').trim();
  if (!t) return { parsed: false, source: null, fenced: false };
  if (!t.includes('```')) { const ok = t.includes('export default'); return { parsed: ok, source: ok ? t : null, fenced: false }; }
  const blocks = [...t.matchAll(/```(?:javascript|js|typescript|ts)?\s*\n([\s\S]*?)```/g)].map((m) => m[1]);
  const best = blocks.sort((a, b) => b.length - a.length)[0] ?? '';
  const ok = best.includes('export default');
  return { parsed: ok, source: ok ? best.trim() : null, fenced: true };
}
function scanImports(src) {
  const sources = new Set();
  for (const m of src.matchAll(/(?:import\s+[^'"]*?from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)) sources.add(m[1]);
  return { sources: [...sources], violations: [...sources].filter((s) => !ALLOWED.has(s)) };
}

const cases = new Map(readdirSync(path.join(VISUAL, 'cases')).filter((f) => f.endsWith('.json'))
  .map((f) => { const c = JSON.parse(readFileSync(path.join(VISUAL, 'cases', f), 'utf8')); return [c.caseId, c]; }));

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
    const bundle = { id: `wbakeb/${cid}/${tag}`, contestant: cid, caseId, run, node: c.node, sceneSpec: c.sceneSpec, parsed: ex.parsed, fenced: ex.fenced, depGate: { sources: [], violations: [] }, cjs: null, transformError: null };
    if (ex.parsed && ex.source) {
      bundle.depGate = scanImports(ex.source);
      try { bundle.cjs = esbuild.transformSync(ex.source, { format: 'cjs', loader: 'ts', target: 'es2022' }).code; }
      catch (err) { bundle.transformError = String(err?.message ?? err).slice(0, 400); }
    }
    writeFileSync(path.join(outDir, `${tag}.json`), JSON.stringify(bundle, null, 2));
    index.push({ id: bundle.id, contestant: cid, caseId, run, renderable: Boolean(bundle.cjs), parsed: ex.parsed, fenced: ex.fenced, depViolations: bundle.depGate.violations, transformError: bundle.transformError });
  }
}
index.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(path.join(B, 'bundles-index.json'), JSON.stringify({ bundles: index }, null, 2));
const renderable = index.filter((b) => b.renderable).length;
console.log(`prepared ${index.length} wbakeb design bundles (${renderable} renderable, ${index.length - renderable} unrenderable — scored artifacts)`);
