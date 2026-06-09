#!/usr/bin/env node
// USER-ADVOCATE verdict schema + validator — the anti-rubber-stamp enforcement,
// in CODE (not prose). A verdict that asserts a pass without cited evidence is
// structurally INVALID. This is the exact failure mode we are guarding against:
// "53 tasks verified while the runtime showed only a background."
//
// A verdict is INVALID (must be re-graded, counts as neither pass nor fail) if:
//   • any of the 5 rubric answers has an empty `evidence` array, OR cites evidence
//     that is neither a real file in the bundle nor a measured `metrics:`/`control:`/
//     `console:` citation;
//   • net/gate disagree with RUBRIC.md's mapping table;
//   • net !== PLEASED but mustFix is empty (a non-pleased verdict must say what is
//     wrong, with evidence);
//   • net === PLEASED but mustFix is non-empty (contradiction);
//   • any mustFix / flag entry lacks an `evidence` string.
//
// Usage (CLI):  node scripts/useradvocate-verdict-schema.mjs <verdict.json> <bundleDir>
// Usage (lib):  import { validateVerdict } from './useradvocate-verdict-schema.mjs'

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RUBRIC_KEYS = ['q1_defects', 'q2_reads_as', 'q3_discoverable', 'q4_responsive', 'q5_net'];
const NETS = ['PLEASED', 'INDIFFERENT', 'ANNOYED'];

// Deterministic net + mustFix → gate (mirrors RUBRIC.md table).
export function gateFor(net, hasMustFix) {
  if (net === 'PLEASED') return hasMustFix ? 'INVALID' : 'PASS';
  if (net === 'INDIFFERENT') return hasMustFix ? 'BLOCKED' : 'PASS-WITH-FLAGS';
  if (net === 'ANNOYED') return 'BLOCKED';
  return 'INVALID';
}

// Collect every file (relative to bundleDir) so file citations can be checked.
function bundleFiles(bundleDir) {
  const out = new Set();
  if (!bundleDir || !existsSync(bundleDir)) return out;
  const walk = (d, base) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e), rel = base ? `${base}/${e}` : e;
      if (statSync(p).isDirectory()) walk(p, rel);
      else { out.add(rel); out.add(e); }
    }
  };
  walk(bundleDir, '');
  return out;
}

function evidenceOk(ev, files) {
  if (typeof ev !== 'string' || !ev.trim()) return false;
  const s = ev.trim();
  // Measured citation forms are always acceptable evidence.
  if (/^(metrics|control|console|network|backend)\s*:/i.test(s)) return true;
  if (/\bhue\b|\bsat\b|\bluma\b|bandingScore|frameDeltaMag|Δ|delta|RGB|latency/i.test(s)) return true;
  // Otherwise it must name a real frame file in the bundle.
  const m = s.match(/[\w./-]+\.png/);
  if (m) {
    const f = m[0];
    if (files.has(f)) return true;
    // allow citing by basename or a tail segment
    for (const known of files) if (known.endsWith(f) || f.endsWith(known)) return true;
  }
  return false;
}

export function validateVerdict(verdict, bundleDir) {
  const errors = [];
  const files = bundleFiles(bundleDir);
  if (!verdict || typeof verdict !== 'object') return { valid: false, errors: ['verdict is not an object'] };
  if (!verdict.feature) errors.push('missing feature');
  if (!NETS.includes(verdict.net)) errors.push(`net must be one of ${NETS.join('/')}, got ${verdict.net}`);

  const rub = verdict.rubric || {};
  for (const k of RUBRIC_KEYS) {
    const a = rub[k];
    if (!a || typeof a !== 'object') { errors.push(`rubric.${k} missing`); continue; }
    if (!a.answer || !String(a.answer).trim()) errors.push(`rubric.${k}.answer empty`);
    const ev = Array.isArray(a.evidence) ? a.evidence : [];
    if (ev.length === 0) errors.push(`rubric.${k}.evidence EMPTY — assertion without evidence is invalid`);
    else {
      const good = ev.filter((e) => evidenceOk(e, files));
      if (good.length === 0) errors.push(`rubric.${k}.evidence cites nothing real (no bundle file, no measured value): ${JSON.stringify(ev)}`);
    }
  }

  const mustFix = Array.isArray(verdict.mustFix) ? verdict.mustFix : [];
  const flags = Array.isArray(verdict.flags) ? verdict.flags : [];
  for (const mf of mustFix) if (!mf || !mf.evidence || !String(mf.evidence).trim()) errors.push(`a mustFix entry lacks evidence: ${JSON.stringify(mf)}`);
  for (const fl of flags) if (!fl || !fl.evidence || !String(fl.evidence).trim()) errors.push(`a flag entry lacks evidence: ${JSON.stringify(fl)}`);

  const hasMF = mustFix.length > 0;
  if (verdict.net && verdict.net !== 'PLEASED' && !hasMF) errors.push(`net=${verdict.net} but mustFix is empty — a non-pleased verdict must name what is wrong, with evidence`);
  if (verdict.net === 'PLEASED' && hasMF) errors.push('net=PLEASED but mustFix is non-empty (contradiction)');

  const expectedGate = gateFor(verdict.net, hasMF);
  if (verdict.gate && verdict.gate !== expectedGate) errors.push(`gate=${verdict.gate} but net=${verdict.net}+mustFix=${hasMF} maps to ${expectedGate}`);

  return { valid: errors.length === 0, errors, computedGate: expectedGate };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const [vPath, bundleDir] = process.argv.slice(2);
  if (!vPath) { console.error('usage: useradvocate-verdict-schema.mjs <verdict.json> [bundleDir]'); process.exit(2); }
  const verdict = JSON.parse(readFileSync(vPath, 'utf8'));
  const res = validateVerdict(verdict, bundleDir);
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.valid ? 0 : 1);
}
