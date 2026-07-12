#!/usr/bin/env node
// W-VIS D7.3 — the UPGRADED design lane (D2+D3+D4+D5+D6 all active) over the
// frozen 20 visual specs. Per model (claude-sonnet-5 contestant floor,
// claude-fable-5 ceiling reference):
//
//   stage gen:     frozen L3 + D3 preset numbers (director plan) + D4
//                  reference frame (image arm on multimodal routes;
//                  labeled text fallback otherwise) + D6 2-nearest exemplars
//                  + D2 spec-manifest block, wrapped by the D6 protocol
//                  wrapper (checklist LAST). D2 gate rejects an incomplete
//                  manifest back to the generator — ONE retry.
//   stage revise1: see-then-revise (D5 DEFAULT) — the SAME model reads its
//                  own captured frame + the reference frame, self-reviews,
//                  returns the full revised module. All cases.
//   stage revise2: hero cases only (OD11 budget hero <=2 seen iterations).
//
// Runs land at notes/wvis/d7/runs/<model>/<case>-r10{0,1,2}.json.
// L1 v2.1 + frozen L2 system bytes are UNCHANGED (upgrades ride the user
// turn — disclosed in the report).
//
// Usage: node scripts/wvis/d7-lane.mjs --model claude-sonnet-5 --stage gen
//          [--route openrouter|claude-cli] [--concurrency 3]

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ROOT, WVIS, openLedger, capReached, callOpenAICompat, callClaudeCli, extractModule } from './wvis-lib.mjs';

const require_ = createRequire(import.meta.url);
const esbuild = require_(path.join(ROOT, 'node_modules', 'esbuild'));
const sharp = require_(path.join(ROOT, 'node_modules', 'sharp'));

function importTs(entry, out) {
  esbuild.buildSync({ entryPoints: [path.join(ROOT, entry)], bundle: true, format: 'esm', platform: 'neutral', outfile: out, alias: { '@': path.join(ROOT, 'src') } });
  return import(pathToFileURL(out).href);
}
const presets = await importTs('src/lib/prism/design-presets/index.ts', '/tmp/wvis-presets.mjs');
const manifest = await importTs('src/lib/prism/codegen/spec-manifest.ts', '/tmp/wvis-manifest.mjs');
const wrappers = await importTs('src/lib/prism/codegen/model-wrappers.ts', '/tmp/wvis-wrappers.mjs');
const exemplars = await importTs('src/lib/prism/codegen/exemplar-registry.ts', '/tmp/wvis-exemplars.mjs');
const refframe = await importTs('src/lib/prism/codegen/reference-frame.ts', '/tmp/wvis-refframe.mjs');
const lane = await importTs('src/lib/prism/codegen/design-lane.ts', '/tmp/wvis-lane.mjs');

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const MODEL = argOf('--model', null);
const STAGE = argOf('--stage', null);
const ROUTE = argOf('--route', 'openrouter');
const CONC = Number(argOf('--concurrency', '3'));
if (!['claude-sonnet-5', 'claude-fable-5'].includes(MODEL)) { console.error('need --model claude-sonnet-5|claude-fable-5'); process.exit(2); }
if (!['gen', 'revise1', 'revise2'].includes(STAGE)) { console.error('need --stage gen|revise1|revise2'); process.exit(2); }

const OR_MODEL = MODEL === 'claude-sonnet-5' ? 'anthropic/claude-sonnet-5' : 'anthropic/claude-fable-5';
const CLI_MODEL = MODEL === 'claude-sonnet-5' ? 'claude-sonnet-5' : 'claude-fable-5';
const RATES = MODEL === 'claude-sonnet-5' ? { in: 2.0, out: 10.0 } : { in: 10.0, out: 50.0 };

const B = path.join(ROOT, 'notes', 'bakeoff-b');
const D7 = path.join(WVIS, 'd7');
const L1 = readFileSync(path.join(B, 'l1-v2.1-system.txt'), 'utf8');
const L2 = readFileSync(path.join(B, 'l2-world-frozen.txt'), 'utf8');
const SYSTEM = `${L1}\n\n${L2}`;

const plan = JSON.parse(readFileSync(path.join(D7, 'plan.json'), 'utf8'));
const refManifest = JSON.parse(readFileSync(path.join(D7, 'ref-frames-manifest.json'), 'utf8'));
const CORPUS = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'visual', 'cases');
const cases = new Map(readdirSync(CORPUS).filter((f) => f.endsWith('.json'))
  .map((f) => { const c = JSON.parse(readFileSync(path.join(CORPUS, f), 'utf8')); return [c.caseId, c]; }));

const RUNS_DIR = path.join(D7, 'runs', MODEL);
mkdirSync(RUNS_DIR, { recursive: true });
const { add: ledgerAdd } = openLedger(`d7-${MODEL}`, { phase: 'd7', model: MODEL, route: ROUTE });

