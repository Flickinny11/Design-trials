#!/usr/bin/env node
// W-BAKE-B D4 — critic agreement metrics + the selection rule (unchanged):
// cheapest candidate with Spearman rank correlation >= 0.85 against the
// Fable-5 two-pass ground truth AND MUST-FIX detection >= 90%; if none
// qualifies, the tier is declared UNFILLED. MUST-FIX positives are
// high-confidence: defect present in BOTH ground-truth passes, or seeded
// known-bad.
//
// Output: notes/bakeoff-b/axis3-metrics.json

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './contestants-b.mjs';

const B = path.join(ROOT, 'notes', 'bakeoff-b');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const p50 = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

function spearman(xs, ys) {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const rank = (arr) => {
    const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const ranks = new Array(arr.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j += 1;
      const r = (i + j) / 2 + 1;
      for (let k = i; k <= j; k += 1) ranks[idx[k][1]] = r;
      i = j + 1;
    }
    return ranks;
  };
  const rx = rank(xs); const ry = rank(ys);
  const mx = mean(rx); const my = mean(ry);
  let num = 0; let dx = 0; let dy = 0;
  for (let i = 0; i < rx.length; i += 1) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return dx && dy ? num / Math.sqrt(dx * dy) : null;
}

const gt = readJson(path.join(B, 'judge', 'golden', 'ground-truth.json'));
const gtById = new Map(gt.rows.map((r) => [r.goldenId, r]));
const positives = gt.rows.filter((r) => r.seeded || (r.mustFixBothPasses ?? []).length > 0).map((r) => r.goldenId);

const criticsDir = path.join(B, 'judge', 'critics');
const critics = {};
for (const f of readdirSync(criticsDir).filter((x) => x.endsWith('.json'))) {
  const c = readJson(path.join(criticsDir, f));
  if (c.blocked) { critics[c.candidate] = { blocked: c.blocked }; continue; }
  const ok = c.verdicts.filter((v) => v.score != null && gtById.has(v.goldenId));
  const xs = ok.map((v) => gtById.get(v.goldenId).finalScore);
  const ys = ok.map((v) => v.score);
  const detected = positives.filter((gid) => {
    const v = c.verdicts.find((x) => x.goldenId === gid);
    return v && (v.mustFix ?? []).length > 0;
  });
  const seededRows = gt.rows.filter((r) => r.seeded);
  const seededDetected = seededRows.filter((r) => {
    const v = c.verdicts.find((x) => x.goldenId === r.goldenId);
    return v && (v.mustFix ?? []).length > 0;
  });
  critics[c.candidate] = {
    route: c.route, model: c.model,
    judgedRenders: ok.length,
    parseFailures: c.verdicts.filter((v) => v.error).length,
    rankCorrelation: spearman(xs, ys),
    mustFixDetectionRate: positives.length ? detected.length / positives.length : null,
    seededBadDetectionRate: seededRows.length ? seededDetected.length / seededRows.length : null,
    meanCostPerCritiqueUsd: mean(ok.map((v) => v.costUsd ?? 0)),
    p50LatencyMs: p50(ok.map((v) => v.latencyMs).filter((x) => typeof x === 'number')),
  };
}

const qualifying = Object.entries(critics)
  .filter(([, m]) => !m.blocked && (m.rankCorrelation ?? 0) >= 0.85 && (m.mustFixDetectionRate ?? 0) >= 0.9)
  .sort((a, b) => (a[1].meanCostPerCritiqueUsd ?? Infinity) - (b[1].meanCostPerCritiqueUsd ?? Infinity));

const out = {
  computedAt: new Date().toISOString(),
  groundTruthSelfDisagreement: gt.selfDisagreement,
  positivesInGoldenSet: positives.length,
  critics,
  selection: qualifying.length
    ? { selected: qualifying[0][0], rule: 'cheapest with rank correlation >= 0.85 AND MUST-FIX detection >= 90%' }
    : { selected: null, rule: 'cheapest with rank correlation >= 0.85 AND MUST-FIX detection >= 90%', verdict: 'UNFILLED — no candidate qualifies; escalation-tier critique stays on Fable/Opus' },
};
writeFileSync(path.join(B, 'axis3-metrics.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.selection));
console.log(`axis3-metrics.json written (${Object.keys(critics).length} candidates, ${positives.length} MUST-FIX positives)`);
