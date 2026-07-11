#!/usr/bin/env node
// W-BAKE-B D4 — ground truth: Fable 5 verdicts on the bakeoff-b golden set,
// TWO independent passes, same rubric as everything else (rubric.mjs).
// Per-render final = mean of pass scores + union of MUST-FIX; pass
// disagreements are measured and DISCLOSED, never smoothed away.
//
// Budget: enforces the MERGED $120 hard cap (all bakeoff-b ledgers) with a
// $0.50 margin, same discipline as judge-b.mjs.
//
// Output: notes/bakeoff-b/judge/golden/ground-truth.json (+ pass transcripts).

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { ROOT } from './contestants-b.mjs';
import { RUBRIC, EXEMPLARS, loadCases, specBrief, VERDICT_SHAPE } from './rubric.mjs';

const pexecFile = promisify(execFile);
const B = path.join(ROOT, 'notes', 'bakeoff-b');
const GOLDEN_DIR = path.join(B, 'judge', 'golden');
const LEDGERS = path.join(B, 'ledgers');
const LEDGER_PATH = path.join(B, 'judge', 'ledger-golden.json');
const HARD_CAP_USD = 120; const MARGIN = 0.5;

const ledger = existsSync(LEDGER_PATH)
  ? JSON.parse(readFileSync(LEDGER_PATH, 'utf8'))
  : { wave: 'wbakeb-golden', calls: [], totals: { subscriptionEquivalentUsd: 0 } };
function otherSpend() {
  let t = 0;
  try { for (const f of readdirSync(LEDGERS).filter((x) => x.endsWith('.json'))) { try { t += JSON.parse(readFileSync(path.join(LEDGERS, f), 'utf8')).totals?.totalUsd ?? 0; } catch { /* */ } } } catch { /* */ }
  for (const f of ['ledger-judge.json', 'ledger-critics.json']) {
    const p = path.join(B, 'judge', f);
    if (existsSync(p)) { try { const l = JSON.parse(readFileSync(p, 'utf8')); t += l.totals?.meteredUsd ?? 0; } catch { /* */ } }
  }
  return t;
}
// 2026-07-11 cap semantics (report §8): the $120 hard cap is enforced on
// METERED spend only; this judge's founder-CLI spend is subscription-
// equivalent — fully ledgered + disclosed in §7, not counted against the cap.
function ledgerAdd(entry) {
  ledger.calls.push(entry);
  ledger.totals.subscriptionEquivalentUsd = ledger.calls.reduce((s, c) => s + (c.costUsd ?? 0), 0);
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
  const metered = otherSpend();
  if (metered >= HARD_CAP_USD - MARGIN) { console.error(`!! METERED spend $${metered.toFixed(2)} at the $${HARD_CAP_USD} margin — stopping`); process.exit(3); }
}

const cases = loadCases();
const golden = JSON.parse(readFileSync(path.join(GOLDEN_DIR, 'golden-set.json'), 'utf8')).entries;

function extractJsonObject(text) {
  const t = (text ?? '').trim();
  const start = t.indexOf('{');
  if (start < 0) throw new Error('no JSON in verdict');
  for (let i = start; i < t.length; i += 1) {
    if (t[i] !== '{') continue;
    let depth = 0;
    for (let j = i; j < t.length; j += 1) {
      if (t[j] === '{') depth += 1;
      else if (t[j] === '}') {
        depth -= 1;
        if (depth === 0) {
          try { return JSON.parse(t.slice(i, j + 1)); } catch { break; }
        }
      }
    }
  }
  throw new Error('no parseable JSON object in verdict');
}

async function passOnce(passNo) {
  const verdicts = new Map();
  for (let i = 0; i < golden.length; i += 5) {
    const batch = golden.slice(i, i + 5);
    const label = `ground-truth-pass${passNo}-batch${Math.floor(i / 5) + 1}`;
    const done = path.join(GOLDEN_DIR, `${label}.json`);
    let env;
    if (existsSync(done)) {
      env = JSON.parse(readFileSync(done, 'utf8'));
      console.log(`  ${label} (cached)`);
    } else {
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
      console.log(`  ${label} (${batch.length} frames)...`);
      const { stdout } = await pexecFile('claude', [
        '--print', '--model', 'claude-fable-5',
        '--settings', '{"hooks":{},"disableAllHooks":true}',
        '--allowedTools', 'Read',
        '--no-session-persistence',
        '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
        '--output-format', 'json',
        lines.join('\n'),
      ], { maxBuffer: 64 * 1024 * 1024, timeout: 900000, cwd: '/tmp/wbake-clean' });
      const raw = JSON.parse(stdout);
      env = {
        label, model: 'claude-fable-5', frames: batch.map((b, k) => ({ label: `F${k + 1}`, goldenId: b.goldenId })),
        costUsd: raw.total_cost_usd, usage: raw.usage, result: raw.result,
      };
      writeFileSync(done, JSON.stringify(env, null, 2));
      ledgerAdd({ axis: 'axis3-ground-truth', model: 'claude-fable-5', batch: label, frames: batch.length, costUsd: raw.total_cost_usd ?? 0, billing: 'subscription-equivalent', at: new Date().toISOString() });
    }
    let text = (env.result ?? '').trim();
    if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    const parsed = extractJsonObject(text);
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
