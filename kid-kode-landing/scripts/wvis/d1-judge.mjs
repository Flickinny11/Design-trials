#!/usr/bin/env node
// W-VIS D1.5 — blind re-judge for D1 phases (iter1 | iter2 | control) under
// the W-BAKEB standard verbatim (I-V3): PRE-BLINDED anonymous 800px JPEGs in
// per-case sha-ordered batches; judge ROTATION with zero self-judging
// (Fable 5 judges every non-Fable render; Opus 4.8 judges Fable's); same DL
// rubric + the same 2 calibration exemplars; deterministic dep-gate +
// runtime-error MUST-FIX injection. Mappings under judge/blind-<phase>/ are
// git-committed AFTER judging completes; the judge only ever sees anonymous
// paths.
//
// Judging rides the founder claude CLI — subscription-equivalent, ledgered
// separately (ledger-judge-d1-<phase>.json), never counted against the $85
// metered cap (W-BAKEB cap semantics).
//
// Usage: node scripts/wvis/d1-judge.mjs --phase iter1|iter2|control [--batch-size 6]

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, WVIS, pexecFile, CLEAN_CWD } from './wvis-lib.mjs';
import { RUBRIC, EXEMPLARS, loadCases, specBrief as rubricSpecBrief, VERDICT_SHAPE } from '../bakeoff/rubric.mjs';

const require_ = createRequire(import.meta.url);
const sharp = require_(path.join(ROOT, 'node_modules', 'sharp'));

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PHASE = argOf('--phase', null);
const BATCH = Number(argOf('--batch-size', '6'));
if (!['iter1', 'iter2', 'control'].includes(PHASE)) { console.error('need --phase iter1|iter2|control'); process.exit(2); }

const D1 = path.join(WVIS, 'd1');
const FRAMES_DIR = path.join(D1, `frames-${PHASE}`);
const JUDGE_DIR = path.join(D1, 'judge');
const BLIND_DIR = path.join(JUDGE_DIR, `blind-${PHASE}`);
const LEDGER_PATH = path.join(WVIS, 'ledgers', `ledger-judge-d1-${PHASE}.json`);
const FABLE = 'claude-fable-5';

mkdirSync(JUDGE_DIR, { recursive: true });
const ledger = existsSync(LEDGER_PATH) ? JSON.parse(readFileSync(LEDGER_PATH, 'utf8')) : { wave: 'wvis-d1-judge', phase: PHASE, calls: [], totals: { meteredUsd: 0, subscriptionEquivalentUsd: 0 } };
function ledgerAdd(entry) {
  ledger.calls.push(entry);
  ledger.totals.subscriptionEquivalentUsd = ledger.calls.reduce((s, c) => s + (c.costUsd ?? 0), 0);
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

const cases = loadCases();
const specBrief = (caseId) => rubricSpecBrief(cases, caseId);
const sha = (s) => createHash('sha256').update(s).digest('hex');

function collectFrames() {
  const out = [];
  let contestants = [];
  try { contestants = readdirSync(FRAMES_DIR); } catch { return out; }
  for (const cid of contestants) {
    const dir = path.join(FRAMES_DIR, cid);
    let files; try { files = readdirSync(dir); } catch { continue; }
    for (const f of files.filter((x) => x.endsWith('.png'))) {
      const metaPath = path.join(dir, f.replace(/\.png$/, '.meta.json'));
      const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
      const caseId = /^(v-\d+[a-z0-9-]*?)-r\d+$/.exec(f.replace(/\.png$/, ''))?.[1] ?? null;
      out.push({ contestant: cid, frame: path.join(dir, f), tag: f.replace(/\.png$/, ''), caseId, bundleId: meta.bundle ?? `wvis/${cid}/${f.replace(/\.png$/, '')}`, meta });
    }
  }
  return out;
}

async function judgeBatch(batch, label, judgeModel) {
  const blindCaseDir = path.join(BLIND_DIR, label);
  mkdirSync(blindCaseDir, { recursive: true });
  const ordered = [...batch].sort((a, b) => sha(a.bundleId + 'wvis-blind').localeCompare(sha(b.bundleId + 'wvis-blind')));
  const mapping = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const b = ordered[i];
    const blindPath = path.join(blindCaseDir, `F${i + 1}.jpg`);
    await sharp(b.frame).resize({ width: 800 }).jpeg({ quality: 82 }).toFile(blindPath);
    b.blindPath = blindPath;
    mapping.push({ label: `F${i + 1}`, bundleId: b.bundleId, contestant: b.contestant, source: path.relative(ROOT, b.frame) });
  }
  writeFileSync(path.join(blindCaseDir, 'mapping.json'), JSON.stringify(mapping, null, 2));

  const lines = [RUBRIC, ''];
  lines.push(`CALIBRATION EXEMPLARS (not scored): read ${EXEMPLARS[0]} and ${EXEMPLARS[1]}`);
  lines.push('');
  ordered.forEach((b, i) => { lines.push(`FRAME F${i + 1}: read the image at ${b.blindPath}`); lines.push(`CASE SPEC for F${i + 1}:`); lines.push(specBrief(b.caseId)); lines.push(''); });
  lines.push('Read ALL images listed above, then reply with STRICT JSON only (no fences):');
  lines.push(VERDICT_SHAPE);
  const prompt = lines.join('\n');

  const t0 = Date.now();
  const { stdout } = await pexecFile('claude', [
    '--print', '--model', judgeModel,
    '--settings', '{"hooks":{},"disableAllHooks":true}',
    '--allowedTools', 'Read', '--no-session-persistence',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    '--output-format', 'json', prompt,
  ], { maxBuffer: 64 * 1024 * 1024, timeout: 900000, cwd: CLEAN_CWD });
  const env = JSON.parse(stdout);
  const wallMs = Date.now() - t0;
  writeFileSync(path.join(JUDGE_DIR, `${PHASE}-${label}.json`), JSON.stringify({ label, phase: PHASE, judgedAt: new Date().toISOString(), judgeModel, route: 'claude-cli-print', frames: ordered.map((b, i) => ({ label: `F${i + 1}`, blindPath: path.relative(ROOT, b.blindPath) })), mappingFile: path.relative(ROOT, path.join(blindCaseDir, 'mapping.json')), costUsd: env.total_cost_usd, durationApiMs: env.duration_api_ms, wallMs, usage: env.usage, result: env.result }, null, 2));
  ledgerAdd({ batch: label, judgeModel, frames: ordered.length, costUsd: env.total_cost_usd ?? 0, billing: 'subscription-equivalent', at: new Date().toISOString() });

  let text = (env.result ?? '').trim();
  if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  if (!text.startsWith('{')) { const s = text.indexOf('{'); const e = text.lastIndexOf('}'); if (s >= 0 && e > s) text = text.slice(s, e + 1); }
  const parsed = JSON.parse(text);
  return parsed.frames.map((f, i) => { const idx = Number(String(f.frame).replace('F', '')) - 1; return { ...ordered[idx >= 0 && idx < ordered.length ? idx : i], verdict: f }; });
}

