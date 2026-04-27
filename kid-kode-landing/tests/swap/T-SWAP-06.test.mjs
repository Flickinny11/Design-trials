// Acceptance test for T-SWAP-06 — Patch home-hub.json: per-node transforms,
// hub.layout, strip stale fields.
// Spec ref: §-IMAGE-TO-UI (kid-kode-landing/CLAUDE.md — "Image-to-UI" +
// "Invisible-placeholder pattern" blocks).
//
// Task contract (from ralph-state.json T-SWAP-06):
//   "Update hub.layout { viewportWidth, contentHeight } to the Gemini image
//    dimensions. For each node: visual.sourceAsset = cropped/<nodeId>.png,
//    visual.x/y/width/height set from the BBOX map, remove stale Phase-F
//    state-variant regionKeys (except notifications-toggle). Nodes absent
//    from the mockup get the invisible placeholder pattern: 2×2 transparent
//    PNG at (−1,−1)."
//
// This test locks the acceptance contract in place BEFORE the home-hub.json
// mutation. It asserts the following invariants hold on the committed JSON:
//
//   1. hub.layout.viewportWidth === 2816 AND hub.layout.contentHeight === 1536
//      (AETHER mockup dimensions from notes/mockup-candidates/ai-video-mockup.png).
//   2. hub.layout.viewportHeight and hub.layout.backgroundColor preserved
//      (not clobbered to undefined/null).
//   3. Every node's visual.sourceAsset === "cropped/<nodeId>.png" — a
//      literal string with the cropped/ prefix + .png suffix, where the
//      basename matches the nodeId exactly.
//   4. Node count preserved (still 40 nodes matching the Phase-F contract).
//   5. Every BBOX-matched node (per ai-video-bbox-map.json) has
//      visual.transform.{x,y,width,height} exactly matching the BBOX entry.
//   6. Every node absent from the BBOX map has the invisible-placeholder
//      transform: x === -1, y === -1, width === 2, height === 2.
//   7. Every node retains its existing transform.z (we're only swapping
//      x/y/width/height; z-ordering stays intact).
//   8. No node except notifications-toggle has visual.regionKeys
//      (stale Phase-F state-variant regionKeys are stripped).
//   9. notifications-toggle preserves its visual.regionKeys = ['off','on']
//      AND keeps its nodeId, subtype, codeRef, backendRef.
//  10. Structural preservation: every node retains nodeId, subtype,
//      parentHubId, serviceTag, codeRef, backendRef, intent — the patch is
//      surgical to visual.{sourceAsset,transform,regionKeys}.
//
// Run with: node kid-kode-landing/tests/swap/T-SWAP-06.test.mjs

import { strict as assert } from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const kidKodeRoot = resolve(here, "..", "..");
const hubPath = resolve(
  kidKodeRoot,
  "src/lib/prism/mock-app-source/hubs/home-hub.json",
);
const bboxPath = resolve(
  kidKodeRoot,
  "notes/mockup-candidates/ai-video-bbox-map.json",
);

// ─── preconditions ──────────────────────────────────────────────────────────
assert.ok(existsSync(hubPath), `missing home-hub.json: ${hubPath}`);
assert.ok(existsSync(bboxPath), `missing ai-video-bbox-map.json: ${bboxPath}`);

const hub = JSON.parse(readFileSync(hubPath, "utf8"));
const bboxMap = JSON.parse(readFileSync(bboxPath, "utf8"));

// Snapshot of expected mockup dimensions; T-SWAP-04 pinned these.
assert.equal(
  bboxMap.mockupWidth,
  2816,
  "ai-video-bbox-map.mockupWidth must be 2816",
);
assert.equal(
  bboxMap.mockupHeight,
  1536,
  "ai-video-bbox-map.mockupHeight must be 1536",
);

// ─── 1 + 2. hub.layout ──────────────────────────────────────────────────────
assert.ok(hub.hub && hub.hub.layout, "hub.layout missing");
const layout = hub.hub.layout;
assert.equal(
  layout.viewportWidth,
  2816,
  `hub.layout.viewportWidth must be 2816 (AETHER mockup width); got ${layout.viewportWidth}`,
);
assert.equal(
  layout.contentHeight,
  1536,
  `hub.layout.contentHeight must be 1536 (AETHER mockup height); got ${layout.contentHeight}`,
);
assert.ok(
  typeof layout.viewportHeight === "number" && layout.viewportHeight > 0,
  "hub.layout.viewportHeight must be preserved (positive number)",
);
assert.ok(
  typeof layout.backgroundColor === "string" &&
    /^#[0-9a-fA-F]{6,8}$/.test(layout.backgroundColor),
  "hub.layout.backgroundColor must be preserved (hex color string)",
);

