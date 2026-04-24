// Acceptance test for T-VID-03 — WAN 2.7 i2v placeholder video generation
// (SKIP if user provides content).
//
// Spec ref: §-SPEC-ENRICH (prism-spec-extract.md:1336) — this task wires
// the auto-generated branch of the user-vs-auto classifier flow using
// fal-ai/wan/v2.7/image-to-video, conditioning on the per-slot mockup
// crops from T-SWAP-04.
//
// Cost ceiling: $2.00 (4 clips × $0.50 each via fal-ai/wan/v2.7/image-to-video).
// The task's own ralph-state notes require PROMPTING THE USER FIRST and
// proceeding to generation only on explicit confirmation. Therefore the
// deliverable for this iteration is the *gated infrastructure*, not the
// generated outputs — the gate itself is what this test enforces.
//
// Acceptance contract (exactly what this test locks):
//
//   (A) Script presence. scripts/generate-placeholder-videos.mjs exists.
//       Future iterations, including the one that runs after user
//       confirmation, invoke this file.
//
//   (B) Model-ID reference. The script uses fal-ai/wan/v2.7/image-to-video
//       (per CLAUDE.md §5 model IDs and prism-spec-extract.md:1336). A
//       different model would silently violate the cost model and the
//       classifier design note.
//
//   (C) Cost-gate env var. The script is gated behind an explicit env
//       var (PRISM_CONFIRM_VIDEO_GENERATION). Without it, no FAL call
//       fires. This mirrors the task note's "only proceed to generation
//       on explicit confirmation" constraint.
//
//   (D) $2.00 cost ceiling literal. The script names the ceiling in
//       source text (2.00 or $2.00) so a reader doesn't have to multiply
//       the per-clip cost to notice it.
//
//   (E) Per-clip cost literal. The script names the per-clip cost (0.50
//       or $0.50) so the ceiling derivation is auditable.
//
//   (F) Clip count. The script targets exactly 4 video-slot-{1..4} nodes
//       (matching T-VID-01's 4 home-hub.json entries). Three or five
//       would silently desync with the graph.
//
//   (G) Image conditioning source. The script reads the per-slot crops
//       (cropped/video-slot-{1..4}.png under source-images/) as the i2v
//       image input. Generating without conditioning produces a wildly
//       off-palette clip that drops the AETHER aesthetic.
//
//   (H) Output path. The script writes outputs to source-videos/
//       (matching the src: "source-videos/video-slot-N.mp4" paths
//       already baked into home-hub.json by T-VID-01).
//
//   (I) User-supplied early-exit. The script short-circuits if
//       source-videos/video-slot-{1..4}.mp4 already exist on disk (the
//       user-supplied branch). Without this, re-running after the user
//       drops their own content would overwrite it with placeholders.
//
//   (J) source-videos/README.md exists and documents both branches
//       (user-supplied drop-in AND auto-generation opt-in). This is the
//       artifact the ralph-state notes call "prompt the user first via
//       a status commit" — a README that tells the user which env var
//       to set and which files to drop.
//
//   (K) Runtime gate test. Invoking the script WITHOUT the confirmation
//       env var must exit non-zero and print a recognizable gate-refusal
//       message. This is the invariant that protects against an
//       accidental untended run charging the user $2.00.
//
// Run with: node tests/vid/T-VID-03.test.mjs

import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const kidKodeRoot = resolve(here, '..', '..');
const scriptPath = resolve(kidKodeRoot, 'scripts/generate-placeholder-videos.mjs');
const readmePath = resolve(kidKodeRoot, 'source-videos/README.md');

// ─── (A) Script presence ──────────────────────────────────────────────
assert.ok(
  existsSync(scriptPath),
  'scripts/generate-placeholder-videos.mjs must exist (T-VID-03 wires the auto-generation branch)',
);

const src = readFileSync(scriptPath, 'utf8');

// ─── (B) Model-ID reference ───────────────────────────────────────────
assert.ok(
  /fal-ai\/wan\/v2\.7\/image-to-video/.test(src),
  'generate-placeholder-videos.mjs: must call fal-ai/wan/v2.7/image-to-video (§-SPEC-ENRICH / CLAUDE.md §5 model IDs)',
);

// ─── (C) Cost-gate env var ────────────────────────────────────────────
assert.ok(
  /PRISM_CONFIRM_VIDEO_GENERATION/.test(src),
  'generate-placeholder-videos.mjs: must gate execution behind PRISM_CONFIRM_VIDEO_GENERATION env var',
);

