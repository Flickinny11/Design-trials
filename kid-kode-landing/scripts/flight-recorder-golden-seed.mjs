#!/usr/bin/env node
// PRISM FLIGHT RECORDER — golden eval seed HARVESTER (deliverable 4).
//
// Harvests CERTIFIED fixtures into versioned eval cases (input spec + expected-
// pass criteria + per-case provenance). Provenance is airtight because the case
// data is READ from the certified source at harvest time, not transcribed. The
// golden set is the yardstick §5 G1 measures a candidate model against ("≥
// frontier baseline on the golden eval set"); it is REGENERABLE as fixtures
// evolve (re-run this script), matching the freshness discipline (proposal §6).
//
// Sources (all certified by a prior judged wave):
//   • ORRERY atelier variants  — src/lib/prism/atelier/config.ts (MASTERPIECE M-2 / W9A)
//   • certified mock node specs — src/lib/prism/mock-app-source/hubs/home-hub.legacy.json
//   • W10 generative outputs    — .data/generative-jobs.json (SHELL W10, DL13)
//   • W5B ship-gate outcome     — notes/verification/shell-w5b/frames-summary.json
//
// Usage: node scripts/flight-recorder-golden-seed.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const OUT = path.join(root, 'eval', 'golden-v1');
const CASES = path.join(OUT, 'cases');
const at = new Date().toISOString();

const cases = [];
function add(c) { cases.push(c); }
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

// ── 1. ORRERY atelier variants (parsed from config.ts, curated layer set) ─────
const CONFIG = path.join(root, 'src/lib/prism/atelier/config.ts');
const KEEP_LAYERS = new Set(['movement', 'case', 'bezel', 'dial', 'hands', 'indices']);
const KEEP_VARIANTS = new Set(['tourbillon', 'rose-gold', 'gem-set', 'orrery', 'guilloche', 'blued', 'diamond']);
if (existsSync(CONFIG)) {
  const text = readFileSync(CONFIG, 'utf8');
  const lines = text.split('\n');
  let curLayer = null;
  const layerHdr = /id:\s*'([a-z-]+)',\s*label:\s*'([^']+)',\s*order:\s*\d+/;
  // Each variant is one line: `{ id: '…', label: '…', … priceDelta: N }`. The
  // material: finish({…}) between them contains braces, so match greedily on the
  // single line (not up to the first brace).
  const variant = /\{\s*id:\s*'([a-z0-9-]+)',\s*label:\s*'([^']+)',.*priceDelta:\s*(\d+)/;
  for (let i = 0; i < lines.length; i += 1) {
    const ln = lines[i];
    const h = layerHdr.exec(ln);
    if (h && KEEP_LAYERS.has(h[1])) { curLayer = { id: h[1], label: h[2] }; continue; }
    if (h) { curLayer = null; continue; }
    if (!curLayer) continue;
    const v = variant.exec(ln);
    if (!v) continue;
    const [, vid, vlabel, price] = v;
    if (!KEEP_VARIANTS.has(vid)) continue;
    const hasMaterial = /material:\s*finish\(/.test(ln);
    add({
      id: `orrery-${curLayer.id}-${vid}`,
      family: 'node-gen',
      title: `ORRERY watch — ${curLayer.label}: ${vlabel}`,
      input: {
        instruction: `Configure the atelier watch ${curLayer.label.toLowerCase()} as ${vlabel}.`,
        target: { nodeId: 'orr-atelier-watch', codeRef: 'builtin:atelier-watch', renderMode: 'mesh' },
        layer: curLayer.id, variant: vid,
      },
      expected: {
        criteria: [
          { id: 'renders-mesh', assert: 'node renders as a mesh (codeRef builtin:atelier-watch)', renderMode: 'mesh' },
          ...(hasMaterial ? [{ id: 'has-material', assert: 'variant carries a full MaterialSpec (LIT)', materialSpec: true }] : []),
          { id: 'price-delta', assert: 'priceDelta matches the certified value', priceDelta: Number(price) },
          { id: 'completeness-gate', assert: 'passes the schema-completeness gate', gate: 'schema-completeness', outcome: 'pass' },
        ],
      },
      provenance: { source: 'src/lib/prism/atelier/config.ts', certifiedBy: 'MASTERPIECE M-2 + SHELL W9A (judged 0 MUST-FIX)', harvestedAt: at, note: `layer '${curLayer.id}' variant '${vid}'` },
    });
  }
}

// ── 2. Certified mock node specs (home-hub.legacy.json, curated) ──────────────
const HUB = path.join(root, 'src/lib/prism/mock-app-source/hubs/home-hub.legacy.json');
const KEEP_NODES = new Set(['page-backdrop', 'hero-portal-frame', 'hero-cta-primary', 'feature-card-3d']);
if (existsSync(HUB)) {
  const g = JSON.parse(readFileSync(HUB, 'utf8'));
  for (const n of g.nodes || []) {
    if (!KEEP_NODES.has(n.nodeId)) continue;
    add({
      id: `mocknode-${slug(n.nodeId)}`,
      family: 'node-gen',
      title: `Mock app node — ${n.nodeId}`,
      input: {
        instruction: (n.intent && n.intent.caption) ? n.intent.caption : `Generate node ${n.nodeId}.`,
        target: { nodeId: n.nodeId, subtype: n.subtype, renderMode: n.renderMode ?? 'sprite', codeRef: n.codeRef },
      },
      expected: {
        criteria: [
          { id: 'subtype', assert: 'node subtype matches', subtype: n.subtype },
          { id: 'completeness-gate', assert: 'passes the schema-completeness gate', gate: 'schema-completeness', outcome: 'pass' },
          { id: 'renders', assert: 'node renders (no empty-Group placeholder)', renders: true },
        ],
      },
      provenance: { source: 'src/lib/prism/mock-app-source/hubs/home-hub.legacy.json', certifiedBy: 'ORRERY mock app (canonical graph)', harvestedAt: at, note: `certified node '${n.nodeId}'` },
    });
  }
}

