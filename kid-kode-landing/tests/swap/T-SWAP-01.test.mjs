// Acceptance test for T-SWAP-01 — relocate Gemini mockup + visually inspect layout.
// Spec ref: §-IMAGE-TO-UI (architecture-block definition in CLAUDE.md + session-handoff-2026-04-24).
//
// Passes iff:
//   1. notes/mockup-candidates/ai-video-mockup.png exists at the canonical target path,
//   2. the file is a valid PNG (magic bytes) at least 1 MB in size (Gemini-export sanity floor),
//   3. the source Gemini_Generated_Image_*.png no longer sits at the repo root (move, not copy),
//   4. notes/prism-mock-progress.md's "## Phase G" section contains a one-paragraph
//      visible-regions summary naming nav chrome, prompt/hero, video tiles (play buttons),
//      and side-panel controls, plus the mockup's pixel dimensions.
//
// Run with: node kid-kode-landing/tests/swap/T-SWAP-01.test.mjs
// (cwd may be repo-root or kid-kode-landing/ — paths resolve off import.meta.url.)

import { strict as assert } from 'node:assert';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const kidKodeRoot = resolve(here, '..', '..');           // kid-kode-landing/
const repoRoot = resolve(kidKodeRoot, '..');             // Design-trials/

const targetPng = resolve(kidKodeRoot, 'notes/mockup-candidates/ai-video-mockup.png');
const sourcePng = resolve(repoRoot, 'Gemini_Generated_Image_2w5g832w5g832w5g.png');
const progressLog = resolve(kidKodeRoot, 'notes/prism-mock-progress.md');

// 1. Target PNG exists at canonical path.
assert.ok(existsSync(targetPng), `target mockup missing at ${targetPng}`);

// 2. Valid PNG magic + ≥1 MB.
const buf = readFileSync(targetPng);
const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
assert.ok(buf.slice(0, 8).equals(pngMagic), 'target mockup is not a valid PNG (magic bytes mismatch)');
const sizeMb = statSync(targetPng).size / (1024 * 1024);
assert.ok(sizeMb >= 1, `target mockup too small (${sizeMb.toFixed(2)} MB) — likely not the Gemini export`);

// 3. Source PNG moved (no longer at repo root).
assert.ok(!existsSync(sourcePng), `source Gemini png still at repo root: ${sourcePng} — move, don't copy`);

// 4. Progress log has Phase G visible-regions summary paragraph.
const log = readFileSync(progressLog, 'utf8');
const phaseGIdx = log.indexOf('## Phase G');
assert.ok(phaseGIdx !== -1, 'notes/prism-mock-progress.md is missing "## Phase G" section');

// Carve the Phase G section out (until next ## or EOF) and look for a visible-regions block.
const afterPhaseG = log.slice(phaseGIdx);
const nextSection = afterPhaseG.slice(3).search(/\n## /);
const phaseGBody = nextSection === -1 ? afterPhaseG : afterPhaseG.slice(0, nextSection + 3);

// Accept either an explicit "Visible regions" subheading or a paragraph that covers the four
// required zones. We match the zones on the body as a whole.
const body = phaseGBody.toLowerCase();
const hasNav = /\bnav(?:bar|igation| chrome| rail| bar|)\b/.test(body);
const hasPrompt = /\b(?:prompt|hero)\b/.test(body);
const hasVideo = /\b(?:video tile|video|play[- ]?button|play icon)\b/.test(body);
const hasSidePanel = /\b(?:side[- ]?panel|side bar|right panel|controls panel|control panel)\b/.test(body);

assert.ok(hasNav, 'Phase G summary does not mention nav / nav chrome');
assert.ok(hasPrompt, 'Phase G summary does not mention prompt or hero area');
assert.ok(hasVideo, 'Phase G summary does not mention video tiles / play buttons');
assert.ok(hasSidePanel, 'Phase G summary does not mention side panel / controls');

// Dimensions reference — must mention the mockup's pixel size so downstream tasks
// (hub.layout.viewportWidth / contentHeight in T-SWAP-06) have a single source of truth.
const hasDims = /\b\d{3,4}\s*[x×]\s*\d{3,4}\b/.test(phaseGBody);
assert.ok(hasDims, 'Phase G summary does not state mockup pixel dimensions (e.g. "1024x1536")');

console.log('T-SWAP-01 OK — mockup relocated, layout summary written');
