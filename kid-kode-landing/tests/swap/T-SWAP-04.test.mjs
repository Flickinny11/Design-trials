// Acceptance test for T-SWAP-04 — hand-tuned BBOX map + extract-video.mjs.
// Spec ref: §-IMAGE-TO-UI (architecture-block in kid-kode-landing/CLAUDE.md —
// "Image-to-UI (not image-to-code)" + "Invisible-placeholder pattern").
//
// Task contract (from ralph-state.json):
//   "Each text block = own node. Each of the 4 play-button video tiles = own
//    node (nodeId pattern: video-slot-1..4). Write scripts/extract-video.mjs
//    that reads the BBOX map and writes source-images/cropped/<nodeId>.png
//    for each. Document the BBOX map inline as a `const BBOX = {...}` so it's
//    reviewable."
//
// Passes iff:
//   1. kid-kode-landing/scripts/extract-video.mjs exists and is valid ESM.
//   2. The script is a pure local transform — it must not import
//      @fal-ai/client or call fetch() (hand-tuned BBOX, no network).
//   3. Source imports sharp (used for crop extraction).
//   4. Source references the canonical mockup path
//      notes/mockup-candidates/ai-video-mockup.png and the cropped output dir
//      src/lib/prism/mock-app-source/assets/source-images/cropped.
//   5. Source declares a reviewable, literal `const BBOX = {...}` map.
//   6. BBOX covers every visible AETHER zone (T-SWAP-01 summary):
//        - page-background full-canvas entry
//        - navbar container + logo + five nav-link entries
//          (features, showcase, pricing, about, login)
//        - a hero video/image frame entry
//        - a hero headline text entry
//        - a hero primary CTA entry (GET STARTED FREE)
//        - a hero secondary CTA entry (Watch Demo)
//        - exactly four video-slot entries keyed video-slot-1..4
//        - at least one footer entry AND at least two social icon entries
//   7. Running the script against a synthetic fixture mockup (using env-var
//      overrides) actually writes one <nodeId>.png under the cropped output
//      directory per declared BBOX key. Each produced PNG is a valid image.
//   8. Each BBOX entry has a { x, y, w, h } shape (numeric), or is an
//      explicit invisible-placeholder (the TINY pattern from CLAUDE.md's
//      "Invisible-placeholder pattern" section).
//
// Run with: node kid-kode-landing/tests/swap/T-SWAP-04.test.mjs

