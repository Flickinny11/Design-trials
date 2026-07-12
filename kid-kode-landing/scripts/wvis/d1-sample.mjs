#!/usr/bin/env node
// W-VIS D1.1 — deterministic stratified sampler over the W-BAKEB judged
// renders (notes/bakeoff-b/judge/scores.json).
//
// Pool: renderable failing renders (score < 85, parsed + esbuild-transformed —
// runtime crashes STAY in the pool; parse/transform failures are excluded and
// disclosed: those are a format problem D6 addresses, not a see-then-revise
// problem). 6 per model x 10 models = 60 (per-model cap 12 respected).
//
// Stratification ("tiers" in the wave prompt is implemented as SCORE BANDS —
// the frozen visual corpus carries no functional tier field, only category
// 2d/3d; disclosed in the report): round-robin over (band x category) cells
// in sha256 order, at most ONE render per (model, case) pair (avoids
// iteration-tag collisions and widens case coverage).
//
// Control arm: 20 of the sampled renders (2 per model, sha order) get a
// fresh best-of-2 blind resample with NO feedback.
//
// Output: notes/wvis/d1/sample.json (render refs + critiques + arm labels).

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { ROOT, WVIS, extractModule } from './wvis-lib.mjs';

const B = path.join(ROOT, 'notes', 'bakeoff-b');
const D1 = path.join(WVIS, 'd1');
mkdirSync(D1, { recursive: true });

const SALT = 'wvis-d1-2026-07-11';
const sha = (s) => createHash('sha256').update(s).digest('hex');

const CASES_3D = new Set(['v-01', 'v-02', 'v-03', 'v-04', 'v-05', 'v-06', 'v-07', 'v-08']);
const cat = (caseId) => (CASES_3D.has(caseId.slice(0, 4)) ? '3d' : '2d');
const band = (score) => (score < 30 ? 0 : score < 60 ? 1 : 2);

// Live-probed arm classification (notes/wvis/probes/vision-support-openrouter.json probe2).
const VISION_ARM = new Set(['claude-fable-5', 'claude-opus-4.8', 'claude-sonnet-5', 'claude-haiku-4.5', 'gemini-3.5-flash', 'kimi-k2.7-code']);

const scores = JSON.parse(readFileSync(path.join(B, 'judge', 'scores.json'), 'utf8')).renders;
const pool = scores.filter((r) => r.renderable && r.score < 85);

const PER_MODEL = 6;
const models = [...new Set(pool.map((r) => r.contestant))].sort();

const sample = [];
const excludedUnrenderable = scores.length - pool.length - scores.filter((r) => r.score >= 85).length;

for (const model of models) {
  const eligible = pool.filter((r) => r.contestant === model)
    .sort((a, b) => sha(a.bundleId + SALT).localeCompare(sha(b.bundleId + SALT)));
  const usedCases = new Set();
  const picked = [];
  // Round-robin over band x category cells for coverage.
  const cells = [];
  for (const bnd of [0, 1, 2]) for (const c of ['3d', '2d']) cells.push({ bnd, c });
  let guard = 0;
  while (picked.length < PER_MODEL && guard < 100) {
    let progress = false;
    for (const cell of cells) {
      if (picked.length >= PER_MODEL) break;
      const hit = eligible.find((r) => !usedCases.has(r.caseId) && band(r.score) === cell.bnd && cat(r.caseId) === cell.c && !picked.includes(r));
      if (hit) { picked.push(hit); usedCases.add(hit.caseId); progress = true; }
    }
    if (!progress) break;
    guard += 1;
  }
  // Fill shortfall with any unused-case render in sha order.
  for (const r of eligible) {
    if (picked.length >= PER_MODEL) break;
    if (!usedCases.has(r.caseId)) { picked.push(r); usedCases.add(r.caseId); }
  }
  for (const r of picked) {
    const runFile = path.join(B, 'runs', 'design', model, `${r.tag}.json`);
    const framePng = path.join(B, 'frames', model, `${r.tag}.png`);
    if (!existsSync(runFile) || !existsSync(framePng)) { console.error(`!! missing artifact for ${r.bundleId} — skipped`); continue; }
    const rec = JSON.parse(readFileSync(runFile, 'utf8'));
    const ex = extractModule(rec.output);
    if (!ex.parsed || !ex.source) { console.error(`!! ${r.bundleId} marked renderable but module not extractable — skipped`); continue; }
    sample.push({
      bundleId: r.bundleId, contestant: model, caseId: r.caseId, sourceTag: r.tag,
      sourceRun: Number(/-r(\d+)$/.exec(r.tag)[1]),
      category: cat(r.caseId), scoreBand: band(r.score),
      originalScore: r.score, mustFix: r.mustFix, judgeNotes: r.notes,
      moduleRuntimeError: r.moduleRuntimeError ?? null,
      arm: VISION_ARM.has(model) ? 'vision' : 'text-critique-only',
      framePath: path.relative(ROOT, framePng),
      runFile: path.relative(ROOT, runFile),
    });
  }
}

// Control-arm picks: 2 per model, sha order over the sampled set.
const control = [];
for (const model of models) {
  const mine = sample.filter((s) => s.contestant === model)
    .sort((a, b) => sha(a.bundleId + SALT + 'control').localeCompare(sha(b.bundleId + SALT + 'control')));
  control.push(...mine.slice(0, 2).map((s) => s.bundleId));
}

const summary = {};
for (const s of sample) {
  summary[s.contestant] = summary[s.contestant] ?? { n: 0, bands: [0, 0, 0], cats: { '3d': 0, '2d': 0 }, arm: s.arm };
  summary[s.contestant].n += 1;
  summary[s.contestant].bands[s.scoreBand] += 1;
  summary[s.contestant].cats[s.category] += 1;
}

writeFileSync(path.join(D1, 'sample.json'), JSON.stringify({
  sampledAt: new Date().toISOString(), salt: SALT,
  poolRule: 'judged renders with renderable=true AND score<85 (runtime crashes included; parse/transform failures excluded — format problem, disclosed)',
  stratification: 'round-robin over (score band [0-29|30-59|60-84] x category [3d|2d]) in sha256(bundleId+salt) order; max 1 render per (model,case)',
  poolSize: pool.length, perModel: PER_MODEL,
  sample, controlBundleIds: control, summary,
}, null, 2));

console.log(`sampled ${sample.length} renders across ${models.length} models; control arm ${control.length}`);
for (const [m, v] of Object.entries(summary)) console.log(`  ${m}: n=${v.n} bands=${v.bands.join('/')} 3d/2d=${v.cats['3d']}/${v.cats['2d']} arm=${v.arm}`);
