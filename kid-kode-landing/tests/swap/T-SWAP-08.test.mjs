// Acceptance test for T-SWAP-08 — Ship + live-modes-smoke 8/8 on Vercel.
// Spec ref: §10.24 — "A clean checkout + `pnpm install` + … on a fresh
// machine reproduces the working prototype." The canonical execution of
// that spec on this project is the Vercel deploy: each push to prism-main
// triggers a fresh `npm install && npm run build && next start` on Vercel
// infrastructure, serving the built artifact at the project's production
// URL. Running scripts/live-modes-smoke.mjs against that URL is the
// runtime-behaviour gate that proves the deploy reflects a working
// prototype — not just that the server boots, but that all three view
// modes (Visual Editor split, Preview, Editor) and every viewport preset
// (mobile / tablet / desktop / fit) behave as expected.
//
// Acceptance contract (exactly what this test locks):
//
//   (A) Script shape. scripts/live-modes-smoke.mjs exists and declares
//       exactly the 8 canonical check IDs that make up the §10.24 gate.
//       A rename or accidental drop of any check ID would silently
//       weaken the gate; the string-presence assertion locks that.
//
//   (B) Runtime behaviour on prod. Spawning
//       `node scripts/live-modes-smoke.mjs` against PRISM_LIVE_URL
//       (default: https://kid-kode-ai-landing.vercel.app/) must exit 0,
//       emit "8/8 passed", and show each of the 8 check IDs in a PASS
//       line. A broken deploy (blank canvas, 500 boot, viewport-preset
//       regression, splitter wired backwards) would fail this gate.
//
// The live leg takes ~30-60s (Playwright cold launch + 4 preset clicks +
// 3 mode clicks + networkidle wait against a cold Vercel function). The
// gate is NOT behind an opt-in env var: §10.24 is the shipping contract
// and Ralph's three-gate step must exercise it end-to-end. To bypass for
// offline debugging, set SKIP_LIVE_SMOKE=1 — test exits 0 after the
// (A) static gate passes.
//
// Run with: node tests/swap/T-SWAP-08.test.mjs

import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const kidKodeRoot = resolve(here, "..", "..");
const smokePath = resolve(kidKodeRoot, "scripts/live-modes-smoke.mjs");
const URL =
  process.env.PRISM_LIVE_URL || "https://kid-kode-ai-landing.vercel.app/";

// ─── (A) Script presence + required 8 check IDs declared ─────────────
assert.ok(
  existsSync(smokePath),
  `missing scripts/live-modes-smoke.mjs at ${smokePath} — T-SWAP-08 requires this runner to exist`,
);
const smokeSrc = readFileSync(smokePath, "utf8");

// The 8 canonical check IDs that make §10.24's runtime-behaviour gate.
// Order matches live-modes-smoke.mjs's execution order; assertions are
// order-independent (presence, not sequence).
const REQUIRED_CHECKS = [
  "split.both-panes",
  "preview.only",
  "preset.mobile.canvas-dims",
  "preset.tablet.canvas-dims",
  "preset.desktop.canvas-dims",
  "preset.fit.fills-pane",
  "editor.only",
  "split.restored",
];

// Five of the IDs are emitted as literal strings in the runner; the three
// preset.<name>.canvas-dims IDs are built via the template
// `preset.${p.name}.canvas-dims`, so we assert the static literals
// verbatim and assert the three dynamic names + the template form.
const STATIC_LITERAL_CHECKS = [
  "split.both-panes",
  "preview.only",
  "preset.fit.fills-pane",
  "editor.only",
  "split.restored",
];
for (const c of STATIC_LITERAL_CHECKS) {
  assert.ok(
    smokeSrc.includes(`'${c}'`),
    `live-modes-smoke.mjs must declare check id '${c}' as a literal string; a rename silently weakens the §10.24 gate`,
  );
}
for (const presetName of ["mobile", "tablet", "desktop"]) {
  assert.ok(
    smokeSrc.includes(`name: '${presetName}'`),
    `live-modes-smoke.mjs must enumerate viewport preset '${presetName}' (expected "name: '${presetName}'" in presetExpectations)`,
  );
}
assert.ok(
  smokeSrc.includes("preset.${p.name}.canvas-dims"),
  "live-modes-smoke.mjs must emit 'preset.${p.name}.canvas-dims' via template to build mobile/tablet/desktop check IDs",
);
// Runner must actually drive Playwright against the production URL.
assert.ok(
  smokeSrc.includes("PRISM_LIVE_URL"),
  "live-modes-smoke.mjs must read PRISM_LIVE_URL so the prod URL is overridable",
);
assert.ok(
  /await\s+import\s*\(\s*['"]playwright['"]\s*\)/.test(smokeSrc),
  "live-modes-smoke.mjs must import playwright (runtime browser driver)",
);

// ─── (B) Runtime behaviour: live-modes-smoke against production ──────
if (process.env.SKIP_LIVE_SMOKE === "1") {
  console.log(
    "[T-SWAP-08] SKIP_LIVE_SMOKE=1 — (A) static gate passed; skipping (B) live network run.",
  );
  process.exit(0);
}

console.log(
  `[T-SWAP-08] running live-modes-smoke against ${URL} (this takes ~30-60s)…`,
);
const r = spawnSync("node", ["scripts/live-modes-smoke.mjs"], {
  cwd: kidKodeRoot,
  stdio: ["ignore", "pipe", "pipe"],
  encoding: "utf8",
  env: { ...process.env, PRISM_LIVE_URL: URL },
  timeout: 240_000,
});

// Strip ANSI colour codes so assertions don't depend on terminal escape
// sequences (live-modes-smoke uses \x1b[32m / \x1b[31m).
const stripAnsi = (s) => (s || "").replace(/\x1b\[[0-9;]*m/g, "");
const stdout = stripAnsi(r.stdout);
const stderr = stripAnsi(r.stderr);

if (r.error) {
  assert.fail(`live-modes-smoke spawn error: ${r.error.message}`);
}

assert.equal(
  r.status,
  0,
  `live-modes-smoke exited with status=${r.status}\n  stderr tail: ${stderr.slice(-500)}\n  stdout tail: ${stdout.slice(-500)}`,
);

assert.match(
  stdout,
  /\b8\/8 passed\b/,
  `expected '8/8 passed' summary in live-modes-smoke output; got tail:\n${stdout.slice(-800)}`,
);

for (const c of REQUIRED_CHECKS) {
  const escaped = c.replace(/\./g, "\\.");
  assert.match(
    stdout,
    new RegExp(`\\[PASS\\]\\s+${escaped}\\b`),
    `check '${c}' did not PASS in live-modes-smoke output against ${URL}; tail:\n${stdout.slice(-800)}`,
  );
}

console.log(`[T-SWAP-08] §10.24 OK — live ${URL} passes all 8 checks.`);
