// Acceptance test for T-SWAP-03 — debug overlay script (SAM bboxes rendered on mockup).
// Spec ref: §-IMAGE-TO-UI (architecture-block in kid-kode-landing/CLAUDE.md).
//
// Passes iff:
//   1. kid-kode-landing/scripts/debug-video-boxes.mjs exists and is valid ESM.
//   2. The script does NOT import @fal-ai/client (it is a pure local transform over
//      the sam.json artifact; running it must not hit the network / cost money).
//   3. Source references the canonical input/output paths:
//        - input:  notes/mockup-candidates/ai-video-mockup.sam.json
//        - output: notes/mockup-candidates/ai-video-mockup.overlay.svg
//        - mockup: notes/mockup-candidates/ai-video-mockup.png (for dimensions)
//   4. Source imports sharp (used to read mockup dimensions) and writes SVG containing
//      <svg>, <rect>, and <text> elements (colored rectangles + labels per task notes).
//   5. Executing the script against a synthetic sam.json fixture actually produces a
//      valid SVG file whose content reflects the fixture boxes:
//        - one <rect> per result entry, scaled from normalized [cx,cy,w,h] → pixel space,
//        - one <text> label per entry containing the result's `key`,
//        - fill="none" stroke="<hex>" stroke-width set on each rect (no filled rects),
//        - the stroke color differs between two distinct prompt keys (per-key palette).
//      Execution uses env-var overrides so the script stays a general local transform
//      and the test does not clobber any real artifact.
//
// Run with: node kid-kode-landing/tests/swap/T-SWAP-03.test.mjs

import { strict as assert } from 'node:assert';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const kidKodeRoot = resolve(here, '..', '..');

const scriptPath = resolve(kidKodeRoot, 'scripts/debug-video-boxes.mjs');
const canonicalMockup = resolve(kidKodeRoot, 'notes/mockup-candidates/ai-video-mockup.png');

// 1. Script exists.
assert.ok(existsSync(scriptPath), `missing script: ${scriptPath}`);
const src = readFileSync(scriptPath, 'utf8');

