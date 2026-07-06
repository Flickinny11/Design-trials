#!/usr/bin/env node
// PRISM FLIGHT RECORDER — NDJSON → Parquet compaction (deliverable 2, D3).
//
// OFFLINE ONLY. Rolls a day's append-only NDJSON partitions into a single
// columnar Parquet per (family, day), FLATTENING each record so the reward +
// human-signal columns (prism.swe_rm.score, prism.user.decision, prism.repair.*)
// and the OTel columns (gen_ai.usage.*, gen_ai.provider.name) are FIRST-CLASS
// queryable columns — exactly what an ML pipeline reads. Nested/list values
// (spec, before/after, gen_ai.*.messages) are preserved as JSON-string columns.
//
// Never runs in the request path; uses hyparquet-writer (pure JS devDep, D3).
//
// Usage:
//   node scripts/flight-recorder-compact.mjs                 # compact all days
//   node scripts/flight-recorder-compact.mjs --family training --day 2026-07-05
//   node scripts/flight-recorder-compact.mjs --root <dir>    # alternate corpus root

import { parquetWriteFile } from 'hyparquet-writer';
import { readdirSync, readFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const CORPUS_ROOT = path.resolve(arg('--root', path.join(repoRoot, '.data', 'flight-recorder')));
const ONLY_FAMILY = arg('--family', null);
const ONLY_DAY = arg('--day', null);

const FAMILIES = ONLY_FAMILY ? [ONLY_FAMILY] : ['training', 'quarantine'];

/** Flatten one record into dotted-key scalar columns; nest/list → JSON string. */
function flatten(rec) {
  const out = {};
  const put = (k, v) => {
    if (v == null) { out[k] = null; return; }
    if (Array.isArray(v) || typeof v === 'object') { out[k] = JSON.stringify(v); return; }
    out[k] = v;
  };
  for (const [k, v] of Object.entries(rec)) {
    if (k === 'otel' || k === 'prism') {
      if (v && typeof v === 'object') for (const [ak, av] of Object.entries(v)) put(ak, av);
    } else {
      put(k, v);
    }
  }
  return out;
}

function inferType(values) {
  let sawNumber = false, sawBool = false, sawString = false;
  for (const v of values) {
    if (v == null) continue;
    if (typeof v === 'number') sawNumber = true;
    else if (typeof v === 'boolean') sawBool = true;
    else sawString = true;
  }
  if (sawString) return 'STRING';
  if (sawBool && !sawNumber) return 'BOOLEAN';
  if (sawNumber) return 'DOUBLE';
  return 'STRING';
}

function compactDay(family, day, files) {
  const rows = [];
  for (const f of files) {
    const raw = readFileSync(f, 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try { rows.push(flatten(JSON.parse(t))); } catch { /* skip malformed line */ }
    }
  }
  if (rows.length === 0) return null;

  // Union of all columns across the day (stable schema for the partition).
  const cols = new Set();
  for (const r of rows) for (const k of Object.keys(r)) cols.add(k);
  // Deterministic column order: envelope first, then gen_ai.*, then prism.*, then rest.
  const order = (k) => (/^gen_ai\./.test(k) ? 2 : /^prism\./.test(k) ? 3 : k === 'record_id' ? 0 : 1);
  const colNames = [...cols].sort((a, b) => order(a) - order(b) || a.localeCompare(b));

  const columnData = colNames.map((name) => {
    const data = rows.map((r) => (name in r ? r[name] : null));
    const type = inferType(data);
    // Coerce to the inferred type so a column with mixed null/number stays DOUBLE.
    const coerced = data.map((v) => {
      if (v == null) return null;
      if (type === 'STRING') return String(v);
      if (type === 'DOUBLE') return typeof v === 'number' ? v : Number(v);
      if (type === 'BOOLEAN') return Boolean(v);
      return v;
    });
    return { name, data: coerced, type };
  });

  const outDir = path.join(CORPUS_ROOT, family, '_compacted');
  mkdirSync(outDir, { recursive: true });
  const filename = path.join(outDir, `${day}.parquet`);
  parquetWriteFile({ filename, columnData });
  return { filename, rows: rows.length, columns: colNames.length, bytes: statSync(filename).size };
}

let total = 0;
for (const family of FAMILIES) {
  const famDir = path.join(CORPUS_ROOT, family);
  if (!existsSync(famDir)) continue;
  const days = readdirSync(famDir).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && (!ONLY_DAY || d === ONLY_DAY));
  for (const day of days) {
    const dayDir = path.join(famDir, day);
    const files = readdirSync(dayDir).filter((f) => f.endsWith('.ndjson')).map((f) => path.join(dayDir, f));
    if (files.length === 0) continue;
    const res = compactDay(family, day, files);
    if (res) {
      total += res.rows;
      console.log(`[${family}/${day}] ${res.rows} rows × ${res.columns} cols → ${path.relative(repoRoot, res.filename)} (${res.bytes} B)`);
    }
  }
}
if (total === 0) console.log(`no NDJSON partitions found under ${path.relative(repoRoot, CORPUS_ROOT)} — nothing to compact.`);
else console.log(`compacted ${total} records.`);
