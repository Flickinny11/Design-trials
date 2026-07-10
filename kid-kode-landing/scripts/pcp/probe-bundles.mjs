#!/usr/bin/env node
// W-PCP D6 — probe bundle preparer: raw probe generations → renderable
// bundles, same pipeline as W-BAKE prepare-axis2-bundles (fence-strip
// extraction, deterministic dependency pre-gate vs the allowlist, esbuild
// ESM→CJS transform). Bundles are written UNDER the bakeoff bundles dir
// (bundles/pcp-probe/<arm>--<contestant>/) so the existing dev-only
// /api/bakeoff/bundle route serves them with zero route changes; the probe
// index lives at notes/pcp-probe/bundles-index.json.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from '../bakeoff/contestants.mjs';

const require_ = createRequire(import.meta.url);
const esbuild = require_(path.join(ROOT, 'node_modules', 'esbuild'));

const PROBE = path.join(ROOT, 'notes', 'pcp-probe');
const VISUAL = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'visual');
const RUNS_DIR = path.join(PROBE, 'runs');
const BUNDLES_ROOT = path.join(ROOT, 'notes', 'bakeoff', 'renders', 'bundles', 'pcp-probe');

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

mkdirSync(BUNDLES_ROOT, { recursive: true });
const index = [];
for (const arm of readdirSync(RUNS_DIR)) {
  for (const cid of readdirSync(path.join(RUNS_DIR, arm))) {
    const lane = `${arm}--${cid}`;
    const outDir = path.join(BUNDLES_ROOT, lane);
    mkdirSync(outDir, { recursive: true });
    for (const f of readdirSync(path.join(RUNS_DIR, arm, cid)).filter((x) => x.endsWith('.json'))) {
      const rec = JSON.parse(readFileSync(path.join(RUNS_DIR, arm, cid, f), 'utf8'));
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
        id: `pcp-probe/${lane}/${tag}`,
        arm,
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
        id: bundle.id, arm, contestant: cid, caseId, run,
        renderable: Boolean(bundle.cjs),
        parsed: ex.parsed, fenced: ex.fenced,
        depViolations: bundle.depGate.violations,
        transformError: bundle.transformError,
      });
    }
  }
}
index.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(path.join(PROBE, 'bundles-index.json'), JSON.stringify({ bundles: index }, null, 2));
const renderable = index.filter((b) => b.renderable).length;
console.log(`prepared ${index.length} probe bundles (${renderable} renderable, ${index.length - renderable} unrenderable — scored artifacts)`);
