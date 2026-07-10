#!/usr/bin/env node
// W-BAKE D4 — golden-set builder (wave prompt #14): 30 renders spanning the
// quality range — 24 sampled from the D3-judged contestant renders (evenly
// across the score distribution, contestant + case diversity enforced) + the
// 6 seeded known-bad renders. Every golden frame gets a DOWNSCALED copy
// (800px JPEG, sharp) so ground truth AND every critic candidate judge the
// IDENTICAL pixels through their differing transports (CLI Read vs base64
// data URLs) — disclosed in the report.
//
// Output: notes/bakeoff/judge/golden/golden-set.json + golden/frames/*.jpg

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './contestants.mjs';

const require_ = createRequire(import.meta.url);
const sharp = require_(path.join(ROOT, 'node_modules', 'sharp'));

const SCORES = path.join(ROOT, 'notes', 'bakeoff', 'judge', 'axis2', 'scores.json');
const FRAMES_DIR = path.join(ROOT, 'notes', 'bakeoff', 'renders', 'frames');
const GOLDEN_DIR = path.join(ROOT, 'notes', 'bakeoff', 'judge', 'golden');

const scores = JSON.parse(readFileSync(SCORES, 'utf8')).renders
  .filter((r) => r.renderable && r.probeStatus !== 'no-frame');

// Even sampling across the sorted score distribution with diversity guards.
//
// v2 (2026-07-10, D4 fix caught before ground truth ran to completion): the
// v1 sampler capped each contestant at 6 picks, but with only 3 reachable
// Axis-2 contestants that allows at most 18 capped picks of the 24 target —
// the last 6 fell through a cap-less fallback that returned the LOWEST
// unpicked scores, so the "even" sample was [3..14] and never touched the
// 16–58 top of the range (compressing Spearman into noise). Fixes: the
// contestant cap derives from target / #contestants, and the search walks
// OUTWARD from the quantile point (…q, q+1, q-1, q+2…) instead of wrapping
// past the array end to the bottom, so every quantile keeps locality.
const sorted = [...scores].sort((a, b) => a.score - b.score);
const target = 24;
const contestantIds = [...new Set(sorted.map((r) => r.contestant))];
const contestantCap = Math.ceil(target / Math.max(1, contestantIds.length));
const picked = [];
const seenCase = new Map();
const seenContestant = new Map();
for (let i = 0; i < target && picked.length < sorted.length; i += 1) {
  const q = Math.min(sorted.length - 1, Math.floor((i / (target - 1)) * (sorted.length - 1)));
  let pick = null;
  // Outward search from the quantile point, relaxing caps in two rounds:
  // round 0 honors both caps; round 1 drops the contestant cap (quantile
  // locality beats contestant balance when they conflict).
  for (let round = 0; round < 2 && !pick; round += 1) {
    for (let j = 0; j < 2 * sorted.length && !pick; j += 1) {
      const off = j % 2 === 0 ? j / 2 : -(j + 1) / 2;
      const idx = q + off;
      if (idx < 0 || idx >= sorted.length) continue;
      const cand = sorted[idx];
      if (picked.includes(cand)) continue;
      if ((seenCase.get(cand.caseId) ?? 0) >= 3) continue;
      if (round === 0 && (seenContestant.get(cand.contestant) ?? 0) >= contestantCap) continue;
      pick = cand;
    }
  }
  if (!pick) break;
  picked.push(pick);
  seenCase.set(pick.caseId, (seenCase.get(pick.caseId) ?? 0) + 1);
  seenContestant.set(pick.contestant, (seenContestant.get(pick.contestant) ?? 0) + 1);
}

const seeded = readdirSync(path.join(FRAMES_DIR, 'seeded-bad'))
  .filter((f) => f.endsWith('.png'))
  .map((f) => {
    const meta = JSON.parse(readFileSync(path.join(FRAMES_DIR, 'seeded-bad', f.replace(/\.png$/, '.meta.json')), 'utf8'));
    return { bundleId: meta.bundle, contestant: 'seeded-bad', caseId: meta.bundle.split('/')[1].replace(/-r\d+$/, ''), tag: f.replace(/\.png$/, ''), seeded: true };
  });

mkdirSync(path.join(GOLDEN_DIR, 'frames'), { recursive: true });
const entries = [];
let n = 0;
for (const r of [...picked.map((p) => ({ ...p, seeded: false })), ...seeded]) {
  n += 1;
  const gid = `g-${String(n).padStart(2, '0')}`;
  const src = path.join(FRAMES_DIR, r.contestant, `${r.tag}.png`);
  const dst = path.join(GOLDEN_DIR, 'frames', `${gid}.jpg`);
  await sharp(src).resize({ width: 800 }).jpeg({ quality: 82 }).toFile(dst);
  entries.push({
    goldenId: gid, bundleId: r.bundleId, contestant: r.contestant, caseId: r.caseId,
    seeded: r.seeded, seededDefect: r.seeded ? r.tag.replace(/-r\d+$/, '') : null,
    d3Score: r.seeded ? null : r.score,
    frame: path.relative(ROOT, dst),
  });
}
writeFileSync(path.join(GOLDEN_DIR, 'golden-set.json'), JSON.stringify({
  builtAt: new Date().toISOString(),
  method: '24 D3-judged renders sampled evenly across the score distribution (case cap 3, contestant cap 6) + 6 seeded known-bad; all downscaled to identical 800px JPEGs for every D4 participant',
  entries,
}, null, 2));
console.log(`golden set: ${entries.length} renders (${entries.filter((e) => e.seeded).length} seeded known-bad)`);
