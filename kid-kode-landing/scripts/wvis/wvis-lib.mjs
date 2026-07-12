// W-VIS — shared harness lib. Reuses the W-BAKEB route registry + key
// resolution (scripts/bakeoff/contestants-b.mjs) verbatim; adds the W-VIS
// budget semantics from the wave prompt:
//   HARD CAP $85 total METERED (includes D1's $35 phase cap), $0.50 stop
//   margin, per-call ledger under notes/wvis/ledgers/. Founder-CLI calls are
//   subscription-equivalent — ledgered separately, disclosed, uncapped
//   (W-BAKEB cap semantics, report §7/§8.12 of SHELL-WBAKEB-REPORT.md).
// I-V5 / INV-19: key VALUES never printed, logged, or written to artifacts.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { ROUTES, ROOT, providerKey } from '../bakeoff/contestants-b.mjs';

export { ROUTES, ROOT, providerKey };
export const pexecFile = promisify(execFile);

export const WVIS = path.join(ROOT, 'notes', 'wvis');
export const LEDGERS = path.join(WVIS, 'ledgers');
export const HARD_CAP_USD = 85;
export const D1_CAP_USD = 35;
export const MARGIN = 0.5;
export const CLEAN_CWD = '/tmp/wvis-clean';
mkdirSync(LEDGERS, { recursive: true });
mkdirSync(CLEAN_CWD, { recursive: true });

// ── ledger ────────────────────────────────────────────────────────────────
export function openLedger(name, meta = {}) {
  const p = path.join(LEDGERS, `ledger-${name}.json`);
  const ledger = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8'))
    : { wave: 'wvis', name, ...meta, calls: [], totals: { meteredUsd: 0, subscriptionEquivalentUsd: 0 } };
  const save = () => {
    ledger.totals.meteredUsd = ledger.calls.filter((c) => c.billing === 'metered').reduce((s, c) => s + (c.costUsd ?? 0), 0);
    ledger.totals.subscriptionEquivalentUsd = ledger.calls.filter((c) => c.billing === 'subscription-equivalent').reduce((s, c) => s + (c.costUsd ?? 0), 0);
    writeFileSync(p, JSON.stringify(ledger, null, 2));
  };
  const add = (entry) => { ledger.calls.push({ ...entry, at: new Date().toISOString() }); save(); };
  save();
  return { ledger, add, save, path: p };
}

// METERED spend across all W-VIS ledgers (the currency the $85 cap protects).
export function meteredSpend(prefix = null) {
  let t = 0;
  for (const f of readdirSync(LEDGERS).filter((x) => x.startsWith('ledger-') && x.endsWith('.json'))) {
    if (prefix && !f.startsWith(`ledger-${prefix}`)) continue;
    try { t += JSON.parse(readFileSync(path.join(LEDGERS, f), 'utf8')).totals?.meteredUsd ?? 0; } catch { /* */ }
  }
  return t;
}
export function subEquivSpend() {
  let t = 0;
  for (const f of readdirSync(LEDGERS).filter((x) => x.startsWith('ledger-') && x.endsWith('.json'))) {
    try { t += JSON.parse(readFileSync(path.join(LEDGERS, f), 'utf8')).totals?.subscriptionEquivalentUsd ?? 0; } catch { /* */ }
  }
  return t;
}
export function capReached(phasePrefix = null, phaseCapUsd = null) {
  const g = meteredSpend();
  if (g >= HARD_CAP_USD - MARGIN) { console.error(`!! WVIS GLOBAL cap: metered $${g.toFixed(2)} at the $${HARD_CAP_USD} margin`); return true; }
  if (phasePrefix && phaseCapUsd != null) {
    const p = meteredSpend(phasePrefix);
    if (p >= phaseCapUsd - MARGIN) { console.error(`!! WVIS ${phasePrefix} phase cap: metered $${p.toFixed(2)} at the $${phaseCapUsd} margin`); return true; }
  }
  return false;
}

