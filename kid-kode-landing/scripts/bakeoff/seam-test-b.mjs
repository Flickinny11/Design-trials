#!/usr/bin/env node
// W-BAKE-B D5 — Mercury seam test (delta-executor hypothesis). A seam
// AUDITION, not a routing decision.
//
// 20 REAL region-anchored critic deltas are collected from the D3 judge
// output (scores.json): failing renders (score < 60), one judge-emitted
// MUST-FIX delta each (deterministic sha-ordered selection; the injected
// DEP_GATE_VIOLATION / RUNTIME_ERROR rows are excluded — those are
// deterministic gate injections, not critic deltas). Each executor
// (mercury-2 — substituting for the unreachable mercury-coder, disclosed —
// and claude-haiku-4.5) applies ALL 20 deltas: original module + the delta
// (defect, region, judge note) -> corrected full module, under the SAME
// L1 v2.1 + frozen L2 system prompt.
//
// Phases (run in order):
//   --select              -> notes/bakeoff-b/seam/plan.json
//   --execute <executor>  -> corrected modules + seam bundles + index
//   --judge               -> Fable-5 before/after region verdicts (blind to executor)
//   --metrics             -> notes/bakeoff-b/seam-metrics.json
// (capture between execute and judge:
//   node scripts/bakeoff/capture-b.mjs --index notes/bakeoff-b/seam/bundles-index.json
//        --frames-root notes/bakeoff-b/seam/frames --port 3111)
//
// Budget: executor calls ledger to notes/bakeoff-b/ledgers/ledger-seam-<x>.json
// (picked up by every global-cap scan); judge ledger merged-cap checked here.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { CONTESTANTS, ROUTES, ROOT, providerKey } from './contestants-b.mjs';
import { loadCases, specBrief } from './rubric.mjs';

const require_ = createRequire(import.meta.url);
const esbuild = require_(path.join(ROOT, 'node_modules', 'esbuild'));
const sharp = require_(path.join(ROOT, 'node_modules', 'sharp'));
const pexecFile = promisify(execFile);

const B = path.join(ROOT, 'notes', 'bakeoff-b');
const SEAM = path.join(B, 'seam');
const LEDGERS = path.join(B, 'ledgers');
const SEAM_BUNDLES_ROOT = path.join(ROOT, 'notes', 'bakeoff', 'renders', 'bundles', 'wbakeb-seam');
const HARD_CAP_USD = 120; const MARGIN = 0.5;
const sha = (s) => createHash('sha256').update(s).digest('hex');

const EXECUTORS = {
  'mercury-2': CONTESTANTS.find((c) => c.id === 'mercury-2'),
  'claude-haiku-4.5': CONTESTANTS.find((c) => c.id === 'claude-haiku-4.5'),
};

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

const RUBRIC_DEFECTS = new Set(['FLAT_VOID', 'ALL_BLACK_ELEMENT', 'DEFAULT_BLUE_DRIFT', 'DEAD_LIGHTING', 'BROKEN_COMPOSITION', 'GARBLED_TEXT', 'MISSING_SPEC_ELEMENT', 'OFF_PALETTE', 'BLANK_RENDER', 'LOW_CONTRAST', 'SCALE_ERROR', 'BLOWN_WHITE_KEY']);

function extractModule(raw) {
  const t = (raw ?? '').trim();
  if (!t) return { parsed: false, source: null };
  if (!t.includes('```')) { const ok = t.includes('export default'); return { parsed: ok, source: ok ? t : null }; }
  const blocks = [...t.matchAll(/```(?:javascript|js|typescript|ts)?\s*\n([\s\S]*?)```/g)].map((m) => m[1]);
  const best = blocks.sort((a, b) => b.length - a.length)[0] ?? '';
  const ok = best.includes('export default');
  return { parsed: ok, source: ok ? best.trim() : null };
}

