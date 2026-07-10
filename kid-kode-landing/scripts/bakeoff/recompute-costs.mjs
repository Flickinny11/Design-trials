#!/usr/bin/env node
// W-BAKE — post-hoc cost recompute. Ledger rates for three Fireworks models
// were corrected mid-wave to the documented serverless prices
// (docs.fireworks.ai/serverless/pricing, fetched 2026-07-09):
//   deepseek-v4-flash 0.30/1.20 -> 0.14/0.28
//   glm-5.2           0.55/2.19 -> 1.40/4.40
//   kimi-k2.7-code    0.60/2.50 -> 0.95/4.00
// Token counts in the run records are ground truth; this recomputes costUsd
// in every metered run record + ledger entry from tokens x corrected rates.
// Claude-CLI records are untouched (total_cost_usd is authoritative).
// Run AFTER all metered runners have exited (they hold in-memory ledgers).

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT, CONTESTANTS } from './contestants.mjs';

const rates = new Map(CONTESTANTS.filter((c) => c.usdPerMTokIn != null).map((c) => [c.id, c]));
const BAKE = path.join(ROOT, 'notes', 'bakeoff');

let fixedRecords = 0;
for (const axis of ['axis1', 'axis2']) {
  const dir = path.join(BAKE, 'runs', axis);
  if (!existsSync(dir)) continue;
  for (const cid of readdirSync(dir)) {
    const spec = rates.get(cid);
    if (!spec) continue;
    const cdir = path.join(dir, cid);
    let files;
    try { files = readdirSync(cdir).filter((f) => f.endsWith('.json')); } catch { continue; }
    for (const f of files) {
      const p = path.join(cdir, f);
      const rec = JSON.parse(readFileSync(p, 'utf8'));
      if (!rec.ok || rec.billing !== 'metered' || rec.usage?.promptTokens == null) continue;
      const c = (rec.usage.promptTokens * spec.usdPerMTokIn + rec.usage.completionTokens * spec.usdPerMTokOut) / 1e6;
      if (Math.abs((rec.costUsd ?? 0) - c) > 1e-9) {
        rec.costUsd = c;
        rec.rateNote = 'recomputed from documented fireworks serverless rates (2026-07-09)';
        writeFileSync(p, JSON.stringify(rec, null, 2));
        fixedRecords += 1;
      }
    }
  }
}

for (const lf of ['ledger.json', 'ledger-axis2.json']) {
  const p = path.join(BAKE, lf);
  if (!existsSync(p)) continue;
  const ledger = JSON.parse(readFileSync(p, 'utf8'));
  let fixed = 0;
  for (const call of ledger.calls ?? []) {
    const spec = rates.get(call.contestant);
    if (!spec || call.billing !== 'metered' || call.promptTokens == null) continue;
    const c = (call.promptTokens * spec.usdPerMTokIn + call.completionTokens * spec.usdPerMTokOut) / 1e6;
    if (Math.abs((call.costUsd ?? 0) - c) > 1e-9) { call.costUsd = c; fixed += 1; }
  }
  ledger.totals.meteredUsd = ledger.calls.filter((c) => c.billing === 'metered').reduce((s, c) => s + (c.costUsd ?? 0), 0);
  ledger.totals.subscriptionEquivalentUsd = ledger.calls.filter((c) => c.billing === 'subscription-equivalent').reduce((s, c) => s + (c.costUsd ?? 0), 0);
  ledger.totals.totalUsd = ledger.totals.meteredUsd + ledger.totals.subscriptionEquivalentUsd;
  writeFileSync(p, JSON.stringify(ledger, null, 2));
  console.log(`${lf}: ${fixed} entries recomputed; total $${ledger.totals.totalUsd.toFixed(2)}`);
}
console.log(`run records recomputed: ${fixedRecords}`);
