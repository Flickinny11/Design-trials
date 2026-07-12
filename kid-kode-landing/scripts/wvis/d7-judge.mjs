#!/usr/bin/env node
// W-VIS D7.5 — blind judge for the upgraded-lane frames, W-BAKEB standard
// (I-V3): pre-blinded anonymous 800px JPEGs, per-case sha-ordered batches,
// rotation with zero self-judging (Fable judges the sonnet lane; Opus judges
// the Fable lane), same DL rubric + calibration exemplars. D4 item 10: when a
// case carries an image-arm reference frame, the batch includes it (labeled
// REFERENCE, not scored) and each verdict adds "frameFidelity" 0-100 —
// render-vs-frame fidelity alongside the DL score.
//
// Output: notes/wvis/d7/scores.json. Judge rides the founder CLI
// (subscription-equivalent, ledgered separately).
//
// Usage: node scripts/wvis/d7-judge.mjs [--batch-size 6]

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ROOT, WVIS, pexecFile, CLEAN_CWD } from './wvis-lib.mjs';
import { RUBRIC, EXEMPLARS, loadCases, specBrief as rubricSpecBrief } from '../bakeoff/rubric.mjs';

const require_ = createRequire(import.meta.url);
const sharp = require_(path.join(ROOT, 'node_modules', 'sharp'));
const esbuild = require_(path.join(ROOT, 'node_modules', 'esbuild'));
esbuild.buildSync({ entryPoints: [path.join(ROOT, 'src/lib/prism/codegen/reference-frame.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: '/tmp/wvis-refframe.mjs', alias: { '@': path.join(ROOT, 'src') } });
const { FRAME_FIDELITY_RUBRIC_ADDENDUM } = await import(pathToFileURL('/tmp/wvis-refframe.mjs').href);

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BATCH = Number(argOf('--batch-size', '6'));

const D7 = path.join(WVIS, 'd7');
const JUDGE_DIR = path.join(D7, 'judge');
const BLIND_DIR = path.join(JUDGE_DIR, 'blind');
const LEDGER_PATH = path.join(WVIS, 'ledgers', 'ledger-judge-d7.json');
mkdirSync(JUDGE_DIR, { recursive: true });

const refManifest = JSON.parse(readFileSync(path.join(D7, 'ref-frames-manifest.json'), 'utf8'));
const ledger = existsSync(LEDGER_PATH) ? JSON.parse(readFileSync(LEDGER_PATH, 'utf8')) : { wave: 'wvis-d7-judge', calls: [], totals: { meteredUsd: 0, subscriptionEquivalentUsd: 0 } };
function ledgerAdd(entry) {
  ledger.calls.push(entry);
  ledger.totals.subscriptionEquivalentUsd = ledger.calls.reduce((s, c) => s + (c.costUsd ?? 0), 0);
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

const cases = loadCases();
const specBrief = (caseId) => rubricSpecBrief(cases, caseId);
const sha = (s) => createHash('sha256').update(s).digest('hex');
const VERDICT_SHAPE_D7 = '{ "frames": [ { "frame": "F1", "score": <0-100>, "frameFidelity": <0-100 or null when no REFERENCE image listed>, "mustFix": [ { "defect": "...", "region": "..." } ], "notes": "<=25 words" } ] }';

function collectFrames() {
  const out = [];
  const FR = path.join(D7, 'frames');
  let models = [];
  try { models = readdirSync(FR); } catch { return out; }
  for (const cid of models) {
    const dir = path.join(FR, cid);
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.png'))) {
      const metaPath = path.join(dir, f.replace(/\.png$/, '.meta.json'));
      const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
      const caseId = /^(v-\d+[a-z0-9-]*?)-r\d+$/.exec(f.replace(/\.png$/, ''))?.[1] ?? null;
      out.push({ contestant: cid, frame: path.join(dir, f), tag: f.replace(/\.png$/, ''), caseId, bundleId: meta.bundle ?? `wvis-d7/${cid}/${f.replace(/\.png$/, '')}`, meta });
    }
  }
  return out;
}

async function judgeBatch(batch, label, judgeModel) {
  const blindCaseDir = path.join(BLIND_DIR, label);
  mkdirSync(blindCaseDir, { recursive: true });
  const ordered = [...batch].sort((a, b) => sha(a.bundleId + 'wvis-d7-blind').localeCompare(sha(b.bundleId + 'wvis-d7-blind')));
  const mapping = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const b = ordered[i];
    const blindPath = path.join(blindCaseDir, `F${i + 1}.jpg`);
    await sharp(b.frame).resize({ width: 800 }).jpeg({ quality: 82 }).toFile(blindPath);
    b.blindPath = blindPath;
    mapping.push({ label: `F${i + 1}`, bundleId: b.bundleId, contestant: b.contestant, source: path.relative(ROOT, b.frame) });
  }
  writeFileSync(path.join(blindCaseDir, 'mapping.json'), JSON.stringify(mapping, null, 2));

  const lines = [RUBRIC, '', FRAME_FIDELITY_RUBRIC_ADDENDUM, ''];
  lines.push(`CALIBRATION EXEMPLARS (not scored): read ${EXEMPLARS[0]} and ${EXEMPLARS[1]}`);
  lines.push('');
  for (let i = 0; i < ordered.length; i += 1) {
    const b = ordered[i];
    lines.push(`FRAME F${i + 1}: read the image at ${b.blindPath}`);
    const ref = refManifest.frames[b.caseId];
    if (ref?.arm === 'image' && ref.path) {
      const refBlind = path.join(blindCaseDir, `REF${i + 1}.jpg`);
      if (!existsSync(refBlind)) await sharp(path.join(ROOT, ref.path)).resize({ width: 800 }).jpeg({ quality: 82 }).toFile(refBlind);
      lines.push(`REFERENCE image for F${i + 1} (art-directed composition reference — NOT scored): read ${refBlind}`);
    }
    lines.push(`CASE SPEC for F${i + 1}:`);
    lines.push(specBrief(b.caseId));
    lines.push('');
  }
  lines.push('Read ALL images listed above, then reply with STRICT JSON only (no fences):');
  lines.push(VERDICT_SHAPE_D7);
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
  writeFileSync(path.join(JUDGE_DIR, `${label}.json`), JSON.stringify({ label, judgedAt: new Date().toISOString(), judgeModel, frames: ordered.map((b, i) => ({ label: `F${i + 1}`, blindPath: path.relative(ROOT, b.blindPath) })), mappingFile: path.relative(ROOT, path.join(blindCaseDir, 'mapping.json')), costUsd: env.total_cost_usd, wallMs: Date.now() - t0, usage: env.usage, result: env.result }, null, 2));
  ledgerAdd({ batch: label, judgeModel, frames: ordered.length, costUsd: env.total_cost_usd ?? 0, billing: 'subscription-equivalent', at: new Date().toISOString() });

  let text = (env.result ?? '').trim();
  if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  if (!text.startsWith('{')) { const s = text.indexOf('{'); const e = text.lastIndexOf('}'); if (s >= 0 && e > s) text = text.slice(s, e + 1); }
  const parsed = JSON.parse(text);
  return parsed.frames.map((f, i) => { const idx = Number(String(f.frame).replace('F', '')) - 1; return { ...ordered[idx >= 0 && idx < ordered.length ? idx : i], verdict: f }; });
}

const frames = collectFrames();
const pools = [
  { judgeModel: 'claude-fable-5', frames: frames.filter((f) => f.contestant !== 'claude-fable-5') },
  { judgeModel: 'claude-opus-4-8', frames: frames.filter((f) => f.contestant === 'claude-fable-5') },
];

const scoresPath = path.join(D7, 'scores.json');
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
    for (let bi = 0; bi < chunk(pending, BATCH).length; bi += 1) {
      const b = chunk(pending, BATCH)[bi];
      const label = `batch-${pool.judgeModel === 'claude-fable-5' ? 'fab' : 'op'}-${caseId}-${bi + 1}`;
      console.log(`[d7-judge] ${label} (${b.length} frames) via ${pool.judgeModel}...`);
      try {
        const judged = await judgeBatch(b, label, pool.judgeModel);
        for (const j of judged) {
          const mustFix = [...(j.verdict.mustFix ?? [])];
          for (const v of j.meta?.depViolations ?? []) mustFix.push({ defect: 'DEP_GATE_VIOLATION', region: `disallowed source ${v}` });
          const rtErr = j.meta?.probe?.moduleRuntimeError;
          if (rtErr) mustFix.push({ defect: 'RUNTIME_ERROR', region: String(rtErr).slice(0, 200) });
          results.push({ bundleId: j.bundleId, contestant: j.contestant, caseId: j.caseId, tag: j.tag, run: Number(/-r(\d+)$/.exec(j.tag)?.[1] ?? 0), judgeModel: pool.judgeModel, score: j.verdict.score, frameFidelity: j.verdict.frameFidelity ?? null, mustFix, notes: j.verdict.notes, renderable: !j.meta?.transformError && j.meta?.parsed !== false, probeStatus: j.meta?.probe?.status ?? null, moduleRuntimeError: rtErr ?? null, nodeMounted: j.meta?.probe?.nodeMounted ?? null });
          doneBundles.add(j.bundleId);
        }
        writeFileSync(scoresPath, JSON.stringify({ judgedBy: 'ROTATION: claude-fable-5 (sonnet lane) + claude-opus-4-8 (fable lane). PRE-BLINDED anonymous 800px JPEGs, per-case sha-ordered batches, DL rubric + D4 frameFidelity addendum, 2 calibration exemplars.', renders: results }, null, 2));
      } catch (err) { console.error(`  batch ${label} FAILED: ${err?.message}`); }
    }
  }
}
console.log(`[d7-judge] scores.json: ${results.length} renders; judge spend $${ledger.totals.subscriptionEquivalentUsd.toFixed(2)} (subscription-equivalent)`);
