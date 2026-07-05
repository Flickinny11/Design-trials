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
//   • net === ANNOYED but mustFix is empty (an annoyed verdict must say what is
//     wrong, with evidence);
//   • net === INDIFFERENT with neither mustFix nor flags (the RUBRIC's
//     "INDIFFERENT + no mustFix → PASS-WITH-FLAGS" row requires at least one
//     evidenced flag naming what is underwhelming; INDIFFERENT + mustFix →
//     BLOCKED as before);
//   • net === PLEASED but mustFix is non-empty (contradiction);
//   • any mustFix / flag entry lacks an `evidence` string.
//
// Usage (CLI):  node scripts/useradvocate-verdict-schema.mjs <verdict.json> <bundleDir>
//               node scripts/useradvocate-verdict-schema.mjs --self-test
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
  // RUBRIC.md mapping table:
  //   ANNOYED      → always implies ≥1 MUST-FIX → BLOCKED.
  //   INDIFFERENT + mustFix → BLOCKED.
  //   INDIFFERENT + no mustFix → PASS-WITH-FLAGS — VALID, but only when at
  //     least one evidenced flag names what is underwhelming (anti-rubber-stamp:
  //     an indifferent verdict that names nothing at all is invalid).
  //   PLEASED + mustFix → contradiction (INVALID).
  if (verdict.net === 'ANNOYED' && !hasMF) errors.push('net=ANNOYED but mustFix is empty — an annoyed verdict must name what is wrong, with evidence');
  if (verdict.net === 'INDIFFERENT' && !hasMF && flags.length === 0) errors.push('net=INDIFFERENT with neither mustFix nor flags — PASS-WITH-FLAGS requires at least one evidenced flag naming what is underwhelming');
  if (verdict.net === 'PLEASED' && hasMF) errors.push('net=PLEASED but mustFix is non-empty (contradiction)');

  const expectedGate = gateFor(verdict.net, hasMF);
  if (verdict.gate && verdict.gate !== expectedGate) errors.push(`gate=${verdict.gate} but net=${verdict.net}+mustFix=${hasMF} maps to ${expectedGate}`);

  return { valid: errors.length === 0, errors, computedGate: expectedGate };
}

// --self-test: exercise the full RUBRIC.md gate matrix in-process so the
// validator can prove (without a bundle on disk) that every row — including
// the previously-unreachable "INDIFFERENT + flags only → PASS-WITH-FLAGS" —
// behaves as specified. Exported so the vitest suite can run the same matrix.
export function runSelfTest() {
  const rubricOk = Object.fromEntries(
    RUBRIC_KEYS.map((k) => [k, { answer: 'self-test answer', evidence: ['metrics: hue 24°, sat 0.8 (self-test citation)'] }]),
  );
  const base = { feature: 'self-test', rubric: rubricOk };
  const MF = [{ issue: 'broken thing', evidence: 'metrics: frameDeltaMag 0 across play frames' }];
  const FLAGS = [{ note: 'slightly muddy', evidence: 'metrics: luma 0.21 (taste call)' }];

  const cases = [
    { name: 'PLEASED, no mustFix, no flags → valid PASS', v: { ...base, net: 'PLEASED', mustFix: [], flags: [] }, valid: true, gate: 'PASS' },
    { name: 'PLEASED + mustFix → contradiction (gate INVALID)', v: { ...base, net: 'PLEASED', mustFix: MF, flags: [] }, valid: false, gate: 'INVALID' },
    { name: 'INDIFFERENT + mustFix → valid BLOCKED', v: { ...base, net: 'INDIFFERENT', mustFix: MF, flags: [] }, valid: true, gate: 'BLOCKED' },
    { name: 'INDIFFERENT + flags only → valid PASS-WITH-FLAGS (the rubric row this validator previously made unreachable)', v: { ...base, net: 'INDIFFERENT', mustFix: [], flags: FLAGS }, valid: true, gate: 'PASS-WITH-FLAGS' },
    { name: 'INDIFFERENT with neither mustFix nor flags → invalid (names nothing)', v: { ...base, net: 'INDIFFERENT', mustFix: [], flags: [] }, valid: false, gate: 'PASS-WITH-FLAGS' },
    { name: 'ANNOYED + mustFix → valid BLOCKED', v: { ...base, net: 'ANNOYED', mustFix: MF, flags: [] }, valid: true, gate: 'BLOCKED' },
    { name: 'ANNOYED without mustFix → invalid', v: { ...base, net: 'ANNOYED', mustFix: [], flags: [] }, valid: false, gate: 'BLOCKED' },
    { name: 'declared gate disagreeing with the mapping → invalid', v: { ...base, net: 'INDIFFERENT', mustFix: [], flags: FLAGS, gate: 'PASS' }, valid: false, gate: 'PASS-WITH-FLAGS' },
    { name: 'flag entry without evidence → invalid', v: { ...base, net: 'INDIFFERENT', mustFix: [], flags: [{ note: 'meh' }] }, valid: false, gate: 'PASS-WITH-FLAGS' },
    { name: 'rubric answer with empty evidence → invalid (anti-rubber-stamp)', v: { ...base, rubric: { ...rubricOk, q1_defects: { answer: 'fine', evidence: [] } }, net: 'PLEASED', mustFix: [], flags: [] }, valid: false, gate: 'PASS' },
  ];

  const failures = [];
  for (const c of cases) {
    const res = validateVerdict(c.v, null);
    const ok = res.valid === c.valid && res.computedGate === c.gate;
    if (!ok) failures.push({ name: c.name, expected: { valid: c.valid, gate: c.gate }, got: { valid: res.valid, gate: res.computedGate, errors: res.errors } });
  }
  return { total: cases.length, failed: failures.length, failures };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const [vPath, bundleDir] = process.argv.slice(2);
  if (vPath === '--self-test') {
    const r = runSelfTest();
    console.log(JSON.stringify(r, null, 2));
    if (r.failed === 0) console.log(`self-test: ${r.total}/${r.total} gate-matrix cases pass`);
    process.exit(r.failed === 0 ? 0 : 1);
  }
  if (!vPath) { console.error('usage: useradvocate-verdict-schema.mjs <verdict.json> [bundleDir] | --self-test'); process.exit(2); }
  const verdict = JSON.parse(readFileSync(vPath, 'utf8'));
  const res = validateVerdict(verdict, bundleDir);
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.valid ? 0 : 1);
}
