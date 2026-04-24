// Acceptance test for T-SWAP-05 — alpha-cutout per-image threshold override
// Spec ref: §-IMAGE-TO-UI (architecture-block in kid-kode-landing/CLAUDE.md —
// "Alpha-cutout discipline (per-node crops only)").
//
// Task contract (from ralph-state.json):
//   "scripts/alpha-cutout.mjs already exists with LOW=18, HIGH=55 luminance
//    thresholds. The Gemini image may have a different dark-tone baseline —
//    add a per-image threshold override (LOW_OVERRIDE / HIGH_OVERRIDE env
//    vars). Run against every cropped <nodeId>.png so backgrounds turn
//    transparent. Skip the full-mockup page-background image (it keeps
//    opaque slate)."
//
// Passes iff:
//   1. kid-kode-landing/scripts/alpha-cutout.mjs exists and is valid ESM.
//   2. Source references LOW_OVERRIDE env var (read via process.env).
//   3. Source references HIGH_OVERRIDE env var (read via process.env).
//   4. Source supports an env-var override for the target directory (so the
//      script can aim at source-images/cropped/ or an arbitrary fixture dir
//      without hardcoding the path).
//   5. Source references 'page-background' as a skip key (the full-mockup
//      backdrop stays opaque per CLAUDE.md §-IMAGE-TO-UI).
//   6. Default target dir (when no override) points at the cropped/
//      subdir of source-images (the new canonical path after the AETHER
//      mockup swap — cropped/ supersedes base/ for the per-node-crop dir).
//   7. Dynamic run — create a fixture directory with:
//        - page-background.png (opaque slate) → MUST be byte-for-byte
//          unchanged after the script runs.
//        - mixed-lum.png (dark surround + bright center) → MUST emerge with
//          alpha-0 dark corners and alpha-255 bright center after the
//          script runs with default thresholds.
//   8. Dynamic run with LOW_OVERRIDE=250 / HIGH_OVERRIDE=255 — the same
//      bright-center pixel that was alpha-255 under defaults MUST now be
//      alpha-0 (proving the override actually shifts the thresholds).
//
// Run with: node kid-kode-landing/tests/swap/T-SWAP-05.test.mjs

import { strict as assert } from 'node:assert';
import {
  readFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const kidKodeRoot = resolve(here, '..', '..');
const scriptPath = resolve(kidKodeRoot, 'scripts/alpha-cutout.mjs');

// 1. Script exists.
assert.ok(existsSync(scriptPath), `missing script: ${scriptPath}`);
const src = readFileSync(scriptPath, 'utf8');

// 2 + 3. Per-image threshold overrides from env.
assert.match(
  src,
  /process\.env\.LOW_OVERRIDE/,
  'alpha-cutout.mjs must read LOW_OVERRIDE from process.env',
);
assert.match(
  src,
  /process\.env\.HIGH_OVERRIDE/,
  'alpha-cutout.mjs must read HIGH_OVERRIDE from process.env',
);

// 4. Target directory is overridable.
assert.match(
  src,
  /process\.env\.(CUTOUT_DIR|INPUT_DIR|BASE_DIR|TARGET_DIR)/,
  'alpha-cutout.mjs must accept an env-var override for the target directory',
);

// 5. page-background is in the skip set.
assert.match(
  src,
  /['"]page-background['"]/,
  "alpha-cutout.mjs must skip 'page-background' (opaque slate backdrop)",
);

// 6. Default target dir points at source-images/cropped/ (new canonical
//    after AETHER mockup swap).
assert.match(
  src,
  /source-images\/cropped/,
  'alpha-cutout.mjs default target dir must be source-images/cropped/',
);

// 7 + 8. Dynamic run.
const tmp = mkdtempSync(join(tmpdir(), 'T-SWAP-05-'));
try {
  const fixtureDir = join(tmp, 'cropped');
  mkdirSync(fixtureDir, { recursive: true });

  // page-background fixture: uniform low-lum slate. Snapshot bytes to compare.
  const pageBgPath = join(fixtureDir, 'page-background.png');
  await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 4,
      background: { r: 10, g: 12, b: 24, alpha: 1 },
    },
  })
    .png()
    .toFile(pageBgPath);
  const origPageBg = readFileSync(pageBgPath);

  // mixed-lum fixture: dark surround (lum ~5) + bright center (lum ~200).
  const mixedPath = join(fixtureDir, 'some-node.png');
  const W = 32,
    H = 32;
  const raw = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const inCenter = x >= 8 && x < 24 && y >= 8 && y < 24;
      const v = inCenter ? 200 : 5;
      raw[i] = v;
      raw[i + 1] = v;
      raw[i + 2] = v;
      raw[i + 3] = 255;
    }
  }
  await sharp(raw, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toFile(mixedPath);

  // Run default thresholds.
  const run = spawnSync('node', [scriptPath], {
    cwd: kidKodeRoot,
    env: { ...process.env, CUTOUT_DIR: fixtureDir },
    encoding: 'utf8',
  });
  if (run.status !== 0) {
    const snippet = (run.stderr || run.stdout || '').trim().slice(0, 800);
    assert.fail(`alpha-cutout.mjs exited ${run.status}: ${snippet}`);
  }

  // page-background must be byte-for-byte unchanged.
  const afterPageBg = readFileSync(pageBgPath);
  assert.ok(
    afterPageBg.equals(origPageBg),
    'page-background.png must NOT be modified by alpha-cutout.mjs (skipped)',
  );

  // mixed: dark corner → alpha 0; bright center → alpha 255.
  const mixedOut = await sharp(mixedPath).ensureAlpha().raw().toBuffer();
  const cornerAlphaIdx = 3; // pixel (0,0) → [r,g,b,a]
  assert.equal(
    mixedOut[cornerAlphaIdx],
    0,
    `dark corner of mixed-lum crop should be alpha 0 (was ${mixedOut[cornerAlphaIdx]})`,
  );
  const centerIdx = (16 * W + 16) * 4 + 3;
  assert.equal(
    mixedOut[centerIdx],
    255,
    `bright center of mixed-lum crop should be alpha 255 under defaults (was ${mixedOut[centerIdx]})`,
  );

  // 8. Re-create the mixed fixture and run with extreme overrides —
  //    LOW_OVERRIDE=250 should push the bright center below LOW → alpha 0.
  await sharp(raw, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toFile(mixedPath);
  const run2 = spawnSync('node', [scriptPath], {
    cwd: kidKodeRoot,
    env: {
      ...process.env,
      CUTOUT_DIR: fixtureDir,
      LOW_OVERRIDE: '250',
      HIGH_OVERRIDE: '255',
    },
    encoding: 'utf8',
  });
  if (run2.status !== 0) {
    const snippet = (run2.stderr || run2.stdout || '').trim().slice(0, 800);
    assert.fail(
      `alpha-cutout.mjs (LOW_OVERRIDE=250) exited ${run2.status}: ${snippet}`,
    );
  }

  const mixedOut2 = await sharp(mixedPath).ensureAlpha().raw().toBuffer();
  assert.equal(
    mixedOut2[centerIdx],
    0,
    `bright center (lum ~200) MUST be alpha 0 when LOW_OVERRIDE=250 (was ${mixedOut2[centerIdx]}) — proves override shifts thresholds`,
  );

  console.log(
    'T-SWAP-05 OK — alpha-cutout.mjs supports CUTOUT_DIR + LOW_OVERRIDE + HIGH_OVERRIDE; page-background skipped',
  );
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
