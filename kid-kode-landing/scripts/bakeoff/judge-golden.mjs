#!/usr/bin/env node
// W-BAKE D4 — ground truth: Fable 5 verdicts on the golden set, TWO
// independent passes (wave prompt #15), same rubric as everything else
// (rubric.mjs). Per-render final = mean of pass scores + union of MUST-FIX;
// pass disagreements are measured and DISCLOSED, never smoothed away.
//
// Output: notes/bakeoff/judge/golden/ground-truth.json (+ pass transcripts).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { ROOT } from './contestants.mjs';
import { RUBRIC, EXEMPLARS, loadCases, specBrief, VERDICT_SHAPE } from './rubric.mjs';

const pexecFile = promisify(execFile);
const GOLDEN_DIR = path.join(ROOT, 'notes', 'bakeoff', 'judge', 'golden');
const LEDGER_PATH = path.join(ROOT, 'notes', 'bakeoff', 'ledger-judge.json');

const ledger = existsSync(LEDGER_PATH)
  ? JSON.parse(readFileSync(LEDGER_PATH, 'utf8'))
  : { wave: 'wbake-judge', calls: [], totals: { subscriptionEquivalentUsd: 0 } };
function ledgerAdd(entry) {
  ledger.calls.push(entry);
  ledger.totals.subscriptionEquivalentUsd = ledger.calls.reduce((s, c) => s + (c.costUsd ?? 0), 0);
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

const cases = loadCases();
const golden = JSON.parse(readFileSync(path.join(GOLDEN_DIR, 'golden-set.json'), 'utf8')).entries;

async function passOnce(passNo) {
  const verdicts = new Map();
  for (let i = 0; i < golden.length; i += 5) {
    const batch = golden.slice(i, i + 5);
    const lines = [RUBRIC, ''];
    lines.push(`CALIBRATION EXEMPLARS (not scored): read ${EXEMPLARS[0]} and ${EXEMPLARS[1]}`);
    lines.push('');
    batch.forEach((b, k) => {
      lines.push(`FRAME F${k + 1}: read the image at ${path.join(ROOT, b.frame)}`);
      lines.push(`CASE SPEC for F${k + 1}:`);
      lines.push(specBrief(cases, b.caseId));
      lines.push('');
    });
    lines.push('Read ALL images listed above, then reply with STRICT JSON only (no fences):');
    lines.push(VERDICT_SHAPE);
    const prompt = lines.join('\n');
    const label = `ground-truth-pass${passNo}-batch${Math.floor(i / 5) + 1}`;
    console.log(`  ${label} (${batch.length} frames)...`);
    const { stdout } = await pexecFile('claude', [
      '--print', '--model', 'claude-fable-5',
      '--settings', '{"hooks":{},"disableAllHooks":true}',
      '--allowedTools', 'Read',
      '--no-session-persistence',
      '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
      '--output-format', 'json',
      prompt,
    ], { maxBuffer: 64 * 1024 * 1024, timeout: 900000, cwd: '/tmp/wbake-clean' });
    const env = JSON.parse(stdout);
    writeFileSync(path.join(GOLDEN_DIR, `${label}.json`), JSON.stringify({
      label, model: 'claude-fable-5', frames: batch.map((b, k) => ({ label: `F${k + 1}`, goldenId: b.goldenId })),
      costUsd: env.total_cost_usd, usage: env.usage, result: env.result,
    }, null, 2));
    ledgerAdd({ axis: 'axis3-ground-truth', model: 'claude-fable-5', batch: label, frames: batch.length, costUsd: env.total_cost_usd ?? 0, billing: 'subscription-equivalent', at: new Date().toISOString() });
    let text = (env.result ?? '').trim();
    if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(text);
    parsed.frames.forEach((f, k) => {
      const idx = Number(String(f.frame).replace('F', '')) - 1;
      const entry = batch[idx >= 0 && idx < batch.length ? idx : k];
      verdicts.set(entry.goldenId, { score: f.score, mustFix: f.mustFix ?? [], notes: f.notes ?? '' });
    });
  }
  return verdicts;
}

mkdirSync(GOLDEN_DIR, { recursive: true });
console.log('ground truth pass 1...');
const p1 = await passOnce(1);
console.log('ground truth pass 2...');
const p2 = await passOnce(2);

const rows = golden.map((g) => {
  const a = p1.get(g.goldenId) ?? { score: null, mustFix: [] };
  const b = p2.get(g.goldenId) ?? { score: null, mustFix: [] };
  const defects = (v) => new Set((v.mustFix ?? []).map((m) => m.defect));
  const dA = defects(a); const dB = defects(b);
  return {
    goldenId: g.goldenId, bundleId: g.bundleId, seeded: g.seeded, seededDefect: g.seededDefect, caseId: g.caseId,
    pass1: a, pass2: b,
    finalScore: a.score != null && b.score != null ? (a.score + b.score) / 2 : (a.score ?? b.score),
    mustFixUnion: [...new Set([...dA, ...dB])],
    mustFixBothPasses: [...dA].filter((d) => dB.has(d)),
    scoreDisagreement: a.score != null && b.score != null ? Math.abs(a.score - b.score) : null,
    defectDisagreement: [...new Set([...[...dA].filter((d) => !dB.has(d)), ...[...dB].filter((d) => !dA.has(d))])],
  };
});
const dis = rows.filter((r) => r.scoreDisagreement != null).map((r) => r.scoreDisagreement);
writeFileSync(path.join(GOLDEN_DIR, 'ground-truth.json'), JSON.stringify({
  judgedBy: 'claude-fable-5, two independent passes (same rubric.mjs prompt as all critics)',
  selfDisagreement: {
    meanAbsScoreDelta: dis.length ? dis.reduce((s, x) => s + x, 0) / dis.length : null,
    maxAbsScoreDelta: dis.length ? Math.max(...dis) : null,
    rendersWithDefectDisagreement: rows.filter((r) => r.defectDisagreement.length > 0).length,
  },
  rows,
}, null, 2));
console.log(`ground-truth.json written (${rows.length} renders; mean |Δscore| between passes = ${(dis.reduce((s, x) => s + x, 0) / Math.max(1, dis.length)).toFixed(1)})`);
