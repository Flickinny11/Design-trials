#!/usr/bin/env node
// art-fidelity-review — the LOOK gate for the animation catalog (catalog-prep,
// 2026-06-07). The ULTRACODE pilot found ~15-20% of "hard" GPU primitives pass
// every FUNCTIONAL gate (renders / plays / controls / tsc) yet still look wrong:
// too dark (glass without an env map), washed out, or a broken/empty material.
// "It renders" is not "it looks premium." This adds a second, look-only pass.
//
// Two stages (this script is stage 1; the loop runs stage 2):
//
//   STAGE 1 — objective pre-filter (this script). For each rendered tile frame
//   it computes luminance, contrast, saturation and subject-coverage, then
//   grades against the Prism quality bar. Frames that fall outside the bar are
//   flagged NEEDS-POLISH with a concrete reason; the rest are PASS. This is
//   cheap, deterministic, and reproducible across the full 300.
//
//   STAGE 2 — vision judgment (run in /prism-verify by a vision model). The
//   reviewer looks at every flagged frame PLUS a sample of PASS frames and
//   answers the human question the metrics can't: "does this look like its name,
//   and is it premium?" Its verdict is recorded alongside this report.
//
// A NEEDS-POLISH verdict is a FIX (an art issue), tracked separately from the
// functional pass — it does not by itself mean the primitive is broken.
//
// Usage:
//   node scripts/art-fidelity-review.mjs [--dir notes/verification/catalog-prep/tiles] [--json]

import sharp from 'sharp';
import { existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const args = process.argv.slice(2);
const getArg = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const JSON_OUT = args.includes('--json');
const dir = resolve(repoRoot, getArg('dir', 'notes/verification/catalog-prep/tiles'));

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', X = '\x1b[0m';

// Prism quality bar (tuned to the dark catalog backdrop #06070d, lum ~0.028).
const BAR = {
  tooDarkLum: 0.06,        // mean luminance below this → underlit
  washedLum: 0.72,         // very bright …
  washedSat: 0.10,         // … with little colour → washed out
  minCoverage: 0.035,      // fraction of pixels above background → subject present
  flatStdDev: 0.018,       // luminance spread below this (with coverage) → flat/broken
};

async function analyze(path) {
  // Downsample for speed; keep aspect.
  const { data, info } = await sharp(path)
    .resize(160, 120, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const px = info.width * info.height;
  let sumL = 0, sumL2 = 0, sumS = 0, lit = 0;
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const s = mx <= 0 ? 0 : (mx - mn) / mx;
    sumL += l; sumL2 += l * l; sumS += s;
    if (l > 0.06) lit += 1;
  }
  const meanL = sumL / px;
  const varL = Math.max(0, sumL2 / px - meanL * meanL);
  return {
    meanLum: meanL,
    lumStdDev: Math.sqrt(varL),
    meanSat: sumS / px,
    coverage: lit / px,
  };
}

function judge(m) {
  const reasons = [];
  if (m.coverage < BAR.minCoverage) reasons.push(`low subject coverage (${(m.coverage * 100).toFixed(1)}%) — material may be missing/broken`);
  if (m.meanLum < BAR.tooDarkLum) reasons.push(`too dark (mean luminance ${m.meanLum.toFixed(3)}) — underlit / needs env light`);
  if (m.meanLum > BAR.washedLum && m.meanSat < BAR.washedSat) reasons.push(`washed out (lum ${m.meanLum.toFixed(2)}, sat ${m.meanSat.toFixed(2)})`);
  if (m.coverage >= BAR.minCoverage && m.lumStdDev < BAR.flatStdDev) reasons.push(`flat / low contrast (stddev ${m.lumStdDev.toFixed(3)})`);
  return { verdict: reasons.length ? 'NEEDS-POLISH' : 'PASS', reasons };
}

async function main() {
  if (!existsSync(dir)) {
    console.error(`${R}[art-review] frame dir not found: ${dir}${X}\n  Run scripts/verify-catalog.mjs first to render the tiles.`);
    process.exit(2);
  }
  const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  if (!files.length) {
    console.error(`${R}[art-review] no .png frames in ${dir}${X}`);
    process.exit(2);
  }

  const results = [];
  for (const f of files) {
    const name = basename(f, '.png');
    const metrics = await analyze(join(dir, f));
    const { verdict, reasons } = judge(metrics);
    results.push({ name, frame: join('notes/verification/catalog-prep/tiles', f), metrics, verdict, reasons });
  }

  const pass = results.filter((r) => r.verdict === 'PASS');
  const polish = results.filter((r) => r.verdict === 'NEEDS-POLISH');

  const report = {
    generatedAt: new Date().toISOString(),
    dir: getArg('dir', 'notes/verification/catalog-prep/tiles'),
    bar: BAR,
    summary: { total: results.length, pass: pass.length, needsPolish: polish.length },
    stage2: 'Vision reviewer (run in /prism-verify) judges every NEEDS-POLISH frame + a sample of PASS frames for "looks like its name + premium".',
    results: results.sort((a, b) => a.name.localeCompare(b.name)),
  };
  const outPath = join(repoRoot, 'notes', 'verification', 'catalog-prep', 'art-fidelity-report.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }

  console.log(`${Y}[art-review]${X} ${results.length} frames · ${G}${pass.length} PASS${X} · ${polish.length ? R : D}${polish.length} NEEDS-POLISH${X}`);
  for (const r of results) {
    const tag = r.verdict === 'PASS' ? `${G}PASS        ${X}` : `${R}NEEDS-POLISH${X}`;
    const m = r.metrics;
    console.log(
      `  ${tag} ${r.name.padEnd(22)} lum=${m.meanLum.toFixed(3)} sat=${m.meanSat.toFixed(2)} contrast=${m.lumStdDev.toFixed(3)} cover=${(m.coverage * 100).toFixed(0)}%` +
        (r.reasons.length ? `  ${D}→ ${r.reasons.join('; ')}${X}` : ''),
    );
  }
  console.log(`${D}report: notes/verification/catalog-prep/art-fidelity-report.json${X}`);
  console.log(`${D}Stage 2: a vision reviewer judges the flagged frames in /prism-verify (look, not just metrics).${X}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