const frames = collectFrames();
const pools = [
  { judgeModel: 'claude-fable-5', frames: frames.filter((f) => f.contestant !== FABLE) },
  { judgeModel: 'claude-opus-4-8', frames: frames.filter((f) => f.contestant === FABLE) },
];

const scoresPath = path.join(D1, `scores-${PHASE}.json`);
const existing = existsSync(scoresPath) ? JSON.parse(readFileSync(scoresPath, 'utf8')).renders : [];
const doneBundles = new Set(existing.map((r) => r.bundleId));
const results = [...existing];

function chunk(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }

for (const pool of pools) {
  const byCase = new Map();
  for (const f of pool.frames) { if (!f.caseId) continue; if (!byCase.has(f.caseId)) byCase.set(f.caseId, []); byCase.get(f.caseId).push(f); }
  for (const [caseId, list] of [...byCase.entries()].sort()) {
    const pending = list.filter((f) => !doneBundles.has(f.bundleId));
    if (pending.length === 0) continue;
    const batches = chunk(pending, BATCH);
    for (let bi = 0; bi < batches.length; bi += 1) {
      const label = `batch-${pool.judgeModel === FABLE ? 'fab' : 'op'}-${caseId}-${bi + 1}`;
      console.log(`[d1-judge ${PHASE}] ${label} (${batches[bi].length} frames) via ${pool.judgeModel}...`);
      try {
        const judged = await judgeBatch(batches[bi], label, pool.judgeModel);
        for (const j of judged) {
          const mustFix = [...(j.verdict.mustFix ?? [])];
          for (const v of j.meta?.depViolations ?? []) mustFix.push({ defect: 'DEP_GATE_VIOLATION', region: `disallowed source ${v}` });
          const rtErr = j.meta?.probe?.moduleRuntimeError;
          if (rtErr) mustFix.push({ defect: 'RUNTIME_ERROR', region: String(rtErr).slice(0, 200) });
          results.push({ bundleId: j.bundleId, phase: PHASE, contestant: j.contestant, caseId: j.caseId, tag: j.tag, judgeModel: pool.judgeModel, score: j.verdict.score, mustFix, notes: j.verdict.notes, renderable: !j.meta?.transformError && j.meta?.parsed !== false, probeStatus: j.meta?.probe?.status ?? null, moduleRuntimeError: rtErr ?? null, nodeMounted: j.meta?.probe?.nodeMounted ?? null });
          doneBundles.add(j.bundleId);
        }
        writeFileSync(scoresPath, JSON.stringify({ judgedBy: 'ROTATION: claude-fable-5 (all non-Fable) + claude-opus-4-8 (Fable renders). PRE-BLINDED anonymous 800px JPEGs, per-case sha-ordered batches, 2 calibration exemplars, W-BAKE pass-2 DL rubric. W-VIS D1 phase: ' + PHASE, renders: results }, null, 2));
      } catch (err) { console.error(`  batch ${label} FAILED: ${err?.message}`); }
    }
  }
}
console.log(`[d1-judge ${PHASE}] scores-${PHASE}.json: ${results.length} renders; judge spend $${ledger.totals.subscriptionEquivalentUsd.toFixed(2)} (subscription-equivalent)`);
