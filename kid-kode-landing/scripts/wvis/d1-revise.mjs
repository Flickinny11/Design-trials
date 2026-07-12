#!/usr/bin/env node
// W-VIS D1.2 — the LOOP ARM. SAME-MODEL revision (signed repair law) given
// the blind judge's critique AND (vision arm) the model's own captured frame,
// downscaled to the identical 800px JPEG the judge saw. Text-only models get
// the critique alone (arm labeled in every artifact). Up to 2 iterations:
//   iter 1 revises the original W-BAKEB render;
//   iter 2 revises the iter-1 module using the iter-1 blind re-judge critique
//          + iter-1 frame, only for renders still < 85.
//
// System prompt = L1 v2.1 + frozen L2, byte-identical to W-BAKEB generation.
// Routes (fresh D0 probes): claude/gemini/kimi/glm/deepseek -> OpenRouter
// (re-funded), mercury-2 -> Inception, gpt-oss-120b -> Fireworks. DeepInfra
// is 402-dead this wave.
//
// Ledger: notes/wvis/ledgers/ledger-d1-revise-iter<N>.json (metered), under
// the D1 $35 phase cap + $85 global cap.
//
// Usage: node scripts/wvis/d1-revise.mjs --iter 1|2 [--concurrency 4]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, WVIS, openLedger, capReached, callOpenAICompat, extractModule, D1_CAP_USD } from './wvis-lib.mjs';

const require_ = createRequire(import.meta.url);
const sharp = require_(path.join(ROOT, 'node_modules', 'sharp'));

const B = path.join(ROOT, 'notes', 'bakeoff-b');
const D1 = path.join(WVIS, 'd1');

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ITER = Number(argOf('--iter', '1'));
const CONC = Number(argOf('--concurrency', '4'));
const ONLY = argOf('--only', null); // substring filter on bundleId, for smoke tests
if (![1, 2].includes(ITER)) { console.error('need --iter 1|2'); process.exit(2); }

const L1 = readFileSync(path.join(B, 'l1-v2.1-system.txt'), 'utf8');
const L2 = readFileSync(path.join(B, 'l2-world-frozen.txt'), 'utf8');
const SYSTEM = `${L1}\n\n${L2}`;

// Model -> live route map (fresh probes, notes/wvis/probes/). Prices $/MTok.
export const D1_ROUTES = {
  'claude-fable-5': { route: 'openrouter', model: 'anthropic/claude-fable-5', inRate: 10.0, outRate: 50.0 },
  'claude-opus-4.8': { route: 'openrouter', model: 'anthropic/claude-opus-4.8', inRate: 5.0, outRate: 25.0 },
  'claude-sonnet-5': { route: 'openrouter', model: 'anthropic/claude-sonnet-5', inRate: 2.0, outRate: 10.0 },
  'claude-haiku-4.5': { route: 'openrouter', model: 'anthropic/claude-haiku-4.5', inRate: 1.0, outRate: 5.0 },
  'gemini-3.5-flash': { route: 'openrouter', model: 'google/gemini-3.5-flash', inRate: 1.5, outRate: 9.0 },
  'kimi-k2.7-code': { route: 'openrouter', model: 'moonshotai/kimi-k2.7-code', inRate: 0.72, outRate: 3.5 },
  'glm-5.2': { route: 'openrouter', model: 'z-ai/glm-5.2', inRate: 0.42, outRate: 1.32 },
  'deepseek-v4-flash': { route: 'openrouter', model: 'deepseek/deepseek-v4-flash', inRate: 0.08, outRate: 0.15 },
  'mercury-2': { route: 'inception', model: 'mercury-2', inRate: 0.25, outRate: 0.75 },
  'gpt-oss-120b': { route: 'fireworks', model: 'accounts/fireworks/models/gpt-oss-120b', inRate: 0.15, outRate: 0.6 },
};

const sampleDoc = JSON.parse(readFileSync(path.join(D1, 'sample.json'), 'utf8'));

