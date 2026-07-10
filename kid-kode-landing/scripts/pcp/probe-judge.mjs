#!/usr/bin/env node
// W-PCP D6 — blind Fable-5 design judge for the probe. Same rubric module,
// same calibration exemplars, same comparative-per-case batching as the
// W-BAKE pass-2 judge (scripts/bakeoff/judge-axis2.mjs), with one honesty
// UPGRADE: frames are PRE-BLINDED by file copy. The W-BAKE judge's prompt
// referenced frame paths that contained contestant directory names; here the
// path would leak the ARM (the treatment variable), so every frame is copied
// to notes/pcp-probe/judge/blind/<caseId>/F<k>.png with a deterministic
// sha256-of-bundleId ordering, and ONLY those anonymous paths reach the
// judge. The mapping is committed alongside for audit (judge never reads it).
//
// All 8 frames of a case (2 arms x 2 contestants x 2 runs) ride ONE
// comparative call, so old and pcp are scored on the same scale by the same
// judge in the same context.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { ROOT } from '../bakeoff/contestants.mjs';
import { RUBRIC, EXEMPLARS, loadCases, specBrief as rubricSpecBrief, VERDICT_SHAPE } from '../bakeoff/rubric.mjs';

const pexecFile = promisify(execFile);
const PROBE = path.join(ROOT, 'notes', 'pcp-probe');
const FRAMES_DIR = path.join(PROBE, 'frames');
const JUDGE_DIR = path.join(PROBE, 'judge');
const BLIND_DIR = path.join(JUDGE_DIR, 'blind');
const LEDGER_PATH = path.join(PROBE, 'ledger-judge.json');

const args = process.argv.slice(2);
const caseArgIdx = args.indexOf('--case');
const onlyCases = caseArgIdx >= 0 ? new Set(args[caseArgIdx + 1].split(',')) : null;

const ledger = existsSync(LEDGER_PATH)
  ? JSON.parse(readFileSync(LEDGER_PATH, 'utf8'))
  : { wave: 'wpcp-probe-judge', calls: [], totals: { subscriptionEquivalentUsd: 0 } };

// The $30 HARD CAP is on the WHOLE probe (wave prompt #16). The judge is the
// last spender, so it enforces the MERGED total: generation-lane ledgers +
// its own spend, stop margin $0.50 under the cap.
const HARD_CAP_USD = 30;
function mergedLaneSpend() {
  let total = 0;
  for (const f of readdirSync(PROBE).filter((x) => x.startsWith('ledger-') && x.endsWith('.json') && x !== 'ledger-judge.json')) {
    try {
      const l = JSON.parse(readFileSync(path.join(PROBE, f), 'utf8'));
      total += l.totals?.totalUsd ?? 0;
    } catch { /* ignore */ }
  }
  return total;
}
const laneSpendAtStart = mergedLaneSpend();

function ledgerAdd(entry) {
  ledger.calls.push(entry);
  ledger.totals.subscriptionEquivalentUsd = ledger.calls.reduce((s, c) => s + (c.costUsd ?? 0), 0);
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
  const merged = laneSpendAtStart + ledger.totals.subscriptionEquivalentUsd;
  if (merged >= HARD_CAP_USD - 0.5) {
    console.error(`!! MERGED probe spend $${merged.toFixed(2)} at the $${HARD_CAP_USD} hard cap margin — stopping (remaining cases disclosed as unjudged)`);
    process.exit(3);
  }
}

const cases = loadCases();
const specBrief = (caseId) => rubricSpecBrief(cases, caseId);
const sha = (s) => createHash('sha256').update(s).digest('hex');

function collectFrames() {
  const out = [];
  for (const lane of readdirSync(FRAMES_DIR)) {
    const [arm, contestant] = lane.split('--');
    const dir = path.join(FRAMES_DIR, lane);
    let files;
    try { files = readdirSync(dir); } catch { continue; }
    for (const f of files.filter((x) => x.endsWith('.png'))) {
      const metaPath = path.join(dir, f.replace(/\.png$/, '.meta.json'));
      const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
      const caseId = /^(v-\d+[a-z0-9-]*?)-r\d+$/.exec(f.replace(/\.png$/, ''))?.[1] ?? null;
      out.push({
        arm, contestant, lane,
        frame: path.join(dir, f),
        tag: f.replace(/\.png$/, ''),
        caseId,
        bundleId: meta.bundle ?? `pcp-probe/${lane}/${f.replace(/\.png$/, '')}`,
        meta,
      });
    }
  }
  return out;
}