// ── 3. W10 generative outputs (.data/generative-jobs.json) ────────────────────
const JOBS = path.join(root, '.data/generative-jobs.json');
if (existsSync(JOBS)) {
  const raw = JSON.parse(readFileSync(JOBS, 'utf8'));
  const jobs = Array.isArray(raw) ? raw : (raw.jobs || Object.values(raw));
  // De-dup by capabilityId, keeping one representative succeeded + the fail case.
  const seen = new Set();
  for (const j of jobs) {
    const key = `${j.capabilityId}:${j.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (j.status === 'succeeded' && j.result) {
      add({
        id: `gen3d-${slug(j.capabilityId)}-${slug(j.model)}`,
        family: 'generative-3d',
        title: `${j.model} — ${j.capabilityId}`,
        input: { capabilityId: j.capabilityId, model: j.model, adapterId: j.adapterId },
        expected: {
          criteria: [
            { id: 'asset-kind', assert: 'produces the expected asset kind', assetKind: j.result.kind },
            { id: 'cost-basis', assert: 'cost basis recorded (metering)', cost: j.cost ?? null },
            { id: 'metered', assert: 'invocation metered in CapabilityUsage + corpus', metered: true },
          ],
        },
        provenance: { source: '.data/generative-jobs.json', certifiedBy: 'SHELL W10 (DL13 committed demo output)', harvestedAt: at, note: `real ${j.live ? 'live' : 'demo'} job → ${j.result.url}` },
      });
    } else if (j.status === 'failed') {
      add({
        id: `gen3d-failclean-${slug(j.capabilityId)}`,
        family: 'generative-3d',
        title: `${j.model} — ${j.capabilityId} (must fail cleanly)`,
        input: { capabilityId: j.capabilityId, model: j.model, note: 'invalid input (no source mesh)' },
        expected: {
          criteria: [
            { id: 'fails-clean', assert: 'fails with a typed error, never a broken asset', status: 'failed' },
            { id: 'metered-failure', assert: 'failed invocation still metered (ok=false)', ok: false },
          ],
        },
        provenance: { source: '.data/generative-jobs.json', certifiedBy: 'SHELL W10 (meter-every-invocation law)', harvestedAt: at, note: j.error || 'failed job' },
      });
    }
  }
}

// ── 4. W5B ship-gate outcome ──────────────────────────────────────────────────
const W5B = path.join(root, 'notes/verification/shell-w5b/frames-summary.json');
if (existsSync(W5B)) {
  const s = JSON.parse(readFileSync(W5B, 'utf8'));
  add({
    id: 'ship-gate-w5b',
    family: 'ship-gate',
    title: 'W5B ship-anywhere gate (§14.1)',
    input: { instruction: 'Build + ship a verified app to a shareable preview.', gate: 'W5B / E15..E20 + §14.1' },
    expected: {
      criteria: [
        { id: 'verified-shippable', assert: 'build earns the Verified Shippable badge', builtBadge: s.builtBadge === true },
        { id: 'multi-target', assert: 'ships to ≥2 host targets', hosts: s.hosts, min: 2 },
        { id: 'managed-care', assert: 'Managed Care (E20) surface present', care: s.care === true },
        { id: 'post-ship-verify', assert: 'post-ship §11.2 verification passes on each target', outcome: 'pass' },
      ],
    },
    provenance: { source: 'notes/verification/shell-w5b/frames-summary.json + tests/unit/shell-w5b-ship-anywhere.test.ts', certifiedBy: 'SHELL W5B (11/11 gate pass)', harvestedAt: at, note: `hosts=${s.hosts}, recs=${s.recs}, cards=${s.cards}` },
  });
}

// ── Write cases + manifest ────────────────────────────────────────────────────
mkdirSync(CASES, { recursive: true });
for (const c of cases) writeFileSync(path.join(CASES, `${c.id}.json`), JSON.stringify(c, null, 2) + '\n', 'utf8');

const byFamily = cases.reduce((acc, c) => { acc[c.family] = (acc[c.family] || 0) + 1; return acc; }, {});
const manifest = {
  evalSet: 'golden-v1',
  generatedAt: at,
  schemaAlignment: { corpusSchema: 'prism-fr-v1', otelSemconv: '1.43.0' },
  purpose: 'Frozen certified yardstick for measuring a candidate model/build against a known-good bar (proposal §5 G1 / §4 P0). Regenerate with scripts/flight-recorder-golden-seed.mjs as fixtures evolve.',
  caseCount: cases.length,
  byFamily,
  cases: cases.map((c) => ({ id: c.id, family: c.family, title: c.title, source: c.provenance.source, certifiedBy: c.provenance.certifiedBy })),
};
writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`wrote ${cases.length} golden cases → eval/golden-v1/`);
console.log('  by family:', JSON.stringify(byFamily));
