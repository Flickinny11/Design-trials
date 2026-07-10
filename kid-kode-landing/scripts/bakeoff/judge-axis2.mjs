#!/usr/bin/env node
// W-BAKE D3 — the Fable 5 design judge (OD12a / wave prompt #11).
//
// Scores every captured Axis-2 frame 0-100 against the frozen visualSpec +
// Design Law DL1-DL16 with a region-anchored rubric and enumerated MUST-FIX
// defects. Judging is COMPARATIVE-per-case (all contestants' frames for one
// case ride one call — fairest calibration) and BLIND (frames are labeled
// F1..Fn; contestant names never appear in the prompt; the frame files
// themselves are pre-blinded at capture time). Two committed design-grammar
// exemplars ride every call as calibration anchors.
//
// Route: claude CLI print (--allowedTools Read), model claude-fable-5.
// Transcripts: notes/bakeoff/judge/axis2/batch-*.json (I-B3).
// Merged scores (incl. the deterministic dep-gate MUST-FIX and unrenderable
// generations, which score 0 with defect NO_RENDER): judge/axis2/scores.json.
//
// Usage: node scripts/bakeoff/judge-axis2.mjs [--include-seeded]

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { ROOT } from './contestants.mjs';
import { RUBRIC, EXEMPLARS, loadCases, specBrief as rubricSpecBrief, VERDICT_SHAPE } from './rubric.mjs';

const pexecFile = promisify(execFile);
const FRAMES_DIR = path.join(ROOT, 'notes', 'bakeoff', 'renders', 'frames');
const BUNDLES_DIR = path.join(ROOT, 'notes', 'bakeoff', 'renders', 'bundles');
const VISUAL = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'visual');
const JUDGE_DIR = path.join(ROOT, 'notes', 'bakeoff', 'judge', 'axis2');
const LEDGER_PATH = path.join(ROOT, 'notes', 'bakeoff', 'ledger-judge.json');

const args = process.argv.slice(2);
const includeSeeded = args.includes('--include-seeded');

const ledger = existsSync(LEDGER_PATH)
  ? JSON.parse(readFileSync(LEDGER_PATH, 'utf8'))
  : { wave: 'wbake-judge', calls: [], totals: { subscriptionEquivalentUsd: 0 } };
