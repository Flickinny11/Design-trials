#!/usr/bin/env node
/**
 * anti-default-scan.mjs — machined regression guard for the Prism UI redesign.
 *
 * The diagnosis of why every past "redesign" loop regressed: the briefs PRESCRIBED the
 * condemned aesthetics (Observatory-Brass palette, Switzer grotesque) as PASS criteria, and
 * the review gates graded the PRESENCE of brass — so they could never catch it. This script
 * is the complement to the fresh-context reviewer veto: it makes "no brass / no default"
 * a CHECKABLE, machine-enforced gate over the app's identity surfaces.
 *
 * Exit 0 = clean. Exit 1 = condemned patterns found (prints file:line for each).
 *
 * Usage:
 *   node scripts/anti-default-scan.mjs [root ...]
 * Defaults to the live-app identity surfaces under kid-kode-landing/.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = process.argv.slice(2);
const HERE = new URL('.', import.meta.url).pathname;            // Design-trials/scripts/
const APP = join(HERE, '..', 'kid-kode-landing');
const DEFAULT_ROOTS = [
  join(APP, 'src', 'app'),
  join(APP, 'src', 'components', 'editor'),
  join(APP, 'src', 'styles'),
];
const targets = (ROOTS.length ? ROOTS : DEFAULT_ROOTS).filter(existsSync);

const SKIP_DIR = /(^|\/)(node_modules|\.next|\.git|dist|build|__snapshots__)(\/|$)/;
const SKIP_FILE = /\.(bak[-.].*|map|png|jpg|jpeg|webp|avif|woff2?|ttf|ico)$/i;
const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|css|scss|svg|json|html)$/i;

// Condemned identity patterns (case-insensitive). Each: [label, regex].
const PATTERNS = [
  ['brass design-system token', /--ds-brass|ds-brass-|\bDS\.brass|grad-brass|glow-brass|border-[a-z-]*ds-brass/i],
  ['Observatory-Brass palette name', /observatory[- ]?brass/i],
  ['brass ramp hex', /#(cd9f55|cda86c|e9c98a|e0a84d|cd7f32|b8860b|c8a96a)\b/i],
  ['brass rgb literal', /rgba?\(\s*205\s*,\s*159\s*,\s*85/i],
  ['amber/gold/bronze words in style', /\b(amber|gold(en)?|bronze|brass)\b\s*[:=]|['"]#?(gold|amber|bronze)['"]/i],
  ['Switzer grotesque display face', /font-family[^;]*Switzer|['"]Switzer['"]/i],
];
// Lines that legitimately MENTION these in prose/comments are still flagged on identity
// surfaces — the point is zero condemned identity anywhere in the app chrome. Tune ROOTS to
// scope. (The 410-primitive material library, which offers brass as a user-selectable
// material, is intentionally NOT in the default roots.)

const hits = [];
function walk(dir) {
  let entries; try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    const p = join(dir, name);
    if (SKIP_DIR.test(p)) continue;
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p);
    else if (TEXT_EXT.test(name) && !SKIP_FILE.test(name)) scan(p);
  }
}
function scan(file) {
  let txt; try { txt = readFileSync(file, 'utf8'); } catch { return; }
  const lines = txt.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const [label, re] of PATTERNS) {
      if (re.test(lines[i])) hits.push({ file, line: i + 1, label, text: lines[i].trim().slice(0, 120) });
    }
  }
}

if (!targets.length) { console.error('anti-default-scan: no target roots exist:', (ROOTS.length?ROOTS:DEFAULT_ROOTS).join(', ')); process.exit(2); }
for (const t of targets) walk(t);

if (!hits.length) {
  console.log(`✅ anti-default-scan: CLEAN — no brass/Observatory/grotesque identity found in ${targets.length} root(s).`);
  process.exit(0);
}
console.log(`❌ anti-default-scan: ${hits.length} condemned identity pattern(s) found:\n`);
for (const h of hits) {
  const rel = relative(join(HERE, '..'), h.file);
  console.log(`  ${rel}:${h.line}  [${h.label}]\n      ${h.text}`);
}
console.log(`\nReplace these with the chrome/titanium/anodized/arc-cyan identity (see redesign-slice/SLICE-REPORT.md) before the port can pass.`);
process.exit(1);