// ─── 4. Node count ──────────────────────────────────────────────────────────
assert.ok(Array.isArray(hub.nodes), "hub.nodes must be an array");
assert.equal(
  hub.nodes.length,
  40,
  `hub.nodes.length must remain 40 (Phase-F contract); got ${hub.nodes.length}`,
);

// ─── 3 + 5 + 6 + 7 + 8 + 9 + 10. Per-node invariants ────────────────────────
const bboxKeys = new Set(Object.keys(bboxMap.bboxes));

const REQUIRED_NODE_FIELDS = [
  "nodeId",
  "subtype",
  "parentHubId",
  "serviceTag",
  "visual",
  "intent",
  "codeRef",
];

let matchedCount = 0;
let placeholderCount = 0;

for (const node of hub.nodes) {
  // 10. Structural preservation.
  for (const f of REQUIRED_NODE_FIELDS) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(node, f),
      `node ${node.nodeId ?? "<unknown>"} missing required field: ${f}`,
    );
  }
  assert.ok(
    node.visual && typeof node.visual === "object",
    `node ${node.nodeId} missing visual`,
  );
  assert.ok(
    node.visual.transform,
    `node ${node.nodeId} missing visual.transform`,
  );

  const t = node.visual.transform;

  // 3. sourceAsset = "cropped/<nodeId>.png".
  const expectedAsset = `cropped/${node.nodeId}.png`;
  assert.equal(
    node.visual.sourceAsset,
    expectedAsset,
    `node ${node.nodeId}: visual.sourceAsset must be "${expectedAsset}"; got ${JSON.stringify(node.visual.sourceAsset)}`,
  );

  // 7. z preserved (present as number, non-negative).
  assert.ok(
    typeof t.z === "number" && t.z >= 0,
    `node ${node.nodeId}: transform.z must be preserved as a non-negative number; got ${t.z}`,
  );

  // 8 + 9. regionKeys handling.
  if (node.nodeId === "notifications-toggle") {
    assert.deepEqual(
      node.visual.regionKeys,
      ["off", "on"],
      `notifications-toggle: regionKeys must stay ['off','on']`,
    );
  } else {
    assert.ok(
      !("regionKeys" in node.visual),
      `node ${node.nodeId}: stale regionKeys must be stripped (only notifications-toggle retains them)`,
    );
  }

  // 5 + 6. Transform x/y/w/h from BBOX or placeholder.
  if (bboxKeys.has(node.nodeId)) {
    matchedCount++;
    const b = bboxMap.bboxes[node.nodeId];
    assert.equal(
      t.x,
      b.x,
      `node ${node.nodeId}: transform.x must be ${b.x} (BBOX); got ${t.x}`,
    );
    assert.equal(
      t.y,
      b.y,
      `node ${node.nodeId}: transform.y must be ${b.y} (BBOX); got ${t.y}`,
    );
    assert.equal(
      t.width,
      b.w,
      `node ${node.nodeId}: transform.width must be ${b.w} (BBOX); got ${t.width}`,
    );
    assert.equal(
      t.height,
      b.h,
      `node ${node.nodeId}: transform.height must be ${b.h} (BBOX); got ${t.height}`,
    );
  } else {
    placeholderCount++;
    assert.equal(
      t.x,
      -1,
      `node ${node.nodeId} (absent from mockup): transform.x must be -1; got ${t.x}`,
    );
    assert.equal(
      t.y,
      -1,
      `node ${node.nodeId} (absent from mockup): transform.y must be -1; got ${t.y}`,
    );
    assert.equal(
      t.width,
      2,
      `node ${node.nodeId} (absent from mockup): transform.width must be 2; got ${t.width}`,
    );
    assert.equal(
      t.height,
      2,
      `node ${node.nodeId} (absent from mockup): transform.height must be 2; got ${t.height}`,
    );
  }
}

// Sanity: we expect a non-trivial split — at least one BBOX match, at least
// one placeholder. If either bucket is zero the BBOX map or the graph drifted.
assert.ok(matchedCount >= 1, "expected ≥1 node mapped to a BBOX entry");
assert.ok(
  placeholderCount >= 1,
  "expected ≥1 placeholder node (absent from mockup)",
);

console.log(
  `[T-SWAP-06] OK — hub.layout ${layout.viewportWidth}x${layout.contentHeight}, ` +
    `${matchedCount} BBOX-mapped + ${placeholderCount} invisible-placeholder = ${hub.nodes.length} nodes.`,
);