// ── OpenAI-compatible chat call (text and/or vision) ──────────────────────
// content: string OR array of OpenAI content parts (text / image_url).
export async function callOpenAICompat({ route, model, system, user, maxTokens = 16384, timeoutMs = Number(process.env.WVIS_GEN_TIMEOUT_MS ?? 300000) }) {
  const r = ROUTES[route];
  const key = providerKey(route);
  if (!key) throw new Error(`no key for route ${route}`);
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(r.extraHeaders ?? {}) };
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const t0 = Date.now();
    try {
      const reqBody = { model, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
      // Reasoning bounds identical to the W-BAKEB reroute discipline (I-BB2:
      // prompt bytes untouched; transport/params only).
      if (route === 'openrouter') reqBody.reasoning = { max_tokens: 2048 };
      if (route === 'deepinfra') {
        if (model.startsWith('anthropic/')) { reqBody.thinking = { type: 'adaptive' }; reqBody.output_config = { effort: 'low' }; }
        else reqBody.reasoning_effort = 'low';
      }
      const res = await fetch(r.chatUrl, { method: 'POST', headers, body: JSON.stringify(reqBody), signal: AbortSignal.timeout(timeoutMs) });
      const wallMs = Date.now() - t0;
      const body = await res.text();
      if (res.status === 429 || res.status >= 500) { lastErr = `HTTP ${res.status}: ${body.slice(0, 160)}`; await new Promise((ok) => setTimeout(ok, 2000 * 2 ** attempt)); continue; }
      const parsed = JSON.parse(body);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(parsed?.error ?? parsed).slice(0, 250)}`);
      const usage = parsed.usage ?? {};
      return { text: parsed.choices?.[0]?.message?.content ?? '', finishReason: parsed.choices?.[0]?.finish_reason ?? null, wallMs, attempts: attempt, usage: { promptTokens: usage.prompt_tokens ?? null, completionTokens: usage.completion_tokens ?? null } };
    } catch (err) { lastErr = String(err?.message ?? err); if (attempt === 4) break; await new Promise((ok) => setTimeout(ok, 2000 * 2 ** attempt)); }
  }
  throw new Error(`transport failure after retries: ${lastErr}`);
}

// ── founder claude CLI call (subscription-equivalent) ─────────────────────
// allowRead: true lets the model Read image frames (the W-BAKEB vision-judge
// pattern) — used for vision-arm revision on Claude models when no metered
// vision route is live.
export async function callClaudeCli({ model, system, user, allowRead = false, effort = 'low', timeoutMs = 600000 }) {
  const t0 = Date.now();
  const cliArgs = [
    '--print', '--model', model, '--effort', effort,
    '--settings', '{"hooks":{},"disableAllHooks":true}',
    ...(system ? ['--system-prompt', system] : []),
    ...(allowRead ? ['--allowedTools', 'Read'] : ['--disallowedTools', '*']),
    '--no-session-persistence', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    '--output-format', 'json', user,
  ];
  const { stdout } = await pexecFile('claude', cliArgs, { maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs, cwd: CLEAN_CWD });
  const wallMs = Date.now() - t0;
  const env = JSON.parse(stdout);
  if (env.is_error) throw new Error(`claude cli error: ${String(env.result).slice(0, 250)}`);
  return { text: env.result ?? '', wallMs, apiMs: env.duration_api_ms ?? null, usage: { promptTokens: env.usage?.input_tokens ?? null, completionTokens: env.usage?.output_tokens ?? null }, costUsd: env.total_cost_usd ?? null };
}

// ── module extraction + dep gate (byte-compatible with bundles-b.mjs) ─────
export const ALLOWED_IMPORTS = new Set(['three/webgpu', 'three/tsl', 'gsap', '@/primitives', '@/text']);
export function extractModule(raw) {
  const t = (raw ?? '').trim();
  if (!t) return { parsed: false, source: null, fenced: false };
  if (!t.includes('```')) { const ok = t.includes('export default'); return { parsed: ok, source: ok ? t : null, fenced: false }; }
  const blocks = [...t.matchAll(/```(?:javascript|js|typescript|ts)?\s*\n([\s\S]*?)```/g)].map((m) => m[1]);
  const best = blocks.sort((a, b) => b.length - a.length)[0] ?? '';
  const ok = best.includes('export default');
  return { parsed: ok, source: ok ? best.trim() : null, fenced: true };
}
export function scanImports(src) {
  const sources = new Set();
  for (const m of src.matchAll(/(?:import\s+[^'"]*?from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)) sources.add(m[1]);
  return { sources: [...sources], violations: [...sources].filter((s) => !ALLOWED_IMPORTS.has(s)) };
}