async function jpegDataUrl(absPath) {
  const jpeg = await sharp(absPath).resize({ width: 800 }).jpeg({ quality: 82 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

function nodeWithSelections(pc) {
  const c = cases.get(pc.caseId);
  const node = JSON.parse(JSON.stringify(c.node));
  node.intent = node.intent ?? {};
  node.intent.visualSpec = node.intent.visualSpec ?? {};
  node.intent.visualSpec.presetSelections = pc.presetSelections;
  return node;
}

function taskBody(pc, { forRevision = false } = {}) {
  const c = cases.get(pc.caseId);
  const node = nodeWithSelections(pc);
  const refArm = refManifest.frames[pc.caseId]?.arm ?? 'text-fallback';
  const els = manifest.extractSpecElements(node);
  const parts = [c.l3];
  parts.push('', 'DESIGN PRESETS (render-proven — execute these numbers, do not invent your own):');
  parts.push(presets.buildPresetSelectionPromptBlock(pc.presetSelections));
  parts.push('', refframe.buildReferenceFrameBlock(refArm, node));
  if (!forRevision) {
    parts.push('', exemplars.buildExemplarBlock(exemplars.selectNearestExemplars(node, 2, pc.category === '3d')));
  }
  parts.push('', '--- SPEC MANIFEST ---', manifest.buildSpecManifestPromptBlock(els));
  return { body: parts.filter((x) => x !== null).join('\n'), els, refArm };
}

async function callModel({ user, images = [] }) {
  if (ROUTE === 'claude-cli') {
    // Founder-CLI lane (subscription-equivalent, disclosed): images ride as
    // Read-tool paths appended to the prompt (the W-BAKEB vision-judge idiom).
    let prompt = typeof user === 'string' ? user : user.map((p) => p.text ?? '').join('\n');
    for (const img of images) prompt = `${img.label}: read the image at ${img.absPath}\n\n${prompt}`;
    const r = await callClaudeCli({ model: CLI_MODEL, system: SYSTEM, user: prompt, allowRead: images.length > 0, effort: 'low' });
    return { text: r.text, wallMs: r.wallMs, usage: r.usage, costUsd: r.costUsd ?? 0, billing: 'subscription-equivalent', route: 'claude-cli' };
  }
  const content = images.length === 0 ? user : [
    { type: 'text', text: typeof user === 'string' ? user : user },
    ...(await Promise.all(images.map(async (img) => ({ type: 'image_url', image_url: { url: await jpegDataUrl(img.absPath) } })))),
  ];
  const r = await callOpenAICompat({ route: 'openrouter', model: OR_MODEL, system: SYSTEM, user: content });
  const costUsd = r.usage.promptTokens != null ? (r.usage.promptTokens * RATES.in + r.usage.completionTokens * RATES.out) / 1e6 : 0;
  return { text: r.text, wallMs: r.wallMs, usage: r.usage, costUsd, billing: 'metered', route: 'openrouter', finishReason: r.finishReason };
}

function gate(outputText, els) {
  const ex = extractModule(outputText);
  if (!ex.parsed || !ex.source) return { pass: false, reason: 'PARSE_FAILURE', gateResult: null };
  const res = manifest.checkSpecManifestSource(ex.source, els);
  return { pass: res.ok, reason: res.ok ? null : 'SPEC_MANIFEST_INCOMPLETE', gateResult: { manifestPresent: res.manifestPresent, unmapped: res.unmapped.map((e) => e.id), unknown: res.unknown }, feedback: res.ok ? null : manifest.buildManifestRetryFeedback(res), source: ex.source };
}

async function runGen(pc) {
  const tag = `${pc.caseId}-r100`;
  const outPath = path.join(RUNS_DIR, `${tag}.json`);
  if (existsSync(outPath)) { try { if (JSON.parse(readFileSync(outPath, 'utf8')).ok) return 'skip'; } catch { /* */ } }
  const { body, els, refArm } = taskBody(pc);
  const user = wrappers.wrapUserTurn(OR_MODEL, body);
  const images = [];
  if (refArm === 'image' && refManifest.frames[pc.caseId]?.path) {
    images.push({ label: 'REFERENCE COMPOSITION FRAME', absPath: path.join(ROOT, refManifest.frames[pc.caseId].path) });
  }
  let rec;
  try {
    let r = await callModel({ user, images });
    ledgerAdd({ stage: 'gen', caseId: pc.caseId, attempt: 1, promptTokens: r.usage.promptTokens, completionTokens: r.usage.completionTokens, costUsd: r.costUsd, billing: r.billing, route: r.route });
    let g = gate(r.text, els);
    let retried = false;
    if (!g.pass && !capReached()) {
      retried = true;
      const retryUser = wrappers.wrapUserTurn(OR_MODEL, `${g.feedback ?? `Your output failed the deterministic parse gate (${g.reason}). Return ONLY the complete raw module source.`}\n\n${body}`);
      const r2 = await callModel({ user: retryUser, images });
      ledgerAdd({ stage: 'gen', caseId: pc.caseId, attempt: 2, gateRetry: true, promptTokens: r2.usage.promptTokens, completionTokens: r2.usage.completionTokens, costUsd: r2.costUsd, billing: r2.billing, route: r2.route });
      const g2 = gate(r2.text, els);
      if (g2.pass || (!g.source && g2.source)) { r = r2; g = g2; }
    }
    rec = {
      wave: 'wvis-d7', model: MODEL, stage: 'gen', iter: 0, caseId: pc.caseId, tag, run: 100,
      criticality: pc.criticality, presetSelections: pc.presetSelections, referenceFrameArm: refArm,
      gate: { pass: g.pass, reason: g.reason, retried, detail: g.gateResult },
      ok: true, wallMs: r.wallMs, usage: r.usage, costUsd: r.costUsd, billing: r.billing, route: r.route, output: r.text,
    };
  } catch (err) {
    rec = { wave: 'wvis-d7', model: MODEL, stage: 'gen', caseId: pc.caseId, tag, ok: false, transportError: String(err?.message ?? err) };
  }
  writeFileSync(outPath, JSON.stringify(rec, null, 2));
  return rec.ok ? 'ok' : 'err';
}

async function runRevise(pc, iter) {
  const prevRun = 100 + iter - 1;
  const tag = `${pc.caseId}-r${100 + iter}`;
  const outPath = path.join(RUNS_DIR, `${tag}.json`);
  if (existsSync(outPath)) { try { if (JSON.parse(readFileSync(outPath, 'utf8')).ok) return 'skip'; } catch { /* */ } }
  const prevPath = path.join(RUNS_DIR, `${pc.caseId}-r${prevRun}.json`);
  if (!existsSync(prevPath)) return 'skip';
  const prevRec = JSON.parse(readFileSync(prevPath, 'utf8'));
  if (!prevRec.ok) return 'skip';
  const prevModule = extractModule(prevRec.output).source;
  if (!prevModule) { writeFileSync(outPath, JSON.stringify({ ok: false, error: 'previous iteration unparseable — kept previous as final', keptPrevious: true }, null, 2)); return 'skip'; }
  const framePath = path.join(D7, 'frames', MODEL, `${pc.caseId}-r${prevRun}.png`);
  const hasFrame = existsSync(framePath);
  const { body, refArm } = taskBody(pc, { forRevision: true });
  const prompt = lane.buildSelfRevisionPrompt({
    iteration: iter, maxIterations: pc.maxSeenIterations, critique: null, hasFrame,
    l3: body, previousModule: prevModule,
  });
  const user = wrappers.wrapUserTurn(OR_MODEL, prompt);
  const images = [];
  if (hasFrame) images.push({ label: 'YOUR CURRENT RENDER', absPath: framePath });
  if (refArm === 'image' && refManifest.frames[pc.caseId]?.path) images.push({ label: 'REFERENCE COMPOSITION FRAME', absPath: path.join(ROOT, refManifest.frames[pc.caseId].path) });
  let rec;
  try {
    const r = await callModel({ user, images });
    ledgerAdd({ stage: `revise${iter}`, caseId: pc.caseId, promptTokens: r.usage.promptTokens, completionTokens: r.usage.completionTokens, costUsd: r.costUsd, billing: r.billing, route: r.route });
    rec = {
      wave: 'wvis-d7', model: MODEL, stage: `revise${iter}`, iter, caseId: pc.caseId, tag, run: 100 + iter,
      criticality: pc.criticality, sawOwnFrame: hasFrame, referenceFrameArm: refArm,
      ok: true, wallMs: r.wallMs, usage: r.usage, costUsd: r.costUsd, billing: r.billing, route: r.route, output: r.text,
    };
  } catch (err) {
    rec = { wave: 'wvis-d7', model: MODEL, stage: `revise${iter}`, caseId: pc.caseId, tag, ok: false, transportError: String(err?.message ?? err) };
  }
  writeFileSync(outPath, JSON.stringify(rec, null, 2));
  return rec.ok ? 'ok' : 'err';
}

let items = plan.cases;
if (STAGE === 'revise2') items = plan.cases.filter((c) => c.criticality === 'hero');
if (capReached()) { console.log('[d7-lane] metered cap reached — no runs'); process.exit(0); }
console.log(`[d7-lane ${MODEL}/${STAGE}] ${items.length} cases via ${ROUTE}`);

const q = [...items];
let done = 0; let err = 0; let stopped = false;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (q.length && !stopped) {
    if (ROUTE !== 'claude-cli' && capReached()) { stopped = true; break; }
    const pc = q.shift();
    if (!pc) break;
    const r = STAGE === 'gen' ? await runGen(pc) : await runRevise(pc, STAGE === 'revise1' ? 1 : 2);
    done += 1; if (r === 'err') err += 1;
  }
}));
console.log(`[d7-lane ${MODEL}/${STAGE}] done ${done}/${items.length} (${err} errors)${stopped ? ' [STOPPED AT CAP]' : ''}`);