// Work items per iteration.
let items = [];
if (ITER === 1) {
  items = sampleDoc.sample.map((s) => ({
    ...s,
    critique: { score: s.originalScore, mustFix: s.mustFix, notes: s.judgeNotes, runtimeError: s.moduleRuntimeError },
    prevModuleFrom: 'wbakeb-source',
    prevFrame: s.framePath,
    newRun: s.sourceRun * 10 + 1,
  }));
} else {
  const it1 = JSON.parse(readFileSync(path.join(D1, 'scores-iter1.json'), 'utf8')).renders;
  const byTag = new Map(it1.map((r) => [`${r.contestant}/${r.tag}`, r]));
  for (const s of sampleDoc.sample) {
    const t1 = `${s.caseId}-r${s.sourceRun * 10 + 1}`;
    const j = byTag.get(`${s.contestant}/${t1}`);
    if (!j) { continue; } // iter-1 revision failed transport/parse — disclosed by metrics
    if (j.score >= 85) continue; // converged — no iteration 2
    const runRec = path.join(D1, 'runs', 'iter1', s.contestant, `${t1}.json`);
    if (!existsSync(runRec)) continue;
    items.push({
      ...s,
      critique: { score: j.score, mustFix: j.mustFix, notes: j.notes, runtimeError: j.moduleRuntimeError },
      prevModuleFrom: path.relative(ROOT, runRec),
      prevFrame: path.join('notes', 'wvis', 'd1', 'frames-iter1', s.contestant, `${t1}.png`),
      newRun: s.sourceRun * 10 + 2,
    });
  }
}

const RUNS_DIR = path.join(D1, 'runs', `iter${ITER}`);
const { add: ledgerAdd } = openLedger(`d1-revise-iter${ITER}`, { phase: 'd1', iter: ITER });

function revisionPrompt(item, prevModule) {
  const lines = [];
  lines.push(`REVISION TASK — see-then-revise, iteration ${ITER} of 2.`);
  lines.push('');
  lines.push(`You previously generated the module below for this exact spec. A blind design judge scored it ${item.critique.score}/100 against the spec and the Prism Design Law (85+ = founder-shippable). Its MUST-FIX defects, each anchored to a region of the rendered frame:`);
  for (const mf of item.critique.mustFix ?? []) lines.push(`- ${mf.defect} — ${mf.region}`);
  if (item.critique.notes) lines.push(`Judge notes: ${item.critique.notes}`);
  if (item.critique.runtimeError) lines.push(`Your module also threw at runtime: ${String(item.critique.runtimeError).slice(0, 300)}`);
  lines.push('');
  if (item.arm === 'vision') {
    lines.push('The attached image is the captured render of YOUR module, exactly as the judge saw it. Study it region by region against the critique before writing any code.');
  } else {
    lines.push('(No render image is available on this channel — work from the region-anchored critique alone.)');
  }
  lines.push('');
  lines.push('Revise the module to eliminate EVERY listed defect while preserving what already works. Keep the identical technical contract: same import allowlist, export default createNode(config, ctx), TSL-only shaders, full cleanup in userData.cleanup. Return ONLY the complete revised module source — no diff, no commentary.');
  lines.push('');
  lines.push('=== ORIGINAL SPEC (unchanged) ===');
  lines.push(item.l3);
  lines.push('');
  lines.push('=== YOUR PREVIOUS MODULE ===');
  lines.push(prevModule);
  return lines.join('\n');
}

// Original L3 strings come from the frozen corpus.
const CORPUS = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'visual', 'cases');
const l3ByCase = new Map();
for (const f of (await import('node:fs')).readdirSync(CORPUS).filter((x) => x.endsWith('.json'))) {
  const c = JSON.parse(readFileSync(path.join(CORPUS, f), 'utf8'));
  l3ByCase.set(c.caseId, c.l3);
}

