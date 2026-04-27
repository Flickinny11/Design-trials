#!/usr/bin/env node
// Phase G / T-SWAP-06 — patch home-hub.json for the AETHER mockup swap.
//
// Surgical mutations (spec ref §-IMAGE-TO-UI; task contract in
// notes/ralph-state.json task T-SWAP-06):
//
//   1. hub.layout.viewportWidth  ← bboxMap.mockupWidth  (2816)
//   2. hub.layout.contentHeight  ← bboxMap.mockupHeight (1536)
//      (viewportHeight + backgroundColor preserved.)
//
//   3. For each node:
//        visual.sourceAsset = `cropped/${nodeId}.png`
//
//      If nodeId ∈ bboxMap.bboxes:
//        visual.transform.{x,y,width,height} ← the BBOX entry.
//      Else (node absent from the mockup):
//        visual.transform.{x,y,width,height} = { -1, -1, 2, 2 }
//        (the invisible-placeholder pattern — see CLAUDE.md
//        "Invisible-placeholder pattern" block).
//
//      transform.z is always preserved; z-ordering is orthogonal to
//      the coordinate swap.
//
//   4. visual.regionKeys is stripped from every node EXCEPT
//      notifications-toggle (the sole Phase-F state-variant that keeps
//      structural on/off regions per CLAUDE.md "State effects" block).
//
// All other fields — nodeId, subtype, parentHubId, serviceTag, intent,
// codeRef, backendRef, visual.shape, visual.overlayRegions,
// visual.frameCount, visual.defaultRegion, etc. — are left untouched.
// Those are addressed in later iterations (see ralph-state.json task
// notes for T-SWAP-06 SHOULD-FIX entries).
//
// Deterministic output: 2-space indent, LF, trailing newline — matches
// the existing home-hub.json byte-exact on unchanged content.
//
// Usage:
//   node scripts/patch-home-hub-for-mockup.mjs
//
// Env-var overrides (for the T-SWAP-06 acceptance test):
//   HOME_HUB_JSON   path to the home-hub.json file to patch (default:
//                   src/lib/prism/mock-app-source/hubs/home-hub.json)
//   BBOX_JSON       path to the bbox-map JSON (default:
//                   notes/mockup-candidates/ai-video-bbox-map.json)
//
// This script is deliberately idempotent: running it twice against the
// same inputs yields the same file contents, so it is safe to invoke
// from the acceptance test harness.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const hubPath =
  process.env.HOME_HUB_JSON ??
  resolve(repoRoot, "src/lib/prism/mock-app-source/hubs/home-hub.json");
const bboxPath =
  process.env.BBOX_JSON ??
  resolve(repoRoot, "notes/mockup-candidates/ai-video-bbox-map.json");

const hub = JSON.parse(readFileSync(hubPath, "utf8"));
const bboxMap = JSON.parse(readFileSync(bboxPath, "utf8"));

// Guard against a drifted BBOX map.
if (
  typeof bboxMap.mockupWidth !== "number" ||
  typeof bboxMap.mockupHeight !== "number"
) {
  throw new Error(`bbox-map is missing mockupWidth/mockupHeight: ${bboxPath}`);
}
if (!bboxMap.bboxes || typeof bboxMap.bboxes !== "object") {
  throw new Error(`bbox-map.bboxes missing or non-object: ${bboxPath}`);
}

// ─── hub.layout ─────────────────────────────────────────────────────────────
hub.hub.layout.viewportWidth = bboxMap.mockupWidth;
hub.hub.layout.contentHeight = bboxMap.mockupHeight;

// ─── per-node mutation ──────────────────────────────────────────────────────
const PLACEHOLDER = { x: -1, y: -1, width: 2, height: 2 };

let matched = 0;
let placeholder = 0;
let regionKeysStripped = 0;

for (const node of hub.nodes) {
  const { nodeId, visual } = node;
  if (!visual) throw new Error(`node ${nodeId}: missing visual`);
  if (!visual.transform)
    throw new Error(`node ${nodeId}: missing visual.transform`);

  // 3. sourceAsset swap — always cropped/<nodeId>.png.
  visual.sourceAsset = `cropped/${nodeId}.png`;

  // 3/6. transform x/y/width/height — preserve z.
  const zPreserved = visual.transform.z;
  const bbox = bboxMap.bboxes[nodeId];
  if (bbox) {
    matched++;
    visual.transform = {
      x: bbox.x,
      y: bbox.y,
      width: bbox.w,
      height: bbox.h,
      z: zPreserved,
    };
  } else {
    placeholder++;
    visual.transform = { ...PLACEHOLDER, z: zPreserved };
  }

  // 4. Strip stale regionKeys except notifications-toggle.
  if (nodeId !== "notifications-toggle" && "regionKeys" in visual) {
    delete visual.regionKeys;
    regionKeysStripped++;
  }
}

// ─── write back ─────────────────────────────────────────────────────────────
const out = JSON.stringify(hub, null, 2) + "\n";
writeFileSync(hubPath, out);

console.log(
  `[patch-home-hub] hub.layout ${hub.hub.layout.viewportWidth}x${hub.hub.layout.contentHeight}, ` +
    `${matched} BBOX-mapped + ${placeholder} invisible-placeholder = ${hub.nodes.length} nodes, ` +
    `${regionKeysStripped} stale regionKeys stripped.`,
);