// ── phase: select ────────────────────────────────────────────────────────────
if (args.includes('--select')) {
  const scores = JSON.parse(readFileSync(path.join(B, 'judge', 'scores.json'), 'utf8')).renders;
  const candidates = scores
    .filter((r) => typeof r.score === 'number' && r.score < 60 && r.renderable)
    .map((r) => {
      const delta = (r.mustFix ?? []).find((m) => RUBRIC_DEFECTS.has(m.defect) && m.region);
      return delta ? { ...r, delta } : null;
    })
    .filter(Boolean)
    .sort((a, b) => sha(a.bundleId + 'wbakeb-seam').localeCompare(sha(b.bundleId + 'wbakeb-seam')));
  // one delta per distinct render, contestant-diverse (cap 4 per contestant)
  const picked = [];
  const perContestant = new Map();
  for (const c of candidates) {
    if (picked.length >= 20) break;
    if ((perContestant.get(c.contestant) ?? 0) >= 4) continue;
    picked.push(c);
    perContestant.set(c.contestant, (perContestant.get(c.contestant) ?? 0) + 1);
  }
  // fallback: relax the contestant cap if under 20
  for (const c of candidates) {
    if (picked.length >= 20) break;
    if (!picked.includes(c)) picked.push(c);
  }
  const plan = picked.map((r, i) => {
    const runRec = JSON.parse(readFileSync(path.join(B, 'runs', 'design', r.contestant, `${r.tag}.json`), 'utf8'));
    const src = extractModule(runRec.output);
    return {
      seamId: `s-${String(i + 1).padStart(2, '0')}`,
      bundleId: r.bundleId, contestant: r.contestant, caseId: r.caseId, tag: r.tag,
      d3Score: r.score,
      delta: { defect: r.delta.defect, region: r.delta.region, judgeNote: r.notes ?? '' },
      sourceParsed: src.parsed,
      beforeFrame: path.relative(ROOT, path.join(B, 'frames', r.contestant, `${r.tag}.png`)),
    };
  }).filter((p) => p.sourceParsed);
  mkdirSync(SEAM, { recursive: true });
  writeFileSync(path.join(SEAM, 'plan.json'), JSON.stringify({
    builtAt: new Date().toISOString(),
    method: '20 region-anchored judge MUST-FIX deltas from failing D3 renders (score<60, renderable, judge-emitted rubric defects only, sha-ordered, contestant cap 4)',
    deltas: plan,
  }, null, 2));
  console.log(`seam plan: ${plan.length} deltas across ${new Set(plan.map((p) => p.contestant)).size} contestants`);
  process.exit(0);
}

