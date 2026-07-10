#!/usr/bin/env node
// W-PCP D6 — probe delta metrics: per arm x model, recomputed ONLY from
// committed raw artifacts (runs/, frames/*.meta.json, bundles-index,
// judge/scores.json). Emits notes/pcp-probe/metrics.json + a delta table.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../bakeoff/contestants.mjs';

const PROBE = path.join(ROOT, 'notes', 'pcp-probe');
const scores = JSON.parse(readFileSync(path.join(PROBE, 'judge', 'scores.json'), 'utf8')).renders;
const bundles = JSON.parse(readFileSync(path.join(PROBE, 'bundles-index.json'), 'utf8')).bundles;

const ARMS = ['old', 'pcp'];
const MODELS = ['claude-haiku-4.5', 'gpt-oss-120b'];

function stats(list) {
  if (list.length === 0) return { n: 0, mean: null, sd: null };
  const mean = list.reduce((s, x) => s + x, 0) / list.length;
  const sd = Math.sqrt(list.reduce((s, x) => s + (x - mean) ** 2, 0) / list.length);
  return { n: list.length, mean: Number(mean.toFixed(1)), sd: Number(sd.toFixed(1)) };
}

const out = { lanes: {}, deltas: {}, promptTokens: {}, ledger: {} };

for (const arm of ARMS) {
  for (const model of MODELS) {
    const lane = `${arm}--${model}`;
    const rs = scores.filter((r) => r.arm === arm && r.contestant === model);
    const bs = bundles.filter((b) => b.arm === arm && b.contestant === model);

    // Crash = the module THREW at createNode in the real runtime (frame meta
    // moduleRuntimeError, deterministic — the W-BAKE §4 definition).
    const crashes = rs.filter((r) => r.moduleRuntimeError).length;
    const unrenderable = bs.filter((b) => !b.renderable).length;
    const depViol = bs.filter((b) => (b.depViolations ?? []).length > 0).length;
    const scored = rs.length;
    const withMustFix = rs.filter((r) => (r.mustFix ?? []).length > 0).length;
    const meanMustFix = scored ? Number((rs.reduce((s, r) => s + (r.mustFix ?? []).length, 0) / scored).toFixed(1)) : null;
    const scoreStats = stats(rs.map((r) => r.score));

    // Prompt-token ground truth from the raw run records (provider usage).
    const runDir = path.join(PROBE, 'runs', arm, model);
    let promptTok = [];
    let truncated = 0;
    let transportErrors = 0;
    if (existsSync(runDir)) {
      for (const f of readdirSync(runDir).filter((x) => x.endsWith('.json'))) {
        const rec = JSON.parse(readFileSync(path.join(runDir, f), 'utf8'));
        if (!rec.ok) { transportErrors += 1; continue; }
        if (rec.usage?.promptTokens != null) promptTok.push(rec.usage.promptTokens);
        if (rec.finishReason === 'length') truncated += 1;
      }
    }
    const promptTokens = promptTok.length
      ? { min: Math.min(...promptTok), max: Math.max(...promptTok), mean: Math.round(promptTok.reduce((s, x) => s + x, 0) / promptTok.length) }
      : null;

    out.lanes[lane] = {
      scored,
      designMean: scoreStats.mean,
      designSd: scoreStats.sd,
      crashRate: scored ? Number((crashes / scored).toFixed(3)) : null,
      crashes,
      mustFixRate: scored ? Number((withMustFix / scored).toFixed(3)) : null,
      meanMustFixPerRender: meanMustFix,
      unrenderable,
      depViolationBundles: depViol,
      truncatedGenerations: truncated,
      transportErrors,
      promptTokens,
      topDefects: (() => {
        const c = new Map();
        for (const r of rs) for (const m of r.mustFix ?? []) c.set(m.defect, (c.get(m.defect) ?? 0) + 1);
        return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`);
      })(),
    };
  }
}

for (const model of MODELS) {
  const o = out.lanes[`old--${model}`];
  const p = out.lanes[`pcp--${model}`];
  out.deltas[model] = {
    designMean: o.designMean != null && p.designMean != null ? Number((p.designMean - o.designMean).toFixed(1)) : null,
    crashRate: o.crashRate != null && p.crashRate != null ? Number((p.crashRate - o.crashRate).toFixed(3)) : null,
    mustFixRate: o.mustFixRate != null && p.mustFixRate != null ? Number((p.mustFixRate - o.mustFixRate).toFixed(3)) : null,
    meanMustFixPerRender: o.meanMustFixPerRender != null && p.meanMustFixPerRender != null ? Number((p.meanMustFixPerRender - o.meanMustFixPerRender).toFixed(1)) : null,
    unrenderable: p.unrenderable - o.unrenderable,
  };
}

// Merge lane + judge ledgers.
let total = 0;
const ledgers = readdirSync(PROBE).filter((f) => f.startsWith('ledger-') && f.endsWith('.json'));
for (const f of ledgers) {
  const l = JSON.parse(readFileSync(path.join(PROBE, f), 'utf8'));
  const t = l.totals?.totalUsd ?? l.totals?.subscriptionEquivalentUsd ?? 0;
  out.ledger[f] = Number(t.toFixed(2));
  total += t;
}
out.ledger.totalUsd = Number(total.toFixed(2));
out.ledger.hardCapUsd = 30;

writeFileSync(path.join(PROBE, 'metrics.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
