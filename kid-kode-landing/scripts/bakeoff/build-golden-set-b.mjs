#!/usr/bin/env node
// W-BAKE-B D4 — golden-set builder: 30 renders spanning the quality range —
// 24 sampled from the D3-judged bakeoff-b contestant renders (evenly across
// the score distribution, contestant + case diversity enforced; the W-BAKE v2
// outward-quantile sampler verbatim) + the 6 seeded known-bad renders REUSED
// from W-BAKE (notes/bakeoff/renders/frames/seeded-bad — same harness, same
// deliberate Design-Law violations; reuse disclosed in the method string).
// Every golden frame gets a DOWNSCALED copy (800px JPEG, sharp) so ground
// truth AND every critic candidate judge the IDENTICAL pixels through their
// differing transports (CLI Read vs base64 data URLs).
//
// Output: notes/bakeoff-b/judge/golden/golden-set.json + golden/frames/*.jpg

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './contestants-b.mjs';

const require_ = createRequire(import.meta.url);
const sharp = require_(path.join(ROOT, 'node_modules', 'sharp'));

const B = path.join(ROOT, 'notes', 'bakeoff-b');
const SCORES = path.join(B, 'judge', 'scores.json');
const FRAMES_DIR = path.join(B, 'frames');
const SEEDED_FRAMES = path.join(ROOT, 'notes', 'bakeoff', 'renders', 'frames', 'seeded-bad');
const GOLDEN_DIR = path.join(B, 'judge', 'golden');

const scores = JSON.parse(readFileSync(SCORES, 'utf8')).renders
  .filter((r) => r.renderable && r.probeStatus !== 'no-frame' && typeof r.score === 'number');

// W-BAKE v2 sampler: even quantiles over the sorted score distribution,
// outward search from each quantile point, case cap 3, contestant cap
// derived from target / #contestants (dropped in round 1 when it conflicts
// with quantile locality).
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

const seeded = readdirSync(SEEDED_FRAMES)
  .filter((f) => f.endsWith('.png'))
  .map((f) => {
    const meta = JSON.parse(readFileSync(path.join(SEEDED_FRAMES, f.replace(/\.png$/, '.meta.json')), 'utf8'));
    return { bundleId: meta.bundle, contestant: 'seeded-bad', caseId: meta.bundle.split('/')[1].replace(/-r\d+$/, ''), tag: f.replace(/\.png$/, ''), seeded: true };
  });

mkdirSync(path.join(GOLDEN_DIR, 'frames'), { recursive: true });
const entries = [];
let n = 0;
for (const r of [...picked.map((p) => ({ ...p, seeded: false })), ...seeded]) {
  n += 1;
  const gid = `g-${String(n).padStart(2, '0')}`;
  const src = r.seeded
    ? path.join(SEEDED_FRAMES, `${r.tag}.png`)
    : path.join(FRAMES_DIR, r.contestant, `${r.tag}.png`);
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
  method: `24 D3-judged bakeoff-b renders sampled evenly across the score distribution (case cap 3, contestant cap ${contestantCap}, W-BAKE v2 outward-quantile sampler) + 6 seeded known-bad renders reused from W-BAKE (same harness, deliberate Design-Law violations); all downscaled to identical 800px JPEGs for every D4 participant`,
  entries,
}, null, 2));
console.log(`golden set: ${entries.length} renders (${entries.filter((e) => e.seeded).length} seeded known-bad, ${new Set(entries.filter((e) => !e.seeded).map((e) => e.contestant)).size} contestants)`);
