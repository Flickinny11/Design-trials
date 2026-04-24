// Acceptance test for T-SWAP-02 — segment-video.mjs (SAM 3 w/ concrete-noun prompts).
// Spec ref: §-IMAGE-TO-UI (architecture-block definition in CLAUDE.md + Phase G summary
// in notes/prism-mock-progress.md). This task follows the scripts/segment-scifi.mjs
// pattern and produces per-prompt RLE boxes for the AETHER AI landing-page mockup.
//
// Passes iff:
//   1. kid-kode-landing/scripts/segment-video.mjs exists and is valid ESM that at least
//      imports `@fal-ai/client`.
//   2. It reads the canonical mockup path
//      `notes/mockup-candidates/ai-video-mockup.png`.
//   3. It writes RLE output to
//      `notes/mockup-candidates/ai-video-mockup.sam.json`.
//   4. It targets the SAM 3 image-rle endpoint (`fal-ai/sam-3/image-rle`) with
//      `include_boxes: true`.
//   5. Every prompt it issues uses ONLY concrete-noun vocabulary. Abstract terms that
//      SAM 3 reliably fails on (`text`, `heading`, `link`, `label`, `title`,
//      `paragraph`, `wordmark`, `copy`) must NOT appear inside a PROMPTS array entry's
//      `prompt:` string. The task contract in ralph-state.json names the concrete-noun
//      set (button, card, icon, input, video tile, bar, panel); at least 4 of those
//      concrete nouns must appear across the PROMPTS entries so the script actually
//      exercises the AETHER layout (nav bar, hero CTA pill, 4 video tiles, footer).
//   6. The prompts array covers the four AETHER zones from T-SWAP-01 summary by naming
//      at least one of {tile, thumbnail, video, frame} (for the 4 video row) and at
//      least one of {button, pill, cta} (for the hero CTA).
//
// Run with: node kid-kode-landing/tests/swap/T-SWAP-02.test.mjs

import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const kidKodeRoot = resolve(here, '..', '..');

const scriptPath = resolve(kidKodeRoot, 'scripts/segment-video.mjs');

// 1. Script exists.
assert.ok(existsSync(scriptPath), `missing script: ${scriptPath}`);
const src = readFileSync(scriptPath, 'utf8');

// Valid ESM import of the fal client.
assert.match(src, /from\s+['"]@fal-ai\/client['"]/, 'script must import from @fal-ai/client');

// 2. Reads the canonical mockup path.
assert.match(
  src,
  /notes\/mockup-candidates\/ai-video-mockup\.png/,
  'script must reference notes/mockup-candidates/ai-video-mockup.png as input'
);

// 3. Writes the canonical output path.
assert.match(
  src,
  /notes\/mockup-candidates\/ai-video-mockup\.sam\.json/,
  'script must write notes/mockup-candidates/ai-video-mockup.sam.json as output'
);

// 4. Uses the SAM 3 image-rle endpoint with include_boxes: true.
assert.match(src, /fal-ai\/sam-3\/image-rle/, 'script must call fal-ai/sam-3/image-rle');
assert.match(src, /include_boxes\s*:\s*true/, 'script must pass include_boxes: true');

// 5 + 6. Inspect PROMPTS entries — pull every `prompt: '...'` or `prompt: "..."` string.
const promptStrings = [...src.matchAll(/prompt\s*:\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1].toLowerCase());
assert.ok(
  promptStrings.length >= 4,
  `expected >=4 prompt entries, got ${promptStrings.length}: ${JSON.stringify(promptStrings)}`
);

const FORBIDDEN_ABSTRACT = ['text', 'heading', 'link', 'label', 'title', 'paragraph', 'wordmark', 'copy'];
for (const p of promptStrings) {
  for (const bad of FORBIDDEN_ABSTRACT) {
    // Match the abstract term as a whole word so "button" doesn't match "label".
    const re = new RegExp(`\\b${bad}\\b`);
    assert.ok(
      !re.test(p),
      `prompt "${p}" contains forbidden abstract term "${bad}" — SAM 3 reliably fails on it; use concrete nouns only`
    );
  }
}

// Concrete-noun coverage: at least 4 of the contract nouns must appear across prompts.
const CONTRACT_NOUNS = ['button', 'card', 'icon', 'input', 'tile', 'bar', 'panel', 'pill', 'thumbnail'];
const joined = promptStrings.join(' | ');
const coveredNouns = CONTRACT_NOUNS.filter(n => new RegExp(`\\b${n}\\b`).test(joined));
assert.ok(
  coveredNouns.length >= 4,
  `expected >=4 contract nouns across prompts; covered=${JSON.stringify(coveredNouns)} prompts=${JSON.stringify(promptStrings)}`
);

// AETHER-zone coverage.
const hasVideoTileTerm = /\b(tile|thumbnail|video|frame)\b/.test(joined);
const hasCtaTerm = /\b(button|pill|cta)\b/.test(joined);
assert.ok(hasVideoTileTerm, `prompts must cover the 4-video row (tile|thumbnail|video|frame); got: ${joined}`);
assert.ok(hasCtaTerm, `prompts must cover the hero CTA pill (button|pill|cta); got: ${joined}`);

console.log(`T-SWAP-02 OK — segment-video.mjs present, ${promptStrings.length} concrete-noun prompts, ${coveredNouns.length}/9 contract nouns covered: ${coveredNouns.join(', ')}`);