// 2. No FAL / network imports — this is a local transform only.
assert.ok(
  !/@fal-ai\/client/.test(src),
  'debug overlay script must not import @fal-ai/client — it is a pure local transform'
);
assert.ok(!/\bfetch\s*\(/.test(src), 'debug overlay script must not call fetch()');

// 3. Canonical paths are referenced in the source.
assert.match(
  src,
  /notes\/mockup-candidates\/ai-video-mockup\.sam\.json/,
  'script must reference notes/mockup-candidates/ai-video-mockup.sam.json as input'
);
assert.match(
  src,
  /notes\/mockup-candidates\/ai-video-mockup\.overlay\.svg/,
  'script must reference notes/mockup-candidates/ai-video-mockup.overlay.svg as output'
);
assert.match(
  src,
  /notes\/mockup-candidates\/ai-video-mockup\.png/,
  'script must reference notes/mockup-candidates/ai-video-mockup.png for dimensions'
);

// 4. sharp import + SVG element production.
assert.match(src, /from\s+['"]sharp['"]/, 'script must import sharp (to read mockup metadata)');
assert.match(src, /<svg\b/, 'script must emit an <svg> element');
assert.match(src, /<rect\b/, 'script must emit <rect> elements');
assert.match(src, /<text\b/, 'script must emit <text> labels');

// 5. Dynamic run against a synthetic fixture.
assert.ok(
  existsSync(canonicalMockup),
  `missing canonical mockup PNG at ${canonicalMockup} — required for dimension read`
);

const tmp = mkdtempSync(join(tmpdir(), 'T-SWAP-03-'));
const fixtureSam = join(tmp, 'fixture.sam.json');
const fixtureSvg = join(tmp, 'fixture.overlay.svg');

// Synthetic SAM output: two distinct keys, three boxes, each in normalized [cx,cy,w,h].
const fixture = {
  mockup: canonicalMockup,
  imageUrl: 'fixture://local',
  promptCount: 2,
  totalMasks: 3,
  results: [
    { key: 'pill',   prompt: 'pill',   box: [0.25, 0.10, 0.20, 0.04], score: 0.88, rle: null },
    { key: 'pill',   prompt: 'pill',   box: [0.75, 0.10, 0.10, 0.04], score: 0.81, rle: null },
    { key: 'tile',   prompt: 'tile',   box: [0.50, 0.60, 0.40, 0.25], score: 0.77, rle: null },
  ],
};
writeFileSync(fixtureSam, JSON.stringify(fixture, null, 2));

try {
  const run = spawnSync('node', [scriptPath], {
    cwd: kidKodeRoot,
    env: {
      ...process.env,
      SAM_JSON: fixtureSam,
      MOCKUP_PNG: canonicalMockup,
      OVERLAY_SVG: fixtureSvg,
    },
    encoding: 'utf8',
  });

  if (run.status !== 0) {
    const errSnippet = (run.stderr || run.stdout || '').trim().slice(0, 400);
    assert.fail(`debug-video-boxes.mjs exited ${run.status}: ${errSnippet}`);
  }

  assert.ok(existsSync(fixtureSvg), `script did not write output SVG at ${fixtureSvg}`);
  const svg = readFileSync(fixtureSvg, 'utf8');

  // Basic SVG structure.
  assert.match(svg, /<svg[\s\S]*<\/svg>/, 'output is not a well-formed <svg>...</svg> document');

  // One <rect> per fixture result.
  const rectCount = (svg.match(/<rect\b/g) ?? []).length;
  assert.equal(
    rectCount,
    fixture.results.length,
    `expected ${fixture.results.length} <rect> elements, found ${rectCount}`
  );

  // One <text> label per fixture result.
  const textCount = (svg.match(/<text\b/g) ?? []).length;
  assert.equal(
    textCount,
    fixture.results.length,
    `expected ${fixture.results.length} <text> labels, found ${textCount}`
  );

  // Each rect must be outline-only (fill="none") with a stroke attribute.
  const rects = [...svg.matchAll(/<rect\b[^>]*>/g)].map(m => m[0]);
  for (const r of rects) {
    assert.match(r, /fill="none"/, `rect missing fill="none": ${r}`);
    assert.match(r, /stroke="#[0-9a-fA-F]{3,6}"/, `rect missing hex stroke color: ${r}`);
    assert.match(r, /stroke-width="?\d+/, `rect missing stroke-width: ${r}`);
  }

  // Labels reference the fixture keys.
  assert.ok(svg.includes('pill'), 'output SVG should contain the "pill" key label');
  assert.ok(svg.includes('tile'), 'output SVG should contain the "tile" key label');

  // Per-key palette: pill and tile strokes must differ.
  // Pair rects and text labels by document order (script emits rect directly before label).
  const rectAttrs = [...svg.matchAll(/<rect\b[^>]*\/>/g)].map(m => m[0]);
  const textInners = [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map(m => m[1]);
  assert.equal(
    rectAttrs.length,
    textInners.length,
    `rect/text count mismatch for pairing (rect=${rectAttrs.length}, text=${textInners.length})`
  );
  const strokes = rectAttrs.map((r, i) => {
    const strokeMatch = r.match(/stroke="(#[0-9a-fA-F]{3,6})"/);
    return { stroke: strokeMatch?.[1] ?? null, label: textInners[i] };
  });
  const pillStroke = strokes.find(s => /pill/.test(s.label))?.stroke;
  const tileStroke = strokes.find(s => /tile/.test(s.label))?.stroke;
  assert.ok(pillStroke, 'could not locate stroke color for pill rect');
  assert.ok(tileStroke, 'could not locate stroke color for tile rect');
  assert.notEqual(
    pillStroke,
    tileStroke,
    `per-key palette must assign distinct stroke colors: pill=${pillStroke} tile=${tileStroke}`
  );

  console.log(
    `T-SWAP-03 OK — debug-video-boxes.mjs produces overlay SVG with ${rectCount} rects + ${textCount} labels, per-key palette verified`
  );
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
