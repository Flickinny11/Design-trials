#!/usr/bin/env node
// no-dom-ui-gate — enforces the Toolbar Chassis LAW: the editor-chrome toolbar is
// pure in-engine (R3F/Three). EVERY visible element lives in the <canvas>. ZERO
// Tailwind, ZERO styled DOM UI, ZERO inline style, ZERO CSS-module, ZERO drei
// <Html> overlay in the chassis chrome source.
//
// SCOPE (coverage): the toolbar-chassis editor chrome only —
//   • src/components/editor/chassis/**   (the 3D chassis scene + components)
//   • src/app/toolbar-chassis/**         (the reviewable route)
// Landing/marketing pages and the legacy compact/mobile DOM dock are deliberately
// OUT of scope (they are not the in-engine chassis this gate protects).
//
// The single permitted stylesheet is the route's global stage-sizer
// (chassis.css): it may size the WebGL mount via element/attribute selectors only
// — no class selectors, no @tailwind, no styled UI.
//
// FAILS (non-zero) on any of: className= attribute · inline style={ · *.module.css
// import · drei Html import/usage · @tailwind directive or class selectors in CSS.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KKL = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SCOPE = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      'src/components/editor/chassis',
      'src/app/toolbar-chassis',
      // EDIT-I1 — the editor SHELL is in-engine chrome under the same LAW.
      'src/components/editor-shell',
      'src/app/editor',
    ];

const SKIP = /(^|\/)(node_modules|\.next|dist|build)(\/|$)|\.bak(-|\.|$)/;

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (SKIP.test(p)) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// Strip full-line comments so prose ("NOT drei <Html>", "no className styling")
// never trips a check. Block comments are removed wholesale first.
function codeLines(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock.split('\n').map((line) => {
    const t = line.trimStart();
    if (t.startsWith('//') || t.startsWith('*')) return '';
    return line;
  });
}

const CODE_CHECKS = [
  { id: 'className', re: /className\s*=/, msg: 'className= (styled DOM UI is forbidden — render in-canvas)' },
  { id: 'inline-style', re: /\bstyle\s*=\s*\{/, msg: 'inline style={ on a DOM element (forbidden)' },
  { id: 'css-module', re: /from\s+['"][^'"]+\.module\.css['"]/, msg: 'CSS-module import (forbidden)' },
  { id: 'tailwind-import', re: /['"]tailwindcss['"]/, msg: 'tailwindcss import (forbidden)' },
  {
    id: 'drei-html-import',
    re: /import\s*\{[^}]*\bHtml\b[^}]*\}\s*from\s*['"]@react-three\/drei['"]/,
    msg: 'drei <Html> import (DOM overlay — forbidden; use Troika/SDF in-canvas text)',
  },
  { id: 'drei-html-jsx', re: /<Html[\s/>]/, msg: 'drei <Html> usage (DOM overlay — forbidden)' },
];

const CSS_CHECKS = [
  { id: 'tailwind-directive', re: /@tailwind\b|@apply\b/, msg: '@tailwind/@apply directive (forbidden)' },
  { id: 'class-selector', re: /(^|[\s,>+~])\.[a-zA-Z][\w-]*\s*[,{]/m, msg: 'CSS class selector — implies styled DOM UI (use attribute/element selectors only)' },
];

const violations = [];
let scanned = 0;

for (const root of SCOPE) {
  const abs = join(KKL, root);
  for (const file of walk(abs)) {
    const ext = extname(file);
    if (!['.ts', '.tsx', '.js', '.jsx', '.css'].includes(ext)) continue;
    scanned++;
    const src = readFileSync(file, 'utf8');
    const rel = relative(KKL, file);
    if (ext === '.css') {
      for (const c of CSS_CHECKS) {
        if (c.re.test(src)) violations.push({ file: rel, line: '-', id: c.id, msg: c.msg });
      }
      continue;
    }
    const lines = codeLines(src);
    lines.forEach((line, i) => {
      for (const c of CODE_CHECKS) {
        if (c.re.test(line)) violations.push({ file: rel, line: i + 1, id: c.id, msg: c.msg });
      }
    });
  }
}

console.log(`[no-dom-ui-gate] scope: ${SCOPE.join(', ')}`);
console.log(`[no-dom-ui-gate] scanned ${scanned} file(s)`);
if (violations.length === 0) {
  console.log('[no-dom-ui-gate] PASS — chassis chrome is pure in-engine (no Tailwind/CSS-module/className/inline-style/drei-Html).');
  process.exit(0);
}
console.error(`[no-dom-ui-gate] FAIL — ${violations.length} violation(s):`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  [${v.id}] ${v.msg}`);
}
process.exit(1);