function ledgerAdd(entry) {
  ledger.calls.push(entry);
  ledger.totals.subscriptionEquivalentUsd = ledger.calls.reduce((s, c) => s + (c.costUsd ?? 0), 0);
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

const cases = loadCases();

// Collect frames: frames/<contestant>/<tag>.png with meta.
function collectFrames() {
  const out = [];
  for (const cid of readdirSync(FRAMES_DIR)) {
    if (!includeSeeded && cid === 'seeded-bad') continue;
    const dir = path.join(FRAMES_DIR, cid);
    let files;
    try { files = readdirSync(dir); } catch { continue; }
    for (const f of files.filter((x) => x.endsWith('.png'))) {
      const metaPath = path.join(dir, f.replace(/\.png$/, '.meta.json'));
      const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
      const fromBundle = meta.bundle?.split('/')?.[1]?.replace(/-r\d+$/, '') ?? null;
      const caseId = /^(v-\d+[a-z0-9-]*?)-r\d+$/.exec(f.replace(/\.png$/, ''))?.[1] ?? fromBundle;
      const bundleId = meta.bundle ?? `${cid}/${f.replace(/\.png$/, '')}`;
      out.push({ contestant: cid, frame: path.join(dir, f), tag: f.replace(/\.png$/, ''), caseId, bundleId, meta });
    }
  }
  return out;
}

const specBrief = (caseId) => rubricSpecBrief(cases, caseId);

async function judgeBatch(batch, label) {
  const lines = [RUBRIC, ''];
  lines.push(`CALIBRATION EXEMPLARS (not scored): read ${EXEMPLARS[0]} and ${EXEMPLARS[1]}`);
  lines.push('');
  batch.forEach((b, i) => {
    lines.push(`FRAME F${i + 1}: read the image at ${b.frame}`);
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
    frames: batch.map((b, i) => ({ label: `F${i + 1}`, bundleId: b.bundleId, frame: path.relative(ROOT, b.frame) })),
    costUsd: env.total_cost_usd, durationApiMs: env.duration_api_ms, wallMs, usage: env.usage,
    result: env.result,
  }, null, 2));
  ledgerAdd({ axis: 'axis2-judge', model: 'claude-fable-5', batch: label, frames: batch.length, costUsd: env.total_cost_usd ?? 0, billing: 'subscription-equivalent', at: new Date().toISOString() });

  let text = (env.result ?? '').trim();
  if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(text);
  return parsed.frames.map((f, i) => {
    const idx = Number(String(f.frame).replace('F', '')) - 1;
    return { ...batch[idx >= 0 && idx < batch.length ? idx : i], verdict: f };
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

mkdirSync(JUDGE_DIR, { recursive: true });
const frames = collectFrames();
const byCase = new Map();
for (const f of frames) {
  if (!byCase.has(f.caseId)) byCase.set(f.caseId, []);
  byCase.get(f.caseId).push(f);
}
const scoresPath = path.join(JUDGE_DIR, 'scores.json');
const existing = existsSync(scoresPath) ? JSON.parse(readFileSync(scoresPath, 'utf8')).renders : [];
const doneBundles = new Set(existing.map((r) => r.bundleId));

const results = [...existing];
let batchNo = existing.length > 0 ? Math.max(0, ...existing.map((r) => r.batchNo ?? 0)) : 0;
for (const [caseId, list] of [...byCase.entries()].sort()) {
  const pending = list.filter((f) => !doneBundles.has(f.bundleId)).sort((a, b) => a.bundleId.localeCompare(b.bundleId));
  for (let i = 0; i < pending.length; i += 6) {
    const batch = pending.slice(i, i + 6);
    batchNo += 1;
    const label = `batch-${String(batchNo).padStart(3, '0')}-${caseId}`;
    console.log(`judging ${label} (${batch.length} frames)...`);
    try {
      const judged = await judgeBatch(batch, label);
      for (const j of judged) {
        // Merge the deterministic dep-gate MUST-FIX (wave prompt #12).
        const bundlePath = path.join(BUNDLES_DIR, `${j.bundleId}.json`);
        let depViolations = [];
        let renderable = true;
        if (existsSync(bundlePath)) {
          const b = JSON.parse(readFileSync(bundlePath, 'utf8'));
          depViolations = b.depGate?.violations ?? [];
          renderable = Boolean(b.cjs);
        }
        const mustFix = [...(j.verdict.mustFix ?? [])];
        for (const v of depViolations) mustFix.push({ defect: 'DEP_GATE_VIOLATION', region: `disallowed source ${v}` });
        results.push({
          bundleId: j.bundleId, contestant: j.contestant, caseId: j.caseId, tag: j.tag, batchNo,
          score: j.verdict.score, mustFix, notes: j.verdict.notes,
          renderable, probeStatus: j.meta?.probe?.status ?? null, renderables: j.meta?.probe?.renderables ?? null,
        });
      }
      writeFileSync(scoresPath, JSON.stringify({ judgedBy: 'claude-fable-5 (blind, comparative per-case batches, 2 calibration exemplars)', renders: results }, null, 2));
    } catch (err) {
      console.error(`  batch ${label} FAILED: ${err?.message}`);
    }
  }
}

// Unrenderable generations (no frame): score 0, NO_RENDER (disclosed rule).
const bundlesIndex = JSON.parse(readFileSync(path.join(BUNDLES_DIR, 'index.json'), 'utf8')).bundles;
for (const b of bundlesIndex) {
  if (b.contestant === 'seeded-bad') continue;
  if (!b.renderable && !doneBundles.has(b.id) && !results.some((r) => r.bundleId === b.id)) {
    results.push({
      bundleId: b.id, contestant: b.contestant, caseId: b.caseId, tag: `${b.caseId}-r${b.run}`,
      score: 0,
      mustFix: [{ defect: 'NO_RENDER', region: 'whole frame' }, ...(b.depViolations ?? []).map((v) => ({ defect: 'DEP_GATE_VIOLATION', region: `disallowed source ${v}` }))],
      notes: b.transformError ? `transform error: ${b.transformError.slice(0, 80)}` : 'unparseable/unrenderable generation',
      renderable: false, probeStatus: 'no-frame', renderables: 0,
    });
  }
}
writeFileSync(scoresPath, JSON.stringify({ judgedBy: 'claude-fable-5 (blind, comparative per-case batches, 2 calibration exemplars)', renders: results }, null, 2));
console.log(`scores.json: ${results.length} renders scored; judge spend $${ledger.totals.subscriptionEquivalentUsd.toFixed(2)} (subscription-equivalent)`);