// ── phase: execute ───────────────────────────────────────────────────────────
async function callExecutor(ct, system, user) {
  const r = ROUTES[ct.route];
  const key = providerKey(ct.route);
  if (!key) throw new Error(`no key for route ${ct.route}`);
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const t0 = Date.now();
    try {
      const reqBody = { model: ct.model, max_tokens: 16384, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
      if (ct.route === 'openrouter') reqBody.reasoning = { max_tokens: 2048 };
      const res = await fetch(r.chatUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(r.extraHeaders ?? {}) },
        body: JSON.stringify(reqBody), signal: AbortSignal.timeout(300000),
      });
      const wallMs = Date.now() - t0;
      const body = await res.text();
      if (res.status === 429 || res.status >= 500) { lastErr = `HTTP ${res.status}: ${body.slice(0, 160)}`; await new Promise((ok) => setTimeout(ok, 2000 * 2 ** attempt)); continue; }
      const parsed = JSON.parse(body);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(parsed?.error ?? parsed).slice(0, 200)}`);
      const usage = parsed.usage ?? {};
      return { text: parsed.choices?.[0]?.message?.content ?? '', wallMs, usage: { promptTokens: usage.prompt_tokens ?? null, completionTokens: usage.completion_tokens ?? null } };
    } catch (err) { lastErr = String(err?.message ?? err); if (attempt === 4) break; await new Promise((ok) => setTimeout(ok, 2000 * 2 ** attempt)); }
  }
  throw new Error(`transport failure after retries: ${lastErr}`);
}

if (args.includes('--execute')) {
  const execId = argOf('--execute', null);
  const ct = EXECUTORS[execId];
  if (!ct) { console.error(`unknown executor ${execId} (mercury-2 | claude-haiku-4.5)`); process.exit(2); }
  const L1 = readFileSync(path.join(B, 'l1-v2.1-system.txt'), 'utf8');
  const L2 = readFileSync(path.join(B, 'l2-world-frozen.txt'), 'utf8');
  const SYSTEM = `${L1}\n\n${L2}`;
  const plan = JSON.parse(readFileSync(path.join(SEAM, 'plan.json'), 'utf8')).deltas;
  const OUT = path.join(SEAM, 'exec', execId);
  mkdirSync(OUT, { recursive: true });
  const LEDGER_PATH = path.join(LEDGERS, `ledger-seam-${execId}.json`);
  const ledger = existsSync(LEDGER_PATH) ? JSON.parse(readFileSync(LEDGER_PATH, 'utf8'))
    : { wave: 'wbakeb-seam', executor: execId, route: ct.route, model: ct.model, calls: [], totals: { meteredUsd: 0, subscriptionEquivalentUsd: 0, totalUsd: 0 } };
  const globalSpend = () => readdirSync(LEDGERS).filter((x) => x.endsWith('.json')).reduce((t, f) => { try { return t + (JSON.parse(readFileSync(path.join(LEDGERS, f), 'utf8')).totals?.totalUsd ?? 0); } catch { return t; } }, 0);
  for (const d of plan) {
    const outPath = path.join(OUT, `${d.seamId}.json`);
    if (existsSync(outPath)) { try { if (JSON.parse(readFileSync(outPath, 'utf8')).ok) continue; } catch { /* */ } }
    if (globalSpend() >= HARD_CAP_USD - MARGIN) { console.error('!! GLOBAL cap reached — stopping seam execute'); break; }
    const runRec = JSON.parse(readFileSync(path.join(B, 'runs', 'design', d.contestant, `${d.tag}.json`), 'utf8'));
    const src = extractModule(runRec.output).source;
    const user = [
      'A design critic reviewed the rendered output of the module below and anchored ONE defect to a region.',
      `DEFECT: ${d.delta.defect}`,
      `REGION: ${d.delta.region}`,
      d.delta.judgeNote ? `CRITIC NOTE: ${d.delta.judgeNote}` : '',
      '',
      'Apply the SMALLEST change that fixes this defect in that region while preserving everything else.',
      'Reply with the COMPLETE corrected module (same contract: export default createNode(config, ctx)). Code only.',
      '',
      'CURRENT MODULE:',
      '```javascript',
      src,
      '```',
    ].filter(Boolean).join('\n');
    try {
      const r = await callExecutor(ct, SYSTEM, user);
      const costUsd = ((r.usage.promptTokens ?? 0) / 1e6) * (ct.usdPerMTokIn ?? 0) + ((r.usage.completionTokens ?? 0) / 1e6) * (ct.usdPerMTokOut ?? 0);
      writeFileSync(outPath, JSON.stringify({ ok: true, seamId: d.seamId, executor: execId, output: r.text, wallMs: r.wallMs, usage: r.usage, costUsd }, null, 2));
      ledger.calls.push({ seamId: d.seamId, promptTokens: r.usage.promptTokens, completionTokens: r.usage.completionTokens, costUsd, billing: 'metered', at: new Date().toISOString() });
      ledger.totals.meteredUsd = ledger.calls.reduce((s, c) => s + (c.costUsd ?? 0), 0);
      ledger.totals.totalUsd = ledger.totals.meteredUsd;
      writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
      console.log(`[${execId}] ${d.seamId} ok (${r.wallMs}ms, $${costUsd.toFixed(4)})`);
    } catch (err) {
      writeFileSync(outPath, JSON.stringify({ ok: false, seamId: d.seamId, executor: execId, transportError: String(err?.message ?? err).slice(0, 300) }, null, 2));
      console.error(`[${execId}] ${d.seamId} TRANSPORT ERROR: ${err?.message}`);
    }
  }
  // bundle everything executed so far (both executors) into ONE seam index
  const ALLOWED = new Set(['three/webgpu', 'three/tsl', 'gsap', '@/primitives', '@/text']);
  const cases = loadCases();
  const index = [];
  for (const ex of Object.keys(EXECUTORS)) {
    const dir = path.join(SEAM, 'exec', ex);
    if (!existsSync(dir)) continue;
    const outDir = path.join(SEAM_BUNDLES_ROOT, ex);
    mkdirSync(outDir, { recursive: true });
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const rec = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
      if (!rec.ok) continue;
      const d = plan.find((x) => x.seamId === rec.seamId);
      const c = cases.get(d.caseId);
      const ext = extractModule(rec.output);
      const tag = rec.seamId;
      const bundle = { id: `wbakeb-seam/${ex}/${tag}`, contestant: ex, caseId: d.caseId, run: 1, node: c.node, sceneSpec: c.sceneSpec, parsed: ext.parsed, depGate: { sources: [], violations: [] }, cjs: null, transformError: null };
      if (ext.parsed && ext.source) {
        const sources = new Set();
        for (const m of ext.source.matchAll(/(?:import\s+[^'"]*?from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)) sources.add(m[1]);
        bundle.depGate = { sources: [...sources], violations: [...sources].filter((s) => !ALLOWED.has(s)) };
        try { bundle.cjs = esbuild.transformSync(ext.source, { format: 'cjs', loader: 'ts', target: 'es2022' }).code; }
        catch (err) { bundle.transformError = String(err?.message ?? err).slice(0, 400); }
      }
      writeFileSync(path.join(outDir, `${tag}.json`), JSON.stringify(bundle, null, 2));
      index.push({ id: bundle.id, contestant: ex, caseId: d.caseId, run: 1, renderable: Boolean(bundle.cjs), parsed: ext.parsed, fenced: false, depViolations: bundle.depGate.violations, transformError: bundle.transformError });
    }
  }
  index.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(path.join(SEAM, 'bundles-index.json'), JSON.stringify({ bundles: index }, null, 2));
  console.log(`seam bundles: ${index.length} (${index.filter((b) => b.renderable).length} renderable)`);
  process.exit(0);
}

// ── phase: judge ─────────────────────────────────────────────────────────────
if (args.includes('--judge')) {
  const plan = JSON.parse(readFileSync(path.join(SEAM, 'plan.json'), 'utf8')).deltas;
  const cases = loadCases();
  const BLIND = path.join(SEAM, 'blind');
  const LEDGER_PATH = path.join(SEAM, 'ledger-seam-judge.json');
  const ledger = existsSync(LEDGER_PATH) ? JSON.parse(readFileSync(LEDGER_PATH, 'utf8')) : { wave: 'wbakeb-seam-judge', calls: [], totals: { subscriptionEquivalentUsd: 0 } };
  const genSpend = () => readdirSync(LEDGERS).filter((x) => x.endsWith('.json')).reduce((t, f) => { try { return t + (JSON.parse(readFileSync(path.join(LEDGERS, f), 'utf8')).totals?.totalUsd ?? 0); } catch { return t; } }, 0);
  const verdictsPath = path.join(SEAM, 'judge-verdicts.json');
  const verdicts = existsSync(verdictsPath) ? JSON.parse(readFileSync(verdictsPath, 'utf8')).verdicts : [];
  const doneKeys = new Set(verdicts.map((v) => `${v.executor}/${v.seamId}`));
  const jobs = [];
  for (const ex of Object.keys(EXECUTORS)) {
    for (const d of plan) {
      const frame = path.join(SEAM, 'frames', ex, `${d.seamId}.png`);
      const key = `${ex}/${d.seamId}`;
      if (doneKeys.has(key)) continue;
      jobs.push({ ex, d, frame, exists: existsSync(frame) });
    }
  }
  // blind copies: anonymous hash-ordered ids so the judge never sees executor names
  mkdirSync(BLIND, { recursive: true });
  const mapping = [];
  for (const j of jobs) {
    j.blindId = `S${sha(`${j.ex}/${j.d.seamId}wbakeb-seam-blind`).slice(0, 8)}`;
    mapping.push({ blindId: j.blindId, executor: j.ex, seamId: j.d.seamId });
    if (j.exists) {
      j.afterBlind = path.join(BLIND, `${j.blindId}-after.jpg`);
      j.beforeBlind = path.join(BLIND, `${j.blindId}-before.jpg`);
      await sharp(j.frame).resize({ width: 800 }).jpeg({ quality: 82 }).toFile(j.afterBlind);
      await sharp(path.join(ROOT, j.d.beforeFrame)).resize({ width: 800 }).jpeg({ quality: 82 }).toFile(j.beforeBlind);
    }
  }
  writeFileSync(path.join(BLIND, 'mapping.json'), JSON.stringify(mapping, null, 2));
  for (const j of jobs.sort((a, b) => a.blindId.localeCompare(b.blindId))) {
    if (!j.exists) {
      verdicts.push({ executor: j.ex, seamId: j.d.seamId, fixed: false, reason: 'no re-rendered frame (unrenderable or crash)', judgeModel: null });
      writeFileSync(verdictsPath, JSON.stringify({ verdicts }, null, 2));
      continue;
    }
    const prompt = [
      'You are verifying ONE targeted design fix on a rendered frame.',
      `Image BEFORE: read ${j.beforeBlind}`,
      `Image AFTER: read ${j.afterBlind}`,
      `The critic delta being applied: defect ${j.d.delta.defect} anchored at region "${j.d.delta.region}".`,
      'CASE SPEC:',
      specBrief(cases, j.d.caseId),
      '',
      'Judge ONLY whether that defect in that region is fixed in AFTER (and not replaced by an equal-or-worse defect in the same region). The rest of the frame is out of scope.',
      'Reply STRICT JSON only: {"fixed": true|false, "regionNowShows": "<short>", "notes": "<short>"}',
    ].join('\n');
    const { stdout } = await pexecFile('claude', [
      '--print', '--model', 'claude-fable-5',
      '--settings', '{"hooks":{},"disableAllHooks":true}',
      '--allowedTools', 'Read', '--no-session-persistence',
      '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
      '--output-format', 'json', prompt,
    ], { maxBuffer: 64 * 1024 * 1024, timeout: 600000, cwd: '/tmp/wbake-clean' });
    const env = JSON.parse(stdout);
    ledger.calls.push({ blindId: j.blindId, costUsd: env.total_cost_usd ?? 0, billing: 'subscription-equivalent', at: new Date().toISOString() });
    ledger.totals.subscriptionEquivalentUsd = ledger.calls.reduce((s, c) => s + (c.costUsd ?? 0), 0);
    writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
    if (genSpend() + ledger.totals.subscriptionEquivalentUsd >= HARD_CAP_USD - MARGIN) { console.error('!! MERGED cap — stopping seam judge'); break; }
    let text = (env.result ?? '').trim();
    if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    const s = text.indexOf('{'); const e = text.lastIndexOf('}');
    let v = { fixed: false, notes: 'unparseable verdict' };
    try { v = JSON.parse(text.slice(s, e + 1)); } catch { /* */ }
    verdicts.push({ executor: j.ex, seamId: j.d.seamId, fixed: Boolean(v.fixed), regionNowShows: v.regionNowShows ?? null, notes: v.notes ?? null, judgeModel: 'claude-fable-5', costUsd: env.total_cost_usd ?? 0 });
    writeFileSync(verdictsPath, JSON.stringify({ verdicts }, null, 2));
    console.log(`${j.blindId} (${j.ex}/${j.d.seamId}): fixed=${v.fixed}`);
  }
  console.log(`seam judge verdicts: ${verdicts.length}`);
  process.exit(0);
}

// ── phase: metrics ───────────────────────────────────────────────────────────
if (args.includes('--metrics')) {
  const plan = JSON.parse(readFileSync(path.join(SEAM, 'plan.json'), 'utf8')).deltas;
  const verdicts = JSON.parse(readFileSync(path.join(SEAM, 'judge-verdicts.json'), 'utf8')).verdicts;
  const perExec = {};
  for (const ex of Object.keys(EXECUTORS)) {
    const execDir = path.join(SEAM, 'exec', ex);
    const recs = existsSync(execDir) ? readdirSync(execDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(path.join(execDir, f), 'utf8'))) : [];
    const okRecs = recs.filter((r) => r.ok);
    const vs = verdicts.filter((v) => v.executor === ex);
    const walls = okRecs.map((r) => r.wallMs).sort((a, b) => a - b);
    perExec[ex] = {
      deltasAttempted: recs.length,
      transportErrors: recs.filter((r) => !r.ok).length,
      rendered: vs.filter((v) => v.judgeModel).length,
      fixSuccess: vs.filter((v) => v.fixed).length,
      fixSuccessRate: vs.length ? vs.filter((v) => v.fixed).length / vs.length : null,
      p50WallMs: walls.length ? walls[Math.floor(walls.length / 2)] : null,
      meanCostPerFixUsd: okRecs.length ? okRecs.reduce((s, r) => s + (r.costUsd ?? 0), 0) / okRecs.length : null,
    };
  }
  const out = { computedAt: new Date().toISOString(), note: 'seam AUDITION, not a routing decision; mercury-2 substitutes for unreachable mercury-coder (disclosed)', deltas: plan.length, perExecutor: perExec };
  writeFileSync(path.join(B, 'seam-metrics.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(perExec, null, 2));
}
