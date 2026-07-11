#!/usr/bin/env node
// W-BAKE-B Axis 2 — design metrics aggregation (D3 item 7). Reads the blind
// judge scores + capture metas + case categories and emits per-model:
// design mean±sd, MUST-FIX rate, crash rate, 3D-subset vs 2D-subset split, and
// the ceiling-gap (model mean minus the Fable and Opus reference means).
// Ceiling refs (fable, opus) are labeled references, never tier contestants.
//
// Output: notes/bakeoff-b/axis2-metrics.json

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './contestants-b.mjs';

const B = path.join(ROOT, 'notes', 'bakeoff-b');
const VISUAL = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'visual', 'cases');

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const sd = (a) => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };

const category = new Map();
for (const f of readdirSync(VISUAL).filter((x) => x.endsWith('.json'))) {
  const c = JSON.parse(readFileSync(path.join(VISUAL, f), 'utf8'));
  category.set(c.caseId, c.category); // '3d' | '2d'
}

const scoresPath = path.join(B, 'judge', 'scores.json');
if (!existsSync(scoresPath)) { console.error('no judge/scores.json yet'); process.exit(1); }
const renders = JSON.parse(readFileSync(scoresPath, 'utf8')).renders;

const CEILING = new Set(['claude-fable-5', 'claude-opus-4.8']);
function isCrash(r) {
  return r.renderable === false || Boolean(r.moduleRuntimeError) || r.probeStatus === 'error' || r.probeStatus === 'capture-error';
}

const byContestant = new Map();
for (const r of renders) { if (!byContestant.has(r.contestant)) byContestant.set(r.contestant, []); byContestant.get(r.contestant).push(r); }

const perModel = {};
for (const [cid, rs] of byContestant) {
  const scores = rs.map((r) => (typeof r.score === 'number' ? r.score : 0));
  const cat3d = rs.filter((r) => category.get(r.caseId) === '3d');
  const cat2d = rs.filter((r) => category.get(r.caseId) === '2d');
  perModel[cid] = {
    role: CEILING.has(cid) ? 'ceiling-ref' : 'contestant',
    n: rs.length,
    designMean: mean(scores), designSd: sd(scores),
    mustFixRate: rs.length ? rs.filter((r) => (r.mustFix ?? []).length > 0).length / rs.length : null,
    crashRate: rs.length ? rs.filter(isCrash).length / rs.length : null,
    subset3D: { n: cat3d.length, mean: mean(cat3d.map((r) => r.score ?? 0)), crashRate: cat3d.length ? cat3d.filter(isCrash).length / cat3d.length : null },
    subset2D: { n: cat2d.length, mean: mean(cat2d.map((r) => r.score ?? 0)), crashRate: cat2d.length ? cat2d.filter(isCrash).length / cat2d.length : null },
  };
}

const fableMean = perModel['claude-fable-5']?.designMean ?? null;
const opusMean = perModel['claude-opus-4.8']?.designMean ?? null;
for (const cid of Object.keys(perModel)) {
  perModel[cid].ceilingGap = {
    vsFable: fableMean != null && perModel[cid].designMean != null ? perModel[cid].designMean - fableMean : null,
    vsOpus: opusMean != null && perModel[cid].designMean != null ? perModel[cid].designMean - opusMean : null,
  };
}

// Rank contestants (exclude ceiling refs) by design mean.
const ranked = Object.entries(perModel).filter(([, v]) => v.role === 'contestant').sort((a, b) => (b[1].designMean ?? 0) - (a[1].designMean ?? 0)).map(([id, v]) => ({ id, designMean: v.designMean, crashRate: v.crashRate, mustFixRate: v.mustFixRate }));

writeFileSync(path.join(B, 'axis2-metrics.json'), JSON.stringify({
  wave: 'wbakeb', axis: 'design', l1: 'v2.1',
  ceilingReferenceMeans: { fable: fableMean, opus: opusMean },
  perModel, rankedContestants: ranked, gradedAt: new Date().toISOString(),
}, null, 2));
console.log(`axis2-metrics.json written. ceiling: fable=${fableMean?.toFixed(1)} opus=${opusMean?.toFixed(1)}`);
console.log('ranked contestants:', ranked.map((r) => `${r.id}=${r.designMean?.toFixed(1)}(crash ${(r.crashRate * 100).toFixed(0)}%)`).join(', '));
