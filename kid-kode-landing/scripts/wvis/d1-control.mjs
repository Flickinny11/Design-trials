#!/usr/bin/env node
// W-VIS D1.3 — the CONTROL ARM. Best-of-2 blind resample on 20 sampled specs
// with NO feedback: the same model regenerates the same frozen case under the
// identical W-BAKEB generation protocol (L1 v2.1 + frozen L2 + corpus L3 —
// byte-identical prompts, fresh sample). Blind re-judge scores it; best-of-2
// = max(original W-BAKEB score, resample score). This separates critique-and-
// frame-driven convergence out of plain resample luck.
//
// Output: notes/wvis/d1/runs/control/<model>/<case>-r3.json
// Ledger:  notes/wvis/ledgers/ledger-d1-control.json (metered)

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ROOT, WVIS, openLedger, capReached, callOpenAICompat, D1_CAP_USD } from './wvis-lib.mjs';
import { D1_ROUTES } from './d1-revise.mjs';

const B = path.join(ROOT, 'notes', 'bakeoff-b');
const D1 = path.join(WVIS, 'd1');

const L1 = readFileSync(path.join(B, 'l1-v2.1-system.txt'), 'utf8');
const L2 = readFileSync(path.join(B, 'l2-world-frozen.txt'), 'utf8');
const SYSTEM = `${L1}\n\n${L2}`;

const CORPUS = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'visual', 'cases');
const l3ByCase = new Map(readdirSync(CORPUS).filter((x) => x.endsWith('.json'))
  .map((f) => { const c = JSON.parse(readFileSync(path.join(CORPUS, f), 'utf8')); return [c.caseId, c.l3]; }));

const sampleDoc = JSON.parse(readFileSync(path.join(D1, 'sample.json'), 'utf8'));
const controlIds = new Set(sampleDoc.controlBundleIds);
const items = sampleDoc.sample.filter((s) => controlIds.has(s.bundleId));

const { add: ledgerAdd } = openLedger('d1-control', { phase: 'd1', arm: 'control' });

async function runOne(item) {
  const rt = D1_ROUTES[item.contestant];
  if (!rt) return 'skip';
  const tag = `${item.caseId}-r3`;
  const outDir = path.join(D1, 'runs', 'control', item.contestant);
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${tag}.json`);
  if (existsSync(outPath)) { try { if (JSON.parse(readFileSync(outPath, 'utf8')).ok) return 'skip'; } catch { /* */ } }
  let rec;
  try {
    const r = await callOpenAICompat({ route: rt.route, model: rt.model, system: SYSTEM, user: l3ByCase.get(item.caseId) });
    const costUsd = r.usage.promptTokens != null ? (r.usage.promptTokens * rt.inRate + r.usage.completionTokens * rt.outRate) / 1e6 : null;
    rec = { wave: 'wvis-d1', arm: 'control-resample', contestant: item.contestant, model: rt.model, route: rt.route, caseId: item.caseId, sourceTag: item.sourceTag, tag, run: 3, originalScore: item.originalScore, ok: true, wallMs: r.wallMs, finishReason: r.finishReason, usage: r.usage, costUsd, billing: 'metered', output: r.text };
    ledgerAdd({ phase: 'd1-control', contestant: item.contestant, caseId: item.caseId, tag, promptTokens: r.usage.promptTokens, completionTokens: r.usage.completionTokens, costUsd: costUsd ?? 0, billing: 'metered' });
  } catch (err) {
    rec = { wave: 'wvis-d1', arm: 'control-resample', contestant: item.contestant, caseId: item.caseId, tag, ok: false, transportError: String(err?.message ?? err) };
  }
  writeFileSync(outPath, JSON.stringify(rec, null, 2));
  return rec.ok ? 'ok' : 'err';
}

if (capReached('d1', D1_CAP_USD)) { console.log('[d1-control] cap reached — no runs'); process.exit(0); }
console.log(`[d1-control] ${items.length} no-feedback resamples`);
let err = 0;
for (const item of items) {
  if (capReached('d1', D1_CAP_USD)) break;
  const r = await runOne(item);
  if (r === 'err') err += 1;
}
console.log(`[d1-control] done (${err} errors)`);
