// Acceptance test for T-VID-01 — Mark the 4 video-slot nodes with
// intent.behaviorSpec.interactions[playback].
//
// Spec ref: §-SPEC-ENRICH (Phase-G enrichment — the classifier note
// that T-VID-02 adds to prism-spec-extract.md describes the hook; this
// test locks the shape the runtime will read). The mockup's hero
// section contains a 4-tile video strip (video-slot-1..4). Without an
// explicit hook on these nodes, the runtime cannot tell a playable
// video region from a static image crop — both present as a sprite
// over the same page-background, so the only signal is the graph.
//
// Acceptance contract (exactly what this test locks):
//
//   (A) Node presence. home-hub.json declares exactly 4 nodes with
//       nodeId ∈ {video-slot-1, video-slot-2, video-slot-3, video-slot-4}.
//       These are separate nodes from the sibling *-label nodes that
//       carry baked caption crops — the label nodes are NOT required
//       by T-VID-01 (they are decoration, not interactive).
//
//   (B) Interaction shape. For each of the 4 nodes, exactly one entry
//       in intent.behaviorSpec.interactions with the fields:
//         - trigger === 'pointertap'
//         - effect  === 'playVideo'
//         - src     string ending in '.mp4' that references the nodeId
//       A missing entry, a second entry, a renamed field, or a `.mp4`
//       path that doesn't correspond to the node's own nodeId would
//       silently desync the runtime trigger from the visible tile.
//
//   (C) Shape consistency. Each interaction entry is a plain object with
//       exactly those three keys. Extra fields are allowed for future
//       enrichment (e.g. poster, autoplay); forbidden fields today are
//       none — but the trio above is mandatory.
//
// The test is schema-first: it reads the committed JSON and asserts
// shape. No runtime is spawned. If any of the 4 video-slot nodes is
// missing from home-hub.json, the test fails immediately in (A).
//
// Run with: node tests/vid/T-VID-01.test.mjs

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const kidKodeRoot = resolve(here, '..', '..');
const hubPath = resolve(kidKodeRoot, 'src/lib/prism/mock-app-source/hubs/home-hub.json');

const hub = JSON.parse(readFileSync(hubPath, 'utf8'));
assert.ok(Array.isArray(hub.nodes), `home-hub.json: nodes[] must exist (got ${typeof hub.nodes})`);

const REQUIRED_VIDEO_NODE_IDS = [
  'video-slot-1',
  'video-slot-2',
  'video-slot-3',
  'video-slot-4',
];

// ─── (A) Node presence ────────────────────────────────────────────────
const nodesById = new Map(hub.nodes.map((n) => [n.nodeId, n]));
for (const id of REQUIRED_VIDEO_NODE_IDS) {
  assert.ok(
    nodesById.has(id),
    `home-hub.json: node "${id}" missing — T-VID-01 requires all 4 video-slot nodes`,
  );
}

// ─── (B, C) Interaction shape on each video-slot node ─────────────────
for (const id of REQUIRED_VIDEO_NODE_IDS) {
  const n = nodesById.get(id);
  const interactions = n?.intent?.behaviorSpec?.interactions;
  assert.ok(
    Array.isArray(interactions),
    `${id}: intent.behaviorSpec.interactions must be an array (got ${typeof interactions})`,
  );
  assert.equal(
    interactions.length,
    1,
    `${id}: intent.behaviorSpec.interactions must have exactly 1 entry (got ${interactions.length}) — T-VID-01 contracts a single playback hook`,
  );
  const [entry] = interactions;
  assert.ok(
    entry && typeof entry === 'object' && !Array.isArray(entry),
    `${id}: interaction[0] must be a plain object (got ${Array.isArray(entry) ? 'array' : typeof entry})`,
  );
  assert.equal(
    entry.trigger,
    'pointertap',
    `${id}: interaction[0].trigger must be 'pointertap' (got ${JSON.stringify(entry.trigger)})`,
  );
  assert.equal(
    entry.effect,
    'playVideo',
    `${id}: interaction[0].effect must be 'playVideo' (got ${JSON.stringify(entry.effect)})`,
  );
  assert.equal(
    typeof entry.src,
    'string',
    `${id}: interaction[0].src must be a string (got ${typeof entry.src})`,
  );
  assert.ok(
    entry.src.endsWith('.mp4'),
    `${id}: interaction[0].src must end with '.mp4' (got ${JSON.stringify(entry.src)})`,
  );
  assert.ok(
    entry.src.includes(id),
    `${id}: interaction[0].src must reference its own nodeId (got ${JSON.stringify(entry.src)}) — a shared src would silently desync the trigger from the visible tile`,
  );
}

console.log(`[T-VID-01] PASS — 4 video-slot nodes each carry { trigger: 'pointertap', effect: 'playVideo', src: '*.mp4' } playback hook`);
