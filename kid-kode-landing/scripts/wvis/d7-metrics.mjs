#!/usr/bin/env node
// W-VIS D7.6 — the SLO table: % of visual nodes reaching >=85/100 WITHIN
// BUDGET (hero <=2 seen iterations, standard <=1) per model, vs the signed
// >=80% target. Also per-iteration means, frameFidelity, gate stats, and the
// flight-record emission (prism.design.* per node attempt) the recorder
// carries in production. Recomputed from raw artifacts.

import { readFileSync, writeFileSync, existsSync, readdirSync, appendFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { ROOT, WVIS } from './wvis-lib.mjs';

const D7 = path.join(WVIS, 'd7');
const plan = JSON.parse(readFileSync(path.join(D7, 'plan.json'), 'utf8'));
const scores = JSON.parse(readFileSync(path.join(D7, 'scores.json'), 'utf8')).renders;
const refManifest = JSON.parse(readFileSync(path.join(D7, 'ref-frames-manifest.json'), 'utf8'));

const MODELS = ['claude-sonnet-5', 'claude-fable-5'];
const byKey = new Map(scores.map((r) => [`${r.contestant}/${r.tag}`, r]));
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

function runRec(model, tag) {
  const p = path.join(D7, 'runs', model, `${tag}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

const flightPath = path.join(D7, 'flight-records.jsonl');
if (existsSync(flightPath)) rmSync(flightPath);

const perModel = {};
const perCase = [];
for (const model of MODELS) {
  const rows = [];
  for (const pc of plan.cases) {
    const iters = [];
    for (let i = 0; i <= pc.maxSeenIterations; i += 1) {
      const tag = `${pc.caseId}-r${100 + i}`;
      const j = byKey.get(`${model}/${tag}`) ?? null;
      const rec = runRec(model, tag);
      iters.push({ iter: i, tag, score: j?.score ?? null, frameFidelity: j?.frameFidelity ?? null, ran: Boolean(rec?.ok), costUsd: rec?.costUsd ?? null, wallMs: rec?.wallMs ?? null, billing: rec?.billing ?? null, gate: rec?.gate ?? null });
    }
    const judged = iters.filter((it) => it.score != null);
    const best = judged.length ? Math.max(...judged.map((it) => it.score)) : null;
    const bestIter = judged.length ? judged.reduce((a, b) => (b.score > a.score ? b : a)).iter : null;
    const reached85 = best != null && best >= 85;
    const iterationsUsed = Math.max(0, iters.filter((it) => it.ran).length - 1);
    const genRec = runRec(model, `${pc.caseId}-r100`);
    const row = {
      caseId: pc.caseId, category: pc.category, criticality: pc.criticality,
      budget: pc.maxSeenIterations, iterationsUsed,
      scores: iters.map((it) => it.score), frameFidelities: iters.map((it) => it.frameFidelity),
      best, bestIter, reached85WithinBudget: reached85,
      gatePassFirst: genRec?.gate?.pass === true && !genRec?.gate?.retried,
      gateRetried: Boolean(genRec?.gate?.retried), gateFinalPass: genRec?.gate?.pass ?? null,
      referenceFrameArm: refManifest.frames[pc.caseId]?.arm ?? 'none',
      costUsd: mean([]) ?? iters.reduce((a, it) => a + (it.costUsd ?? 0), 0),
      billing: genRec?.billing ?? null,
    };
    rows.push(row);
    perCase.push({ model, ...row });

    // Flight-record emission — the production prism.design.* columns.
    appendFileSync(flightPath, JSON.stringify({
      record_type: 'node_attempt',
      'gen_ai.request.model': model,
      spec: { caption: pc.caseId, render_mode: 'lab-visual-case' },
      succeeded: best != null,
      prism: {
        'prism.design.iterations_used': iterationsUsed,
        'prism.design.iteration_scores': iters.map((it) => it.score),
        'prism.design.preset.light_rig': pc.presetSelections.lightRig,
        'prism.design.preset.camera_framing': pc.presetSelections.cameraFraming,
        'prism.design.preset.composition_layout': pc.presetSelections.compositionLayout,
        'prism.design.reference_frame': refManifest.frames[pc.caseId]?.arm ?? 'none',
        'prism.design.frame_fidelity': iters[iters.length - 1]?.frameFidelity ?? null,
        'prism.design.best_of': judged.length,
        'prism.design.selected_sample': bestIter,
        'prism.sentinel.luna_first_pass_regression': undefined,
      },
    }) + '\n');
  }
  const n = rows.length;
  perModel[model] = {
    n,
    sloPct: rows.filter((r) => r.reached85WithinBudget).length / n,
    sloCount: rows.filter((r) => r.reached85WithinBudget).length,
    meanFirstPass: mean(rows.map((r) => r.scores[0]).filter((x) => x != null)),
    meanBest: mean(rows.map((r) => r.best).filter((x) => x != null)),
    meanIter1: mean(rows.map((r) => r.scores[1]).filter((x) => x != null)),
    meanIter2: mean(rows.map((r) => r.scores[2]).filter((x) => x != null)),
    meanFrameFidelityBest: mean(rows.map((r) => Math.max(...r.frameFidelities.filter((x) => x != null), -1)).filter((x) => x >= 0)),
    gateFirstPassRate: rows.filter((r) => r.gatePassFirst).length / n,
    gateRetryCount: rows.filter((r) => r.gateRetried).length,
    gateFinalPassRate: rows.filter((r) => r.gateFinalPass === true).length / n,
    hero: { n: rows.filter((r) => r.criticality === 'hero').length, slo: rows.filter((r) => r.criticality === 'hero' && r.reached85WithinBudget).length },
    standard: { n: rows.filter((r) => r.criticality === 'standard').length, slo: rows.filter((r) => r.criticality === 'standard' && r.reached85WithinBudget).length },
    meteredUsd: rows.reduce((a, r) => a + (r.billing === 'metered' ? r.costUsd : 0), 0),
  };
}

// W-BAKEB baseline for the same 20 specs (design axis, first-pass means).
let baseline = null;
try {
  const bak = JSON.parse(readFileSync(path.join(ROOT, 'notes', 'bakeoff-b', 'judge', 'scores.json'), 'utf8')).renders;
  baseline = {};
  for (const model of MODELS) {
    const mine = bak.filter((r) => r.contestant === model);
    baseline[model] = { n: mine.length, mean: mean(mine.map((r) => r.score)), ge85: mine.filter((r) => r.score >= 85).length };
  }
} catch { /* baseline optional */ }

const out = { computedAt: new Date().toISOString(), sloTarget: { score: 85, rate: 0.8, budget: 'hero <=2 seen iterations, standard <=1' }, perModel, wbakebBaseline: baseline, perCase };
writeFileSync(path.join(D7, 'd7-metrics.json'), JSON.stringify(out, null, 2));
const fmt = (x, d = 1) => (x == null ? '—' : (typeof x === 'number' ? x.toFixed(d) : x));
for (const model of MODELS) {
  const v = perModel[model];
  console.log(`${model}: SLO ${v.sloCount}/${v.n} (${(v.sloPct * 100).toFixed(0)}% vs >=80% target) | first-pass mean ${fmt(v.meanFirstPass)} (W-BAKEB baseline ${fmt(baseline?.[model]?.mean)}) | iter1 ${fmt(v.meanIter1)} iter2 ${fmt(v.meanIter2)} | gate first-pass ${(v.gateFirstPassRate * 100).toFixed(0)}% retries ${v.gateRetryCount} | frameFidelity(best) ${fmt(v.meanFrameFidelityBest)}`);
}
