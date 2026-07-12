#!/usr/bin/env node
// W-VIS D1.6 — convergence metrics: delta-score per iteration per model
// class, % reaching >=85 within 1 and within 2 iterations, loop arm vs
// no-feedback best-of-2 control, cost + wall per iteration. Numbers are
// recomputed from raw artifacts (sample.json + scores-*.json + ledgers) so
// the criteria-reviewer can re-derive every cell.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ROOT, WVIS } from './wvis-lib.mjs';

const D1 = path.join(WVIS, 'd1');
const sampleDoc = JSON.parse(readFileSync(path.join(D1, 'sample.json'), 'utf8'));
const loadScores = (phase) => {
  const p = path.join(D1, `scores-${phase}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')).renders : [];
};
const it1 = loadScores('iter1');
const it2 = loadScores('iter2');
const ctl = loadScores('control');
const byTag = (rows) => new Map(rows.map((r) => [`${r.contestant}/${r.tag}`, r]));
const it1By = byTag(it1); const it2By = byTag(it2); const ctlBy = byTag(ctl);

// wall/cost per revision call, from run records + ledgers.
function runRec(phase, model, tag) {
  const p = path.join(D1, 'runs', phase, model, `${tag}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

const rows = [];
for (const s of sampleDoc.sample) {
  const t1 = `${s.caseId}-r${s.sourceRun * 10 + 1}`;
  const t2 = `${s.caseId}-r${s.sourceRun * 10 + 2}`;
  const j1 = it1By.get(`${s.contestant}/${t1}`) ?? null;
  const j2 = it2By.get(`${s.contestant}/${t2}`) ?? null;
  const r1 = runRec('iter1', s.contestant, t1);
  const r2 = runRec('iter2', s.contestant, t2);
  rows.push({
    bundleId: s.bundleId, contestant: s.contestant, caseId: s.caseId, category: s.category,
    arm: s.arm, scoreBand: s.scoreBand,
    s0: s.originalScore,
    s1: j1?.score ?? null, s1Renderable: j1?.renderable ?? null,
    s2: j2?.score ?? null,
    iter1TransportOk: Boolean(r1?.ok), iter2Ran: Boolean(r2),
    wall1: r1?.wallMs ?? null, cost1: r1?.costUsd ?? null,
    wall2: r2?.wallMs ?? null, cost2: r2?.costUsd ?? null,
    best1: Math.max(s.originalScore, j1?.score ?? -1),
    best2: Math.max(s.originalScore, j1?.score ?? -1, j2?.score ?? -1),
  });
}

function agg(list) {
  const n = list.length;
  if (!n) return null;
  const withS1 = list.filter((r) => r.s1 != null);
  const d1 = withS1.map((r) => r.s1 - r.s0);
  const withS2 = list.filter((r) => r.s2 != null);
  const d2 = withS2.map((r) => r.s2 - r.s1);
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const ge85w1 = list.filter((r) => (r.s1 ?? -1) >= 85).length;
  const ge85w2 = list.filter((r) => Math.max(r.s1 ?? -1, r.s2 ?? -1) >= 85).length;
  return {
    n, judged1: withS1.length, iterated2: withS2.length,
    meanS0: mean(list.map((r) => r.s0)),
    meanS1: mean(withS1.map((r) => r.s1)),
    meanDelta1: mean(d1),
    meanDelta2: mean(d2),
    pctGe85Within1: ge85w1 / n,
    pctGe85Within2: ge85w2 / n,
    countGe85Within1: ge85w1, countGe85Within2: ge85w2,
    meanWall1Ms: mean(list.filter((r) => r.wall1).map((r) => r.wall1)),
    meanCost1Usd: mean(list.filter((r) => r.cost1 != null).map((r) => r.cost1)),
    meanWall2Ms: mean(list.filter((r) => r.wall2).map((r) => r.wall2)),
    meanCost2Usd: mean(list.filter((r) => r.cost2 != null).map((r) => r.cost2)),
  };
}

const perModel = {};
for (const m of [...new Set(rows.map((r) => r.contestant))].sort()) perModel[m] = agg(rows.filter((r) => r.contestant === m));
const perArm = {
  vision: agg(rows.filter((r) => r.arm === 'vision')),
  'text-critique-only': agg(rows.filter((r) => r.arm === 'text-critique-only')),
};
const perCategory = { '3d': agg(rows.filter((r) => r.category === '3d')), '2d': agg(rows.filter((r) => r.category === '2d')) };
const perBand = { 'band0 (<30)': agg(rows.filter((r) => r.scoreBand === 0)), 'band1 (30-59)': agg(rows.filter((r) => r.scoreBand === 1)), 'band2 (60-84)': agg(rows.filter((r) => r.scoreBand === 2)) };
const overall = agg(rows);

// Control arm: best-of-2 = max(original, resample), no feedback.
const controlRows = [];
for (const bid of sampleDoc.controlBundleIds) {
  const s = sampleDoc.sample.find((x) => x.bundleId === bid);
  if (!s) continue;
  const jc = ctlBy.get(`${s.contestant}/${s.caseId}-r3`) ?? null;
  const loop = rows.find((r) => r.bundleId === bid);
  controlRows.push({
    bundleId: bid, contestant: s.contestant, s0: s.originalScore,
    resample: jc?.score ?? null,
    bestOf2: jc ? Math.max(s.originalScore, jc.score) : null,
    loopS1: loop?.s1 ?? null, loopBest1: loop?.best1 ?? null,
  });
}
const cWith = controlRows.filter((r) => r.resample != null);
const controlAgg = {
  n: controlRows.length, judged: cWith.length,
  meanS0: cWith.length ? cWith.reduce((a, r) => a + r.s0, 0) / cWith.length : null,
  meanResample: cWith.length ? cWith.reduce((a, r) => a + r.resample, 0) / cWith.length : null,
  meanBestOf2Delta: cWith.length ? cWith.reduce((a, r) => a + (r.bestOf2 - r.s0), 0) / cWith.length : null,
  pctGe85BestOf2: controlRows.length ? cWith.filter((r) => r.bestOf2 >= 85).length / controlRows.length : null,
  // loop-arm deltas on the SAME 20 renders, for a like-for-like read
  sameRendersLoopMeanDelta1: cWith.length ? cWith.filter((r) => r.loopS1 != null).reduce((a, r) => a + (r.loopS1 - r.s0), 0) / Math.max(1, cWith.filter((r) => r.loopS1 != null).length) : null,
  sameRendersLoopBest1MeanDelta: cWith.length ? cWith.filter((r) => r.loopBest1 != null).reduce((a, r) => a + (r.loopBest1 - r.s0), 0) / Math.max(1, cWith.filter((r) => r.loopBest1 != null).length) : null,
};

// D1 spend from ledgers.
const LED = path.join(WVIS, 'ledgers');
let metered = 0; let subEq = 0;
for (const f of readdirSync(LED).filter((x) => /ledger-(d1|judge-d1)/.test(x))) {
  const l = JSON.parse(readFileSync(path.join(LED, f), 'utf8'));
  metered += l.totals?.meteredUsd ?? 0;
  subEq += l.totals?.subscriptionEquivalentUsd ?? 0;
}

const out = {
  computedAt: new Date().toISOString(),
  sample: { total: rows.length, perModelCap: 12, perModel: Object.fromEntries(Object.entries(perModel).map(([k, v]) => [k, v?.n])) },
  overall, perModel, perArm, perCategory, perBand,
  control: { rows: controlRows, agg: controlAgg },
  spend: { meteredUsd: metered, subscriptionEquivalentUsd: subEq, d1CapUsd: 35 },
  rows,
};
writeFileSync(path.join(D1, 'd1-metrics.json'), JSON.stringify(out, null, 2));

const fmt = (x, d = 1) => (x == null ? '—' : x.toFixed(d));
console.log(`D1 overall: n=${overall.n} meanS0=${fmt(overall.meanS0)} meanS1=${fmt(overall.meanS1)} Δ1=${fmt(overall.meanDelta1)} Δ2=${fmt(overall.meanDelta2)} | >=85 within1 ${overall.countGe85Within1}/${overall.n} within2 ${overall.countGe85Within2}/${overall.n}`);
console.log(`arms: vision Δ1=${fmt(perArm.vision?.meanDelta1)} text Δ1=${fmt(perArm['text-critique-only']?.meanDelta1)}`);
console.log(`control best-of-2 Δ=${fmt(controlAgg.meanBestOf2Delta)} vs same-renders loop Δ1=${fmt(controlAgg.sameRendersLoopMeanDelta1)} (best1 Δ=${fmt(controlAgg.sameRendersLoopBest1MeanDelta)})`);
console.log(`spend: metered $${metered.toFixed(2)} of $35 D1 cap; sub-equivalent $${subEq.toFixed(2)}`);
for (const [m, v] of Object.entries(perModel)) console.log(`  ${m}: Δ1=${fmt(v?.meanDelta1)} Δ2=${fmt(v?.meanDelta2)} >=85 w1 ${v?.countGe85Within1}/${v?.n} w2 ${v?.countGe85Within2}/${v?.n}`);