// ─── (D) $2.00 cost ceiling literal ───────────────────────────────────
assert.ok(
  /\$?2\.00\b/.test(src),
  'generate-placeholder-videos.mjs: must name the $2.00 cost ceiling in source text (per T-VID-03 ralph-state notes)',
);

// ─── (E) Per-clip cost literal ────────────────────────────────────────
assert.ok(
  /\$?0\.50\b/.test(src),
  'generate-placeholder-videos.mjs: must name the $0.50 per-clip cost so the ceiling derivation is auditable',
);

// ─── (F) 4-slot clip count ────────────────────────────────────────────
assert.ok(
  /video-slot-1/.test(src) &&
    /video-slot-2/.test(src) &&
    /video-slot-3/.test(src) &&
    /video-slot-4/.test(src),
  'generate-placeholder-videos.mjs: must reference all 4 video-slot-{1..4} nodes (matches T-VID-01 home-hub entries)',
);

// ─── (G) Image conditioning source (cropped/video-slot-*.png) ─────────
assert.ok(
  /cropped\/video-slot-/.test(src) || /source-images\/cropped/.test(src),
  'generate-placeholder-videos.mjs: must read cropped/video-slot-*.png as i2v image conditioning (preserves AETHER palette)',
);

// ─── (H) Output path under source-videos/ ─────────────────────────────
assert.ok(
  /source-videos\//.test(src),
  'generate-placeholder-videos.mjs: must write outputs under source-videos/ (matches home-hub.json interactions[].src paths)',
);

// ─── (I) User-supplied early-exit ─────────────────────────────────────
// The script must look at source-videos/ for existing user-supplied
// MP4s and skip regeneration if all 4 are present. A bare filesystem
// read + a skip-keyword are the minimum markers.
assert.ok(
  /existsSync|\.mp4/.test(src),
  'generate-placeholder-videos.mjs: must check source-videos/ for existing user-supplied MP4s',
);
assert.ok(
  /user-supplied|user supplied|skip(?:ping)?|already exist(?:s)?|already present/i.test(src),
  'generate-placeholder-videos.mjs: must short-circuit when the user has already supplied MP4s (SKIP branch)',
);

// ─── (J) source-videos/README.md exists with both-branch instructions ─
assert.ok(
  existsSync(readmePath),
  'source-videos/README.md must exist — it is the "prompt the user first" artifact for T-VID-03',
);
const readme = readFileSync(readmePath, 'utf8');
assert.ok(
  /user-supplied|drop.*\.mp4|place.*mp4/i.test(readme),
  'source-videos/README.md: must document the user-supplied drop-in path',
);
assert.ok(
  /auto-generat|PRISM_CONFIRM_VIDEO_GENERATION|fal-ai\/wan/i.test(readme),
  'source-videos/README.md: must document the auto-generation opt-in path',
);
assert.ok(
  /\$?2\.00\b|\$?0\.50\b/.test(readme),
  'source-videos/README.md: must name the cost ($2.00 ceiling or $0.50 per clip) so the user can decide informedly',
);

// ─── (K) Runtime gate test ────────────────────────────────────────────
// Invoke the script with an empty env (no PRISM_CONFIRM_VIDEO_GENERATION,
// no FAL_KEY) and assert it exits non-zero WITHOUT printing any marker
// that would suggest a FAL request was made.
const r = spawnSync('node', [scriptPath], {
  cwd: kidKodeRoot,
  env: {
    // Intentionally minimal env — no FAL_KEY, no confirmation var.
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? '',
  },
  encoding: 'utf8',
  timeout: 15000,
});
assert.notEqual(
  r.status,
  0,
  `generate-placeholder-videos.mjs: running without PRISM_CONFIRM_VIDEO_GENERATION must exit non-zero, got status=${r.status}; stdout=${r.stdout?.slice(0, 200)}`,
);
const combined = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
assert.ok(
  /PRISM_CONFIRM_VIDEO_GENERATION|confirm|opt[-\s]?in|cost|\$2\.00/i.test(combined),
  `generate-placeholder-videos.mjs: gate-refusal output must name the env var or the cost; got:\n${combined.slice(0, 400)}`,
);
// Protect against a future refactor that imports @fal-ai/client at module
// scope AND calls fal.subscribe unconditionally: the gate-refusal run
// must not show evidence of a FAL call being attempted.
assert.ok(
  !/fal\.storage\.upload|fal\.subscribe|uploading to FAL/i.test(combined),
  `generate-placeholder-videos.mjs: gate-refusal run must NOT invoke any fal.* API; got:\n${combined.slice(0, 400)}`,
);

console.log('[T-VID-03] PASS — generate-placeholder-videos.mjs gated + source-videos/README.md present');