async function frameDataUrl(relPath) {
  const abs = path.join(ROOT, relPath);
  const jpeg = await sharp(abs).resize({ width: 800 }).jpeg({ quality: 82 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

function prevModuleSource(item) {
  const rec = JSON.parse(readFileSync(path.join(ROOT, item.prevModuleFrom === 'wbakeb-source' ? item.runFile : item.prevModuleFrom), 'utf8'));
  const ex = extractModule(rec.output);
  if (ex.source) return ex.source;
  // Iteration-1 output failed the parse gate (no export-default module found).
  // A real loop still iterates: feed the RAW previous output back so the model
  // can see and fix its own format failure (BLANK_RENDER critique explains
  // the render side). Only possible for iter-2 inputs; W-BAKEB sources in the
  // sample are always renderable.
  return rec.output ?? null;
}

async function runOne(item) {
  const rt = D1_ROUTES[item.contestant];
  if (!rt) return 'skip';
  const tag = `${item.caseId}-r${item.newRun}`;
  const outDir = path.join(RUNS_DIR, item.contestant);
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${tag}.json`);
  if (existsSync(outPath)) { try { if (JSON.parse(readFileSync(outPath, 'utf8')).ok) return 'skip'; } catch { /* */ } }

  const l3 = l3ByCase.get(item.caseId);
  const prevModule = prevModuleSource(item);
  if (!l3 || !prevModule) { writeFileSync(outPath, JSON.stringify({ ok: false, error: 'missing l3 or previous module' }, null, 2)); return 'err'; }
  const promptText = revisionPrompt({ ...item, l3 }, prevModule);

  let user;
  if (item.arm === 'vision') {
    const img = await frameDataUrl(item.prevFrame);
    user = [{ type: 'text', text: promptText }, { type: 'image_url', image_url: { url: img } }];
  } else {
    user = promptText;
  }

  let rec;
  try {
    const r = await callOpenAICompat({ route: rt.route, model: rt.model, system: SYSTEM, user });
    const costUsd = r.usage.promptTokens != null ? (r.usage.promptTokens * rt.inRate + r.usage.completionTokens * rt.outRate) / 1e6 : null;
    rec = {
      wave: 'wvis-d1', iter: ITER, arm: item.arm, contestant: item.contestant, model: rt.model, route: rt.route,
      caseId: item.caseId, sourceTag: item.sourceTag, tag, run: item.newRun,
      critiqueFed: item.critique, frameFed: item.arm === 'vision' ? item.prevFrame : null,
      ok: true, wallMs: r.wallMs, finishReason: r.finishReason, usage: r.usage, costUsd, billing: 'metered', output: r.text,
    };
    ledgerAdd({ phase: `d1-revise-iter${ITER}`, contestant: item.contestant, arm: item.arm, caseId: item.caseId, tag, promptTokens: r.usage.promptTokens, completionTokens: r.usage.completionTokens, costUsd: costUsd ?? 0, billing: 'metered', rateNote: 'estimate from live-probed per-MTok rates 2026-07-11' });
  } catch (err) {
    rec = { wave: 'wvis-d1', iter: ITER, arm: item.arm, contestant: item.contestant, caseId: item.caseId, tag, ok: false, transportError: String(err?.message ?? err) };
  }
  writeFileSync(outPath, JSON.stringify(rec, null, 2));
  return rec.ok ? 'ok' : 'err';
}

if (ONLY) items = items.filter((i) => i.bundleId.includes(ONLY));
if (capReached('d1', D1_CAP_USD)) { console.log('[d1-revise] cap already reached — no runs'); process.exit(0); }
console.log(`[d1-revise iter${ITER}] ${items.length} revisions (vision ${items.filter((i) => i.arm === 'vision').length} / text ${items.filter((i) => i.arm !== 'vision').length})`);

const q = [...items];
let done = 0; let err = 0; let stopped = false;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (q.length && !stopped) {
    if (capReached('d1', D1_CAP_USD)) { stopped = true; break; }
    const item = q.shift();
    if (!item) break;
    const r = await runOne(item);
    done += 1; if (r === 'err') err += 1;
    if (done % 10 === 0) console.log(`  ...${done}/${items.length} (${err} err)`);
  }
}));
console.log(`[d1-revise iter${ITER}] done ${done}/${items.length} (${err} errors)${stopped ? ' [STOPPED AT CAP]' : ''}`);
