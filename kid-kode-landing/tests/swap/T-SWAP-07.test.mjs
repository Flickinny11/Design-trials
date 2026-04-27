// Acceptance test for T-SWAP-07 — Rebuild .prism + three-gate verify.
// Spec refs: §1.4 (forbidden patterns — verified by verify-prism.mjs itself)
//          + §10.19 (.prism file extractable with any zip tool, contents match §3.1).
//
// Task contract (from ralph-state.json T-SWAP-07):
//   "npm run build:prism → npm run verify:prism (15/15) →
//    node scripts/browser-smoke.mjs (6/6). Fix any drift before proceeding.
//    artifactHash must be reproducible across two consecutive builds."
//
// This test locks the three post-build invariants that T-SWAP-07 owns:
//
//   A. §3.1 / §10.19 — Artifact layout.
//      The committed public/prism-assets/mock-app.prism MUST be a valid zip
//      readable by any zip tool, containing (at minimum):
//        manifest.json, graph.json,
//        assets/atlas-0.avif, assets/atlas-regions.json,
//        assets/font-inter.msdf.fnt, assets/font-inter.msdf.png,
//        assets/font-inter.msdf.json,
//        meta/version.txt, meta/generator.json,
//        nodes/<codeRef> for every graph node,
//        backends/<backendRef> for every node that declares one.
//      manifest.artifactHash must be 64 hex chars and recompute from
//      entries[] in sorted order.
//
//   B. Zero-orphans — every home-hub.json node's visual.sourceAsset must
//      resolve to a key in atlas-regions.json. A mockup-swap that patches
//      home-hub.json without rebuilding the atlas is the exact drift this
//      task exists to catch; forty orphaned references is the failing
//      state going into T-SWAP-07.
//
//   C. Reproducibility — two consecutive invocations of `npm run build:prism`
//      MUST produce the same artifactHash. The prior (Phase-F) checkpoint
//      hash is recorded in ralph-state.invariants.lastArtifactHash and is
//      expected to change as T-SWAP-07 lands; what the test locks is that
//      whatever new hash we converge on is stable across re-runs.
//
// Determinism check (C) spawns two `npm run build:prism` runs synchronously.
// Each run is ~8-15s (sharp AVIF encode + MSDF emit + zip deflate-9). The
// combined test typically runs in ~25-35s and is gated behind the
// VERIFY_BUILD_REPRODUCIBILITY env var so CI can opt out. Locally Ralph
// always sets it.
//
// Run with: VERIFY_BUILD_REPRODUCIBILITY=1 node tests/swap/T-SWAP-07.test.mjs

import { strict as assert } from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";
import { createHash } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const kidKodeRoot = resolve(here, "..", "..");
const prismPath = resolve(kidKodeRoot, "public/prism-assets/mock-app.prism");
const regionsPath = resolve(
  kidKodeRoot,
  "public/prism-assets/atlas-regions.json",
);
const hubPath = resolve(
  kidKodeRoot,
  "src/lib/prism/mock-app-source/hubs/home-hub.json",
);

assert.ok(
  existsSync(prismPath),
  `missing mock-app.prism: ${prismPath} — run \`npm run build:prism\``,
);
assert.ok(
  existsSync(regionsPath),
  `missing atlas-regions.json: ${regionsPath}`,
);
assert.ok(existsSync(hubPath), `missing home-hub.json: ${hubPath}`);

const prismBuf = readFileSync(prismPath);
const zip = await JSZip.loadAsync(prismBuf);

// ─── (A1) §3.1 required top-level entries ───────────────────────────────────
const REQUIRED_ENTRIES = [
  "manifest.json",
  "graph.json",
  "assets/atlas-0.avif",
  "assets/atlas-regions.json",
  "assets/font-inter.msdf.fnt",
  "assets/font-inter.msdf.png",
  "assets/font-inter.msdf.json",
  "meta/version.txt",
  "meta/generator.json",
];
for (const e of REQUIRED_ENTRIES) {
  assert.ok(zip.file(e), `§3.1 required entry missing from .prism: ${e}`);
}

const manifest = JSON.parse(await zip.file("manifest.json").async("string"));
const graph = JSON.parse(await zip.file("graph.json").async("string"));

// ─── (A2) manifest structure ─────────────────────────────────────────────────
assert.equal(
  manifest.prismVersion,
  "0.1.0",
  `prismVersion must be 0.1.0, got ${manifest.prismVersion}`,
);
assert.equal(
  manifest.entryHub,
  "home-hub",
  `entryHub must be 'home-hub', got ${manifest.entryHub}`,
);
assert.ok(Array.isArray(manifest.entries), "manifest.entries must be an array");
assert.ok(manifest.entries.length > 0, "manifest.entries must be non-empty");
assert.ok(
  manifest.nodeCount >= 30,
  `§10.18 realistic home hub: nodeCount ≥ 30, got ${manifest.nodeCount}`,
);

