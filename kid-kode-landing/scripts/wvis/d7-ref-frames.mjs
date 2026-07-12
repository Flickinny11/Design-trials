#!/usr/bin/env node
// W-VIS D7.2 (D4) — one composition reference frame per frozen case via the
// COMMITTED FLUX pipeline (.assetgen/gen-flux.py, Replicate flux-2-pro).
// Prompt = buildCompositionFramePrompt(case node with the plan's preset
// selections injected) — same bytes production would use. Deterministic seed
// per case. Frames land at notes/wvis/d7/ref-frames/<caseId>.png; a manifest
// records the arm per case ('image' or, on generation failure, the labeled
// 'text-fallback'). Metered cost ledgered per call (Replicate flux-2-pro
// published ~$0.04/image at 1MP — estimate, noted).

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ROOT, WVIS, openLedger, capReached } from './wvis-lib.mjs';

const pexec = promisify(execFile);
const require_ = createRequire(import.meta.url);
const esbuild = require_(path.join(ROOT, 'node_modules', 'esbuild'));
esbuild.buildSync({ entryPoints: [path.join(ROOT, 'src/lib/prism/codegen/reference-frame.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: '/tmp/wvis-refframe.mjs', alias: { '@': path.join(ROOT, 'src') } });
const rf = await import(pathToFileURL('/tmp/wvis-refframe.mjs').href);

const D7 = path.join(WVIS, 'd7');
const OUT = path.join(D7, 'ref-frames');
mkdirSync(OUT, { recursive: true });
const GEN_FLUX = path.resolve(ROOT, '..', '.assetgen', 'gen-flux.py');

const plan = JSON.parse(readFileSync(path.join(D7, 'plan.json'), 'utf8'));
const CORPUS = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'visual', 'cases');
const cases = new Map(readdirSync(CORPUS).filter((f) => f.endsWith('.json'))
  .map((f) => { const c = JSON.parse(readFileSync(path.join(CORPUS, f), 'utf8')); return [c.caseId, c]; }));

const { add: ledgerAdd } = openLedger('d7-ref-frames', { phase: 'd7', provider: 'replicate-flux-2-pro' });

const manifest = { generatedAt: new Date().toISOString(), frames: {} };
let idx = 0;
for (const pc of plan.cases) {
  idx += 1;
  const c = cases.get(pc.caseId);
  const out = path.join(OUT, `${pc.caseId}.png`);
  if (existsSync(out)) { manifest.frames[pc.caseId] = { arm: 'image', path: path.relative(ROOT, out), cached: true }; continue; }
  if (capReached()) { manifest.frames[pc.caseId] = { arm: 'text-fallback', reason: 'metered cap reached' }; continue; }
  // Inject the plan's preset selections so the frame reflects the director's picks.
  const node = JSON.parse(JSON.stringify(c.node));
  node.intent = node.intent ?? {};
  node.intent.visualSpec = node.intent.visualSpec ?? {};
  node.intent.visualSpec.presetSelections = pc.presetSelections;
  const prompt = rf.buildCompositionFramePrompt(node);
  const seed = 1000 + idx;
  try {
    const t0 = Date.now();
    await pexec('python3', [GEN_FLUX, prompt, out, '16:9', '1 MP', 'png', String(seed)], { timeout: 300000 });
    const wallMs = Date.now() - t0;
    ledgerAdd({ phase: 'd7-ref-frames', caseId: pc.caseId, seed, wallMs, costUsd: 0.04, billing: 'metered', rateNote: 'Replicate flux-2-pro 1MP published-rate estimate' });
    manifest.frames[pc.caseId] = { arm: 'image', path: path.relative(ROOT, out), seed, prompt: prompt.slice(0, 400), wallMs };
    console.log(`[d7-ref] ${pc.caseId} frame ok (${(wallMs / 1000).toFixed(1)}s)`);
  } catch (err) {
    manifest.frames[pc.caseId] = { arm: 'text-fallback', reason: String(err?.message ?? err).slice(0, 200) };
    console.error(`[d7-ref] ${pc.caseId} FLUX failed -> text-fallback arm (${String(err?.message ?? err).slice(0, 120)})`);
  }
}
writeFileSync(path.join(D7, 'ref-frames-manifest.json'), JSON.stringify(manifest, null, 2));
const imgArm = Object.values(manifest.frames).filter((f) => f.arm === 'image').length;
console.log(`[d7-ref] ${imgArm}/${plan.cases.length} image-arm frames; ${plan.cases.length - imgArm} text-fallback (labeled)`);
