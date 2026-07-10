#!/usr/bin/env node
// W-BAKE — final aggregation: Axis 2 per-model design metrics, Axis 3 critic
// agreement + the selection rule (cheapest candidate with Spearman rank
// correlation >= 0.85 AND MUST-FIX detection >= 90%, else UNFILLED), and the
// merged cost ledger. Every number derives from committed artifacts (I-B3).
//
// Output: notes/bakeoff/aggregate.json + merged notes/bakeoff/ledger-merged.json

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './contestants.mjs';

const BAKE = path.join(ROOT, 'notes', 'bakeoff');

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const sd = (a) => {
  if (a.length < 2) return null;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};
const p50 = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(0.5 * (s.length - 1))]; };

function spearman(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const rank = (arr) => {
    const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const ranks = new Array(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j += 1;
      const r = (i + j) / 2 + 1;
      for (let k = i; k <= j; k += 1) ranks[idx[k][1]] = r;
      i = j + 1;
    }
    return ranks;
  };
  const rx = rank(xs); const ry = rank(ys);
  const mx = mean(rx); const my = mean(ry);
  let num = 0; let dx = 0; let dy = 0;
  for (let i = 0; i < n; i += 1) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : null;
}

const out = { aggregatedAt: new Date().toISOString() };

// ── Axis 2 per-model design metrics ─────────────────────────────────────────
const scoresPath = path.join(BAKE, 'judge', 'axis2', 'scores.json');
if (existsSync(scoresPath)) {
  const renders = readJson(scoresPath).renders.filter((r) => r.contestant !== 'seeded-bad');
  const cases = new Map(
    readdirSync(path.join(BAKE, 'corpus', 'visual', 'cases')).filter((f) => f.endsWith('.json')).map((f) => {
      const c = readJson(path.join(BAKE, 'corpus', 'visual', 'cases', f));
      return [c.caseId, c.category];
    }),
  );
  const byContestant = {};
  for (const cid of [...new Set(renders.map((r) => r.contestant))].sort()) {
    const rows = renders.filter((r) => r.contestant === cid);
    const scores = rows.map((r) => r.score).filter((x) => typeof x === 'number');
    const s3d = rows.filter((r) => cases.get(r.caseId) === '3d').map((r) => r.score);
    const s2d = rows.filter((r) => cases.get(r.caseId) === '2d').map((r) => r.score);
    byContestant[cid] = {
      renders: rows.length,
      meanScore: mean(scores), sdScore: sd(scores),
      mustFixRate: rows.filter((r) => (r.mustFix ?? []).length > 0).length / Math.max(1, rows.length),
      meanMustFixPerRender: mean(rows.map((r) => (r.mustFix ?? []).length)),
      noRenderCount: rows.filter((r) => !r.renderable).length,
      depGateViolations: rows.filter((r) => (r.mustFix ?? []).some((m) => m.defect === 'DEP_GATE_VIOLATION')).length,
      mean3d: mean(s3d), mean2d: mean(s2d),
      topDefects: Object.entries(rows.flatMap((r) => (r.mustFix ?? []).map((m) => m.defect))
        .reduce((acc, d) => { acc[d] = (acc[d] ?? 0) + 1; return acc; }, {}))
        .sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }
  out.axis2 = { byContestant };
}

// ── Axis 3 critic agreement + selection ─────────────────────────────────────
const gtPath = path.join(BAKE, 'judge', 'golden', 'ground-truth.json');
if (existsSync(gtPath)) {
  const gt = readJson(gtPath);
  const gtById = new Map(gt.rows.map((r) => [r.goldenId, r]));
  // MUST-FIX positives: high-confidence = defect present in BOTH ground-truth
  // passes, or the render is a seeded known-bad.
  const positives = gt.rows.filter((r) => r.seeded || (r.mustFixBothPasses ?? []).length > 0).map((r) => r.goldenId);
  const criticsDir = path.join(BAKE, 'judge', 'critics');
  const critics = {};
  if (existsSync(criticsDir)) {
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
      const seededDetected = gt.rows.filter((r) => r.seeded).filter((r) => {
        const v = c.verdicts.find((x) => x.goldenId === r.goldenId);
        return v && (v.mustFix ?? []).length > 0;
      });
      critics[c.candidate] = {
        judgedRenders: ok.length,
        parseFailures: c.verdicts.filter((v) => v.error).length,
        rankCorrelation: spearman(xs, ys),
        mustFixDetectionRate: positives.length ? detected.length / positives.length : null,
        seededBadDetectionRate: gt.rows.filter((r) => r.seeded).length
          ? seededDetected.length / gt.rows.filter((r) => r.seeded).length : null,
        meanCostPerCritiqueUsd: mean(ok.map((v) => v.costUsd ?? 0)),
        p50LatencyMs: p50(ok.map((v) => v.latencyMs).filter((x) => typeof x === 'number')),
      };
    }
  }
  // Selection rule (wave prompt #17).
  const qualifying = Object.entries(critics)
    .filter(([, m]) => !m.blocked && (m.rankCorrelation ?? 0) >= 0.85 && (m.mustFixDetectionRate ?? 0) >= 0.9)
    .sort((a, b) => (a[1].meanCostPerCritiqueUsd ?? Infinity) - (b[1].meanCostPerCritiqueUsd ?? Infinity));
  out.axis3 = {
    groundTruthSelfDisagreement: gt.selfDisagreement,
    positivesInGoldenSet: positives.length,
    critics,
    selection: qualifying.length
      ? { selected: qualifying[0][0], rule: 'cheapest with rank correlation >= 0.85 AND MUST-FIX detection >= 90%' }
      : { selected: null, rule: 'cheapest with rank correlation >= 0.85 AND MUST-FIX detection >= 90%', verdict: 'UNFILLED — no candidate qualifies; escalation-tier critique stays on Fable/Opus' },
  };
}

// ── Ledger merge ─────────────────────────────────────────────────────────────
const ledgers = ['ledger.json', 'ledger-axis2.json', 'ledger-judge.json', 'ledger-critics.json']
  .map((f) => path.join(BAKE, f)).filter((p) => existsSync(p)).map(readJson);
const calls = ledgers.flatMap((l) => l.calls ?? []);
const metered = calls.filter((c) => c.billing === 'metered').reduce((s, c) => s + (c.costUsd ?? 0), 0);
const subEq = calls.filter((c) => c.billing === 'subscription-equivalent').reduce((s, c) => s + (c.costUsd ?? 0), 0);
const merged = { wave: 'wbake', mergedAt: new Date().toISOString(), callCount: calls.length, totals: { meteredUsd: metered, subscriptionEquivalentUsd: subEq, totalUsd: metered + subEq }, calls };
writeFileSync(path.join(BAKE, 'ledger-merged.json'), JSON.stringify(merged, null, 2));
out.ledger = merged.totals;

writeFileSync(path.join(BAKE, 'aggregate.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ axis2: out.axis2 ? Object.keys(out.axis2.byContestant) : null, axis3: out.axis3?.selection ?? null, ledger: out.ledger }, null, 1));
