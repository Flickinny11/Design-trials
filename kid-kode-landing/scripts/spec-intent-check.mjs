#!/usr/bin/env node
// PILLAR 3 — pre-build SPEC-vs-INTENT check.
// The chain (run-surface.sh / run-ws-chain.sh) MUST call this on a phase's spec/prompt
// BEFORE launching the build agent; a non-zero exit refuses the launch. This promotes
// the spec-reviewer judgement from a POST-build check to a PRE-build gate — the drift
// on 2026-06-29 was a contaminated spec that built BEFORE anyone reviewed it.
//
//   node scripts/spec-intent-check.mjs <spec-or-prompt-file> [...more files]
//
// Mirrors .claude/INTENT-LOCK.md. Exit 0 = clear to build; 2 = refuse.

import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: spec-intent-check.mjs <spec-or-prompt-file> [...]');
  process.exit(2);
}

const CHECKS = [
  [/(retire|remove|migrate[ -]*away|replace|delete)[^.]{0,80}((legacy[ -]*(dom[ -]*)?)?[`'"]?\/[`'"]?[ -]*(editor|route)|components\/editor|legacy[ -]*editor)/i,
    'retire/remove/replace the / editor (PROTECTED — INTENT-LOCK #1)'],
  [/edit[^.]{0,12}from[^.]{0,8}preview|click[^.]{0,30}preview[^.]{0,30}edit|prompt-?edit[^.]{0,20}from[^.]{0,8}preview/i,
    'edit-from-preview (editing is in CANVAS — INTENT-LOCK #2)'],
  [/rebuild[^.]{0,24}galaxy[^.]{0,24}directory|galaxy[^.]{0,32}(as[ ]a[ ])?(full[ ])?directory[^.]{0,32}(rebuild|build|completion)/i,
    'rebuild galaxy-as-directory (it already IS the directory — INTENT-LOCK #3)'],
  [/capability[ -]*glyphs?/i,
    'per-node capability glyphs (unrequested 2026-06-29 planner invention — needs founder signoff)'],
  [/<Environment[^>]*\bpreset\s*=|raw\.githack\.com|polyhaven\.org/i,
    'introduces a remote-CDN asset / drei <Environment preset> (NO remote assets — INTENT-LOCK #5)'],
  [/\bSUPERSEDES\b|ACTIVE build-truth|Canonical \(additive\)/i,
    'self-promotes to build-truth (SUPERSEDES/Canonical — INTENT-LOCK #7)'],
];

let failed = false;
for (const file of files) {
  let text = '';
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`⛔ cannot read ${file}: ${e.message}`);
    failed = true;
    continue;
  }
  const signoff = /#\s*FOUNDER-SIGNOFF:\s*\d{4}/i.test(text);
  const hits = CHECKS.filter(([re]) => re.test(text)).map(([, m]) => m);
  if (hits.length && !signoff) {
    console.error(`⛔ SPEC-INTENT-CHECK refuses to launch a build from: ${file}`);
    for (const h of hits) console.error('   • ' + h);
    failed = true;
  } else {
    console.log(`✓ spec-intent-check OK: ${file}${signoff ? ' (founder-signoff present)' : ''}`);
  }
}

if (failed) {
  console.error('\nContradicts .claude/INTENT-LOCK.md. Re-ground the plan, or add a founder-authored');
  console.error('# FOUNDER-SIGNOFF: <YYYY-MM-DD> token. Do NOT build from a contaminated spec.');
  process.exit(2);
}
process.exit(0);
