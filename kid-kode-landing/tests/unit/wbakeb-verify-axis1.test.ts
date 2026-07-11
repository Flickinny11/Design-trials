// W-BAKE-B D2 — Axis 1 verification pass (env-gated: WBAKEB_VERIFY_AXIS1=1).
//
// Identical grading to tests/unit/wbake-verify-axis1.test.ts (the SHIPPED
// rule-based verifier verifyNodeModule, NO repair, spec §11.3) but pointed at
// notes/bakeoff-b/runs/functional/** — the full-roster runs under L1 v2.1.
// The FROZEN functional corpus (notes/bakeoff/corpus/functional) is unchanged
// (I-BB2), so the verifierCtx per case is byte-identical to W-BAKE's.
//   - per-run logs   → notes/bakeoff-b/runs/functional/verify-logs/<c>/<case>-r<n>.json
//   - aggregate      → notes/bakeoff-b/runs/functional/verify-metrics.json

import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { verifyNodeModule } from '@/lib/prism/codegen/verifier';
import type { RenderMode } from '@/lib/prism-graph/types';

const ROOT = path.resolve(__dirname, '..', '..');
const RUNS_DIR = path.join(ROOT, 'notes', 'bakeoff-b', 'runs', 'functional');
const CORPUS = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'functional');

export function extractModule(raw: string): { rawCompliant: boolean; parsed: boolean; source: string | null; fenced: boolean } {
  const t = (raw ?? '').trim();
  if (!t) return { rawCompliant: false, parsed: false, source: null, fenced: false };
  const hasFence = t.includes('```');
  if (!hasFence) {
    const ok = t.includes('export default');
    return { rawCompliant: ok, parsed: ok, source: ok ? t : null, fenced: false };
  }
  const blocks = [...t.matchAll(/```(?:javascript|js|typescript|ts)?\s*\n([\s\S]*?)```/g)].map((m) => m[1]);
  const best = blocks.sort((a, b) => b.length - a.length)[0] ?? '';
  const ok = best.includes('export default');
  return { rawCompliant: false, parsed: ok, source: ok ? best.trim() : null, fenced: true };
}

const p = (arr: number[], q: number): number | null => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