async function judgeBatch(batch, label) {
  // Pre-blind: copy frames to anonymous paths, deterministic hash order.
  const blindCaseDir = path.join(BLIND_DIR, label);
  mkdirSync(blindCaseDir, { recursive: true });
  const ordered = [...batch].sort((a, b) => sha(a.bundleId + 'wpcp-blind').localeCompare(sha(b.bundleId + 'wpcp-blind')));
  const mapping = [];
  ordered.forEach((b, i) => {
    const blindPath = path.join(blindCaseDir, `F${i + 1}.png`);
    copyFileSync(b.frame, blindPath);
    b.blindPath = blindPath;
    mapping.push({ label: `F${i + 1}`, bundleId: b.bundleId, arm: b.arm, contestant: b.contestant, source: path.relative(ROOT, b.frame) });
  });
  writeFileSync(path.join(blindCaseDir, 'mapping.json'), JSON.stringify(mapping, null, 2));

  const lines = [RUBRIC, ''];
  lines.push(`CALIBRATION EXEMPLARS (not scored): read ${EXEMPLARS[0]} and ${EXEMPLARS[1]}`);
  lines.push('');
  ordered.forEach((b, i) => {
    lines.push(`FRAME F${i + 1}: read the image at ${b.blindPath}`);
    lines.push(`CASE SPEC for F${i + 1}:`);
    lines.push(specBrief(b.caseId));
    lines.push('');
  });
  lines.push('Read ALL images listed above, then reply with STRICT JSON only (no fences):');
  lines.push(VERDICT_SHAPE);
  const prompt = lines.join('\n');

  const t0 = Date.now();
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
  const wallMs = Date.now() - t0;
  writeFileSync(path.join(JUDGE_DIR, `${label}.json`), JSON.stringify({
    label, judgedAt: new Date().toISOString(), model: 'claude-fable-5', route: 'claude-cli-print',
    frames: ordered.map((b, i) => ({ label: `F${i + 1}`, blindPath: path.relative(ROOT, b.blindPath) })),
    mappingFile: path.relative(ROOT, path.join(blindCaseDir, 'mapping.json')),
    costUsd: env.total_cost_usd, durationApiMs: env.duration_api_ms, wallMs, usage: env.usage,
    result: env.result,
  }, null, 2));
  ledgerAdd({ batch: label, frames: ordered.length, costUsd: env.total_cost_usd ?? 0, billing: 'subscription-equivalent', at: new Date().toISOString() });

  let text = (env.result ?? '').trim();
  if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  // Balanced-object extraction (judge-golden hardening): take the outermost
  // JSON object if prose slipped in.
  if (!text.startsWith('{')) {
    const s = text.indexOf('{');
    const e = text.lastIndexOf('}');
    if (s >= 0 && e > s) text = text.slice(s, e + 1);
  }
  const parsed = JSON.parse(text);
  return parsed.frames.map((f, i) => {
    const idx = Number(String(f.frame).replace('F', '')) - 1;
    return { ...ordered[idx >= 0 && idx < ordered.length ? idx : i], verdict: f };
  });
}

mkdirSync(JUDGE_DIR, { recursive: true });
const frames = collectFrames();
const byCase = new Map();
for (const f of frames) {
  if (!f.caseId) continue;
  if (!byCase.has(f.caseId)) byCase.set(f.caseId, []);
  byCase.get(f.caseId).push(f);
}
const scoresPath = path.join(JUDGE_DIR, 'scores.json');
const existing = existsSync(scoresPath) ? JSON.parse(readFileSync(scoresPath, 'utf8')).renders : [];
const doneBundles = new Set(existing.map((r) => r.bundleId));

const results = [...existing];
for (const [caseId, list] of [...byCase.entries()].sort()) {
  if (onlyCases && !onlyCases.has(caseId)) continue;
  const pending = list.filter((f) => !doneBundles.has(f.bundleId));
  if (pending.length === 0) continue;
  const label = `batch-${caseId}`;
  console.log(`judging ${label} (${pending.length} frames)...`);
  try {
    const judged = await judgeBatch(pending, label);
    for (const j of judged) {
      const mustFix = [...(j.verdict.mustFix ?? [])];
      for (const v of j.meta?.depViolations ?? []) mustFix.push({ defect: 'DEP_GATE_VIOLATION', region: `disallowed source ${v}` });
      const rtErr = j.meta?.probe?.moduleRuntimeError;
      if (rtErr) mustFix.push({ defect: 'RUNTIME_ERROR', region: String(rtErr).slice(0, 200) });
      results.push({
        bundleId: j.bundleId, arm: j.arm, contestant: j.contestant, caseId: j.caseId, tag: j.tag,
        score: j.verdict.score, mustFix, notes: j.verdict.notes,
        renderable: !j.meta?.transformError && j.meta?.parsed !== false,
        probeStatus: j.meta?.probe?.status ?? null,
        moduleRuntimeError: rtErr ?? null,
      });
    }
    writeFileSync(scoresPath, JSON.stringify({
      judgedBy: 'claude-fable-5 (PRE-BLINDED anonymous frame paths, comparative per-case batches incl. both arms, 2 calibration exemplars, W-BAKE pass-2 rubric)',
      renders: results,
    }, null, 2));
  } catch (err) {
    console.error(`  batch ${label} FAILED: ${err?.message}`);
  }
}
console.log(`scores.json: ${results.length} renders scored; judge spend $${ledger.totals.subscriptionEquivalentUsd.toFixed(2)} (subscription-equivalent)`);