// ─── (A3) artifactHash format + internal consistency ────────────────────────
assert.ok(
  /^[a-f0-9]{64}$/.test(manifest.artifactHash),
  `artifactHash must be 64 hex chars, got ${manifest.artifactHash}`,
);
const sortedEntries = [...manifest.entries].sort((a, b) =>
  a.path.localeCompare(b.path),
);
const rollup = createHash("sha256")
  .update(sortedEntries.map((e) => `${e.path}:${e.sha256}`).join("\n"))
  .digest("hex");
assert.equal(
  rollup,
  manifest.artifactHash,
  `artifactHash self-consistency: recomputed ${rollup} !== manifest ${manifest.artifactHash}`,
);

// ─── (A4) per-node module + backend presence ────────────────────────────────
for (const n of graph.nodes) {
  const codeFile = n.codeRef?.replace(/^nodes\//, "");
  assert.ok(codeFile, `node ${n.nodeId}: missing codeRef`);
  assert.ok(
    zip.file(`nodes/${codeFile}`),
    `node ${n.nodeId}: missing module nodes/${codeFile}`,
  );
  if (n.backendRef) {
    const beFile = n.backendRef.replace(/^backends\//, "");
    assert.ok(
      zip.file(`backends/${beFile}`),
      `node ${n.nodeId}: missing backend backends/${beFile}`,
    );
  }
}

// ─── (B) Zero-orphans: every sourceAsset resolves to an atlas region ────────
const hub = JSON.parse(readFileSync(hubPath, "utf8"));
const regionsWrapper = JSON.parse(readFileSync(regionsPath, "utf8"));
const regionKeys = new Set(Object.keys(regionsWrapper.regions));
const orphans = [];
for (const n of hub.nodes) {
  const asset = n.visual?.sourceAsset ?? n.nodeId;
  if (!regionKeys.has(asset)) {
    orphans.push(`${n.nodeId} → ${asset}`);
  }
}
assert.equal(
  orphans.length,
  0,
  `[zero-orphans] ${orphans.length}/${hub.nodes.length} home-hub.json nodes reference a sourceAsset not present in atlas-regions.json.\n` +
    `  first 5: ${orphans.slice(0, 5).join(", ")}\n` +
    `  atlas-regions.json has ${regionKeys.size} region keys. Fix: extend build-atlas.mjs to pack the cropped/ PNGs\n` +
    `  (assetKey = "cropped/<basename>.png") OR synthesize the missing per-node crops via scripts/extract-video.mjs.`,
);

// ─── (C) Reproducibility — two consecutive builds produce identical hash ────
// Gated: set VERIFY_BUILD_REPRODUCIBILITY=1 to enable. Ralph always does.
if (process.env.VERIFY_BUILD_REPRODUCIBILITY === "1") {
  console.log(
    "[T-SWAP-07] running two consecutive `npm run build:prism` invocations for determinism check…",
  );
  const baseline = manifest.artifactHash;

  for (let i = 1; i <= 2; i++) {
    const r = spawnSync("npm", ["run", "build:prism"], {
      cwd: kidKodeRoot,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      env: { ...process.env, CI: "1" },
    });
    assert.equal(
      r.status,
      0,
      `[reproducibility] build #${i} exited with status=${r.status}\n  stderr: ${r.stderr?.slice(-400)}`,
    );
    const reBuf = readFileSync(prismPath);
    const reZip = await JSZip.loadAsync(reBuf);
    const reManifest = JSON.parse(
      await reZip.file("manifest.json").async("string"),
    );
    assert.equal(
      reManifest.artifactHash,
      baseline,
      `[reproducibility] build #${i} produced hash ${reManifest.artifactHash} !== baseline ${baseline}.\n` +
        `  Any field that varies between builds (timestamps, randomized ordering, non-stable hashing)\n` +
        `  will trip this assertion. build-prism.mjs records createdAt from generatorMeta.builtAt —\n` +
        `  manifest.createdAt is IN manifest.entries, so any new timestamp shifts the rollup.`,
    );
  }
  console.log(`[T-SWAP-07] determinism OK — artifactHash stable: ${baseline}`);
}

// ─── summary ─────────────────────────────────────────────────────────────────
console.log(
  `[T-SWAP-07] §3.1 layout + zero-orphans + self-consistent rollup OK.`,
);
console.log(
  `  .prism entries: ${Object.keys(zip.files).filter((k) => !zip.files[k].dir).length}`,
);
console.log(`  atlas regions: ${regionKeys.size}`);
console.log(
  `  home-hub nodes: ${hub.nodes.length} (all resolve to atlas regions)`,
);
console.log(`  artifactHash: ${manifest.artifactHash}`);