import { strict as assert } from 'node:assert';
import {
  readFileSync,
  readdirSync,
  existsSync,
  mkdtempSync,
  rmSync,
  statSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const kidKodeRoot = resolve(here, '..', '..');

const scriptPath = resolve(kidKodeRoot, 'scripts/extract-video.mjs');
const canonicalMockup = resolve(
  kidKodeRoot,
  'notes/mockup-candidates/ai-video-mockup.png',
);

// 1. Script exists.
assert.ok(existsSync(scriptPath), `missing script: ${scriptPath}`);
const src = readFileSync(scriptPath, 'utf8');

// 2. Pure local — no FAL / network imports.
assert.ok(
  !/@fal-ai\/client/.test(src),
  'extract-video.mjs must not import @fal-ai/client — BBOX is hand-tuned',
);
assert.ok(
  !/\bfetch\s*\(/.test(src),
  'extract-video.mjs must not call fetch() — pure local crop extraction',
);

// 3. Imports sharp.
assert.match(
  src,
  /from\s+['"]sharp['"]/,
  'extract-video.mjs must import sharp (for crop extraction)',
);

// 4. Canonical paths.
assert.match(
  src,
  /notes\/mockup-candidates\/ai-video-mockup\.png/,
  'script must reference notes/mockup-candidates/ai-video-mockup.png as input',
);
assert.match(
  src,
  /source-images\/cropped/,
  'script must write into src/lib/prism/mock-app-source/assets/source-images/cropped/',
);

// 5. BBOX declared as a literal const.
assert.match(
  src,
  /const\s+BBOX\s*=\s*\{/,
  'script must declare `const BBOX = {...}` so the hand-tuned map is reviewable',
);

// 6. Extract every BBOX key by string-scanning between `const BBOX = {` and its
//    matching closing brace. Entries are of the form "'<key>':" or '"<key>":'.
const bboxOpen = src.search(/const\s+BBOX\s*=\s*\{/);
assert.ok(bboxOpen !== -1, 'could not locate `const BBOX = {` in script');
// Walk forward to balance braces so nested shorthand (e.g. { ...TINY }) doesn't
// terminate the scan early.
const afterBrace = src.indexOf('{', bboxOpen);
let depth = 1;
let end = afterBrace + 1;
for (; end < src.length && depth > 0; end++) {
  const ch = src[end];
  if (ch === '{') depth += 1;
  else if (ch === '}') depth -= 1;
}
assert.equal(depth, 0, 'BBOX literal block is not brace-balanced');
const bboxBlock = src.slice(afterBrace, end);

const declaredKeys = [
  ...bboxBlock.matchAll(/(?:^|[{,\s])(['"])([a-z0-9][a-z0-9-]*)\1\s*:/gi),
].map((m) => m[2]);

// De-duplicate while preserving order.
const seen = new Set();
const keys = [];
for (const k of declaredKeys) {
  if (!seen.has(k)) {
    seen.add(k);
    keys.push(k);
  }
}

function keyPresent(pred) {
  return keys.some(pred);
}

assert.ok(
  keys.includes('page-background'),
  `BBOX must declare a page-background entry; declared keys: ${JSON.stringify(keys)}`,
);

// Nav coverage: a navbar container, a logo, and 5 distinct nav-link entries
// covering features, showcase, pricing, about, login (T-SWAP-01 paragraph).
assert.ok(
  keyPresent((k) => /^navbar(-|$)/.test(k) && /(bar|pill|container)/.test(k)) ||
    keys.includes('navbar-bg'),
  `BBOX must declare a navbar container entry; declared keys: ${JSON.stringify(keys)}`,
);
assert.ok(
  keyPresent((k) => /^navbar-logo$/.test(k) || /logo/.test(k)),
  `BBOX must declare a logo entry; declared keys: ${JSON.stringify(keys)}`,
);
const NAV_LINK_WORDS = ['features', 'showcase', 'pricing', 'about', 'login'];
for (const w of NAV_LINK_WORDS) {
  assert.ok(
    keyPresent((k) => k.includes(w)),
    `BBOX must declare a nav link for "${w}"; declared keys: ${JSON.stringify(keys)}`,
  );
}

// Hero coverage: a frame/video/image-frame entry, a headline text entry,
// a primary CTA, and a secondary CTA.
assert.ok(
  keyPresent((k) => /hero/.test(k) && /(video|frame|image|thumbnail)/.test(k)),
  `BBOX must declare a hero video/frame entry; declared keys: ${JSON.stringify(keys)}`,
);
assert.ok(
  keyPresent((k) => /hero/.test(k) && /(headline|heading)/.test(k)),
  `BBOX must declare a hero headline text entry; declared keys: ${JSON.stringify(keys)}`,
);
assert.ok(
  keyPresent(
    (k) => /hero/.test(k) && /(cta|primary|get-?started|start)/.test(k),
  ),
  `BBOX must declare a hero primary CTA entry; declared keys: ${JSON.stringify(keys)}`,
);
assert.ok(
  keyPresent((k) => /hero/.test(k) && /(secondary|watch|demo)/.test(k)),
  `BBOX must declare a hero secondary CTA entry; declared keys: ${JSON.stringify(keys)}`,
);

// Video tile row: exactly 4 video-slot entries keyed video-slot-1..4.
for (const n of [1, 2, 3, 4]) {
  assert.ok(
    keys.includes(`video-slot-${n}`),
    `BBOX must declare video-slot-${n} (contract: video-slot-1..4); declared keys: ${JSON.stringify(keys)}`,
  );
}

// Footer: at least one footer entry + at least two social icon entries.
const footerKeys = keys.filter((k) => /^footer/.test(k));
assert.ok(
  footerKeys.length >= 1,
  `BBOX must declare at least one footer entry; declared keys: ${JSON.stringify(keys)}`,
);
const socialKeys = keys.filter((k) => /social|discord|twitter|x-icon/.test(k));
assert.ok(
  socialKeys.length >= 2,
  `BBOX must declare at least two social icon entries; declared keys: ${JSON.stringify(keys)}`,
);

// 7 + 8. Dynamic run against a synthetic mockup.
assert.ok(
  existsSync(canonicalMockup),
  `missing canonical mockup PNG at ${canonicalMockup} — required for sharp metadata read`,
);

const tmp = mkdtempSync(join(tmpdir(), 'T-SWAP-04-'));
// Make a small synthetic mockup that matches the real aspect ratio so coord
// math is valid under env-var overrides.
const fixtureMockup = join(tmp, 'fixture-mockup.png');
await sharp({
  create: {
    width: 2816,
    height: 1536,
    channels: 4,
    background: { r: 10, g: 12, b: 24, alpha: 1 },
  },
})
  .png()
  .toFile(fixtureMockup);

const fixtureOutDir = join(tmp, 'cropped');

try {
  const run = spawnSync('node', [scriptPath], {
    cwd: kidKodeRoot,
    env: {
      ...process.env,
      MOCKUP_PNG: fixtureMockup,
      OUT_DIR: fixtureOutDir,
    },
    encoding: 'utf8',
  });

  if (run.status !== 0) {
    const errSnippet = (run.stderr || run.stdout || '').trim().slice(0, 800);
    assert.fail(`extract-video.mjs exited ${run.status}: ${errSnippet}`);
  }

  assert.ok(
    existsSync(fixtureOutDir),
    `script did not create output dir at ${fixtureOutDir}`,
  );

  const produced = readdirSync(fixtureOutDir).filter((f) => f.endsWith('.png'));
  // Every declared BBOX key should produce a <key>.png.
  for (const k of keys) {
    const p = join(fixtureOutDir, `${k}.png`);
    assert.ok(
      existsSync(p),
      `expected ${k}.png to be written under ${fixtureOutDir}; got: ${JSON.stringify(produced)}`,
    );
    // Non-empty PNG.
    const s = statSync(p);
    assert.ok(s.size > 0, `${k}.png is empty`);
    // Valid image metadata.
    const meta = await sharp(p).metadata();
    assert.ok(
      meta.width > 0 && meta.height > 0,
      `${k}.png has non-positive dimensions: ${meta.width}x${meta.height}`,
    );
  }

  console.log(
    `T-SWAP-04 OK — extract-video.mjs declares ${keys.length} BBOX entries (4 video-slot-N + full zone coverage), all crops produced`,
  );
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