describe.skipIf(process.env.WBAKEB_VERIFY_AXIS1 !== '1')('W-BAKE-B Axis 1 verification', () => {
  it('verifies every generation with the shipped rule-based verifier and writes metrics', () => {
    const caseCtx = new Map<string, { renderMode: RenderMode; hasTextContent: boolean; tier: string; integrationBearing: boolean }>();
    for (const f of readdirSync(path.join(CORPUS, 'cases')).filter((x) => x.endsWith('.json'))) {
      const c = JSON.parse(readFileSync(path.join(CORPUS, 'cases', f), 'utf8'));
      caseCtx.set(c.caseId, { ...c.verifierCtx, tier: c.tier, integrationBearing: c.integrationBearing });
    }

    const contestants = readdirSync(RUNS_DIR).filter((d) => {
      if (d.startsWith('verify')) return false;
      const full = path.join(RUNS_DIR, d);
      try { return readdirSync(full).length > 0; } catch { return false; }
    });

    const perRun: Array<Record<string, unknown>> = [];
    for (const cid of contestants) {
      const dir = path.join(RUNS_DIR, cid);
      const logDir = path.join(RUNS_DIR, 'verify-logs', cid);
      mkdirSync(logDir, { recursive: true });
      for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
        const rec = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
        const m = /^(.*)-(r\d+|repair)\.json$/.exec(f);
        if (!m) continue;
        const caseId = m[1];
        const run = m[2] === 'repair' ? 'repair' : Number(m[2].slice(1));
        const ctx = caseCtx.get(caseId);
        if (!ctx) continue;
        if (!rec.ok) {
          perRun.push({ contestant: cid, caseId, run, tier: ctx.tier, transportError: rec.transportError, parsed: false, verified: false });
          continue;
        }
        const ex = extractModule(rec.output);
        let verified = false;
        let violations: Array<{ rule: string; severity: string; message: string }> = [];
        if (ex.parsed && ex.source) {
          const vr = verifyNodeModule(ex.source, { renderMode: ctx.renderMode, hasTextContent: ctx.hasTextContent });
          verified = vr.ok;
          violations = vr.violations.map((v) => ({ rule: v.rule, severity: v.severity, message: v.message }));
        } else {
          violations = [{ rule: 'PARSE_FAILURE', severity: 'error', message: 'no extractable module (missing export default or empty output)' }];
        }
        writeFileSync(path.join(logDir, f), JSON.stringify({ contestant: cid, caseId, run, rawCompliant: ex.rawCompliant, fenced: ex.fenced, parsed: ex.parsed, verified, violations }, null, 2));
        perRun.push({
          contestant: cid, caseId, run, tier: ctx.tier, integrationBearing: ctx.integrationBearing,
          rawCompliant: ex.rawCompliant, fenced: ex.fenced, parsed: ex.parsed, verified,
          violationRules: violations.filter((v) => v.severity === 'error').map((v) => v.rule),
          violations,
          wallMs: rec.wallMs ?? null, apiMs: rec.apiMs ?? null, costUsd: rec.costUsd ?? null,
        });
      }
    }

    const summary: Record<string, unknown> = {};
    for (const cid of contestants) {
      const rows = perRun.filter((r) => r.contestant === cid && r.run !== 'repair');
      const completed = rows.filter((r) => !(r as { transportError?: string }).transportError);
      const byTier = (tier: string) => {
        const t = completed.filter((r) => r.tier === tier);
        return t.length ? { n: t.length, firstPassRate: t.filter((r) => r.verified).length / t.length } : { n: 0, firstPassRate: null };
      };
      const walls = completed.map((r) => r.wallMs as number).filter((x) => typeof x === 'number');
      const costs = completed.map((r) => r.costUsd as number).filter((x) => typeof x === 'number');
      const runRates = [1, 2, 3].map((ri) => {
        const rr = completed.filter((r) => r.run === ri);
        return rr.length ? rr.filter((r) => r.verified).length / rr.length : null;
      }).filter((x): x is number => x !== null);
      const intRows = completed.filter((r) => r.integrationBearing);
      const repairRowsAll = perRun.filter((r) => r.contestant === cid && r.run === 'repair');
      const repairRows = repairRowsAll.filter((r) => !(r as { transportError?: string }).transportError);
      const repairBlocked = repairRowsAll.length - repairRows.length;
      summary[cid] = {
        generations: rows.length,
        transportErrors: rows.length - completed.length,
        firstPassRate: completed.length ? completed.filter((r) => r.verified).length / completed.length : null,
        firstPassRateByRun: runRates,
        firstPassSpread: runRates.length ? Math.max(...runRates) - Math.min(...runRates) : null,
        parseRateRaw: completed.length ? completed.filter((r) => r.rawCompliant).length / completed.length : null,
        parseRateAfterFenceStrip: completed.length ? completed.filter((r) => r.parsed).length / completed.length : null,
        integrationBearing: intRows.length ? { n: intRows.length, firstPassRate: intRows.filter((r) => r.verified).length / intRows.length } : { n: 0, firstPassRate: null },
        byTier: { simple: byTier('simple'), moderate: byTier('moderate'), complex: byTier('complex') },
        p50WallMs: p(walls, 0.5), p95WallMs: p(walls, 0.95),
        meanCostPerNodeUsd: costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : null,
        topViolationRules: Object.entries(
          completed.flatMap((r) => (r.violationRules as string[]) ?? []).reduce<Record<string, number>>((acc, v) => { acc[v] = (acc[v] ?? 0) + 1; return acc; }, {}),
        ).sort((a, b) => b[1] - a[1]).slice(0, 6),
        repair: repairRowsAll.length
          ? { attempted: repairRows.length, fixedAtDepth1: repairRows.filter((r) => r.verified).length, stillFailing: repairRows.filter((r) => !r.verified).length, transportBlocked: repairBlocked }
          : null,
      };
    }

    writeFileSync(path.join(RUNS_DIR, 'verify-metrics.json'), JSON.stringify({
      verifier: 'src/lib/prism/codegen/verifier.ts::verifyNodeModule (shipped)',
      wave: 'wbakeb', l1: 'v2.1', gradedAt: new Date().toISOString(),
      summary, perRun,
    }, null, 2));
    expect(perRun.length).toBeGreaterThan(0);
  });
});
