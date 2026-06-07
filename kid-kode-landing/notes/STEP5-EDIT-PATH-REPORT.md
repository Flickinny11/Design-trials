# STEP 5 — Edit Path (edit → save → build → VERIFY → preview) — REPORT

**Model:** claude-opus-4-8 · **Branch:** `prism-editor-build` (no commit; working-tree changes left for review)
**Date:** 2026-06-07 · **Scope:** the edit path ONLY (the four items below). Out-of-scope items deferred.

**Ground truth:** `PRISM-INTENT-ANCHOR.md` §4 (caching/build) + §8 (edit→save→build→verify + caption-driven
repair); `docs/prism/PRISM-NODE-EDITOR-SPEC.md` §9 + NE-SC-11/13; `docs/prism/PRISM-CANVAS-EDITOR-SPEC.md`
§6 lifecycle (Built→Dirty) + §11 cache; `docs/prism/PRISM-RUNTIME-SPEC.md` §5.3 (surgical rebuild), §7
(builtSnapshot cache), RT-SC-08/09.

**Before this slice:** the edit/save/rebuild path "did nothing in practice" — there was no per-node dirty
state, no content-hash builtSnapshot cache, no in-path verification, and no repair. A `Save & Rebuild`
button existed but it unconditionally evicted + remounted with no hash gate, no verify, and no recovery.

---

## How this was verified (the Step-3 protocol, adapted)

KripVerify and the Chrome-DevTools MCP named in the prompt are **not connected to this session**
(`claude mcp list` shows none). Per the canonical-3 two-layer rule I substituted an equivalent
**evidence-based two-layer** verification driving the **real editor** (Next.js dev server on `:3000`,
WebGL2/WebGPU scene) in **real Chrome via Playwright**:

- **Functional layer** — store assertions + the `window.__prismBuiltSnapshots()` / `__prismBuiltSnapshotHistory()`
  bridges + `window.__artifactBuildCount` + DOM badge attributes, driven through the app's existing
  `window.__PRISM_DEBUG_STORES__` handle and the **real** Inspector `Save` / `Save & Rebuild` buttons.
- **Vision layer** — before/after screenshots of the actual rendered scene, judged for the visible change.

Harness: `scripts/verify-step5-edit-path.mjs` → **11/11 checks pass**. Raw evidence:
`notes/verification/step5/step5-verify-report.json`. Screenshots: `notes/verification/step5/*.png`.
Unit: `EBR2-E-04` (21) + `HL10` (11) = **32/32 pass**; `tsc` clean on all touched files (the only `tsc`
errors are pre-existing — `GraphScene.tsx` `GLProps` + test-file `NodeContext.THREE` — untouched here).

> Dev-environment note: the shell had `NODE_ENV=production`, which breaks `next dev` (PostCSS/Tailwind
> won't compile `globals.css` → HTTP 500). The dev server was restarted with `NODE_ENV=development`. No
> app code was involved.

**Fresh-context reviewer verdict (`prism-criteria-reviewer`, sees only diff + criteria): APPROVE — no
remaining MUST-FIX.** (First pass returned 2 MUST-FIX + 2 nits; all resolved, see "Review trail" below.)

---

## Scope item 1 — EDIT REGISTERS + per-node dirty

**Criterion — NE-SC-11 (+ canvas §6 Built→Dirty):** a purpose/visual edit records the change to the node
and marks it `dirty`; built-state must be rebuilt before it reflects the edit.

**Files changed**
- `src/lib/prism-graph/types.ts` — added optional `dirty?: boolean` to `PrismNode` (additive, INV-18/INV-NE-1).
- `src/stores/useGraphSourceStore.ts` — new `markNodeDirty(nodeId, dirty)` action (pure-local build flag);
  `saveToServer` strips `dirty` from the persisted payload so a node never boots dirty on reload.
- `src/lib/editor/preview-commit.ts` — committing an edit to source now marks the node dirty.
- `src/lib/editor/rebuild-node.ts` — a successful rebuild clears the node's dirty flag (Dirty→Built).
- `src/components/editor/panels/Inspector.tsx` — a `data-role="build-state"` badge surfaces
  dirty / built / repaired / failed.

**Evidence**
- Before: `notes/verification/step5/01-feature-before.png` — feature-card badge = **Built**.
- After editing + clicking the real **Save** button: `02-feature-dirty.png` — badge = **Dirty — rebuild**;
  `node.dirty === true` (assertion `edit.registers.dirty` → PASS).
- After **Save & Rebuild**: `node.dirty === false`, badge = **Built** (`rebuild.clears.dirty` → PASS).
- `dirty` does not persist to disk: post-save `live-graph.json` contains **zero** `"dirty"` keys.

**Reviewer:** additive schema confirmed; no topology/dep mutation; no node-editor visual mode (FP-NE-1 clean).

---

## Scope item 2 — SAVE & REBUILD (surgical, content-hash builtSnapshot)

**Criterion — RT-SC-09 / INV-R8 + canvas §11:** Save-and-Rebuild rebuilds ONLY that node and refreshes
ONLY that node's `builtSnapshot`; the snapshot is content-hash keyed; rebuild happens **iff** the hash
changes; siblings' `THREE.Object3D` refs stay stable. Toggling modes serves cache → zero rebuilds (RT-SC-08).

**Files changed**
- `src/lib/editor/node-content-hash.ts` (new) — deterministic FNV-1a `computeNodeContentHash(node)` over
  the build-relevant projection (renderMode, codeRef, meshUrl, sourceAsset, plane size, textContent,
  caption, transforms, primitives, keyframes…).
- `src/stores/useBuiltSnapshotStore.ts` (new) — per-node `builtSnapshot` registry **plus an append-only
  `history`** (INV-R7 "superseded snapshots persist"), + the `window.__prismBuiltSnapshots()` /
  `__prismBuiltSnapshotHistory()` bridges.
- `src/components/editor/graph/ArtifactNode.tsx` — the artifact cache is now keyed by content hash
  (`{ object, hash }`): a hash hit reuses the Object3D (no `createNode`), a mismatch disposes + rebuilds.
  The factory records the node's builtSnapshot on every actual build.
- `src/lib/editor/rebuild-node.ts` — gates the rebuild on the hash: if the committed node's hash equals its
  current snapshot's hash, it returns `{ rebuilt: false }` with no evict/remount (INV-R7 "iff").

**Evidence (`rebuild.surgical` + `snapshot.append-only` → PASS)**
- Only the edited node changed: `changedNodes = ["home-feature-card"]`; all **11** sibling nodes' snapshot
  hashes **and** build counts byte-identical before/after (`siblingsUntouched = true`).
- The edited node's content hash changed `94d4b23e → 20fb8cb5` and its `buildCount` incremented by exactly 1.
- Append-only history retained the prior snapshot: feature-card history has **2** entries with **distinct**
  hashes (`["94d4b23e","20fb8cb5"]`) after one rebuild — prior built state recoverable.
- Toggling `canvas ↔ preview-app` issued **Δ`__artifactBuildCount` = 0** (`toggle.no-rebuild` → PASS) —
  cache served, no rebuild on mode switch (RT-SC-08 / FP-R4).

**Reviewer:** the cache is now a genuine content-hash cache and the rebuild is hash-gated at both the cache
layer and the orchestrator; surgical remount intact (one keyed node remounts, siblings stable — FP-R7 clean).

---

## Scope item 3 — VERIFY-IN-PATH + caption-driven repair

**Criterion — NE-SC-13 (+ anchor §8, RT-SC-06/07):** the rebuild verifies the artifact actually built and
renders; on failure it must NOT surface a broken/previous state — it dispatches a caption-driven cold-context
repair (reads node + hub captions + contents → fix → re-verify). Demonstrate detect → flag → repair → re-verify.

**Files changed**
- `src/lib/editor/verify-built-node.ts` (new) — structural verify of a freshly-built `Object3D`: rejects the
  tagged `:fallback` empty-Group stand-in (FP-R3) and inline-geometry modes that produced no renderable child.
- `src/lib/editor/caption-repair.ts` (new) — cold-context repair: reads ONLY `node.intent.caption`,
  `hub.caption`, and the node's stored contents, and produces a repaired, renderable node config (drops a
  broken codeRef → falls back to the node's image/mesh, or synthesizes an MSDF text artifact from the caption).
  The small internal AI model itself is future-source (anchor §0); this builds the **repair loop** + its
  cold-context input contract, with a deterministic caption-reading strategy standing in for the model call.
- `src/components/editor/graph/ArtifactNode.tsx` — wires verify → (on failure) repair → re-verify into the
  build, records `status: built | repaired | failed` into the snapshot.

**Evidence (`repair.detect-and-recover` + `repair.console-evidence` → PASS)**
- A node was deliberately broken (`home-cta-hero` → `renderMode: 'mesh'`, no mesh, cleared codeRef → empty
  build). Before: `05-cta-before.png` (the watch mesh present).
- The verify-in-path **detected** the empty build (`reason: 'empty-group'`) and the caption-driven repair
  **recovered** it: snapshot `status: 'repaired'`, `repairStrategy: "empty build repaired by synthesizing an
  MSDF text artifact (\"3D mesh CTA hero\") from the node caption"`. After: `06-cta-repaired.png` — the node
  shows a recovered artifact, **not** a broken/empty hole, and **no error banner**.
- Console proof the repair fired with caption input:
  `[ArtifactNode] caption-driven repair recovered home-cta-hero (was 'empty-group'): empty build repaired by
  synthesizing an MSDF text artifact ("3D mesh CTA hero") from the node caption`.
- Independent second defense observed: when the broken node was pushed through the **real Save & Rebuild
  button**, the server's persist validator additionally **rejected** the invalid node (`ok=false`, nothing
  written to disk) — so a broken edit reaches neither the preview (repaired in-render) nor durable storage.

**Documented limitation (reviewer-accepted, not a MUST-FIX):** the in-process structural verify cannot
confirm that an *async* GLB/codeRef graft ultimately resolves (it tolerates async-pending modes); the
vision-layer `/prism-verify` pass is the backstop for what the scene-graph check can't see.

---

## Scope item 4 — CHANGE IS VISIBLE in canvas AND preview-app, only that node

**Criterion:** after Save-and-Rebuild the updated artifact replaces the old one in canvas AND preview-app
from the refreshed cache; editing one node must NOT rebuild/alter any other node.

**Why this is real (not live-reactive):** the observable property edited — the feature-card's plane size
(`visual.transform.width/height`) — is **baked into `PlaneGeometry` at `createNode` time** and is *not* a
React memo dep of `ArtifactNode`, so it is invisible until the explicit evict + remount. (Live-reactive
fields like `scenePosition` were deliberately avoided so the screenshot proves the *rebuild*, not a reactive
transform.)

**Evidence**
- Canvas before → after: `01-feature-before.png` → `03-feature-after-canvas.png` — the feature card grows
  ~2.5× while the parallax stack, watch mesh, and orbs are unchanged in size/position (visible isolation).
- Preview-app after: `04-feature-after-preview-app.png` — the same enlarged artifact is served from the
  refreshed cache in preview-app, with editing chrome (inspector, selection rings, frame) hidden.
- Isolation assertion (same as item 2): `changedNodes = ["home-feature-card"]`, all siblings byte-stable.

**Reviewer:** single edit→save→build→verify→preview path (no second/parallel path — FP-NE-5 clean); one scene
serves canvas and preview-app states.

---

## Review trail

- **Pass 1 — changes-required:** (#1) content hash was *recorded* but did not *gate* the rebuild (INV-R7
  "iff"); (#2) snapshots were last-write-wins, not append-only. Nits: `dirty` leaked to disk + `markNodeDirty`
  drove the durable autosave.
- **Fixes:** hash now gates the rebuild at both the cache layer (`ArtifactNode`) and the orchestrator
  (`rebuild-node`); `useBuiltSnapshotStore` keeps an append-only `history`; `markNodeDirty` is pure-local;
  `saveToServer` strips `dirty`.
- **Pass 2 — APPROVE, no remaining MUST-FIX.** The append-only history assertion (two distinct retained
  hashes after one rebuild) directly corroborates the INV-R7 fix.

## Files changed (tracked source slice)

Modified: `src/lib/prism-graph/types.ts`, `src/stores/useGraphSourceStore.ts`,
`src/lib/editor/preview-commit.ts`, `src/lib/editor/rebuild-node.ts`,
`src/components/editor/graph/ArtifactNode.tsx`, `src/components/editor/panels/Inspector.tsx`.
New: `src/lib/editor/node-content-hash.ts`, `src/lib/editor/verify-built-node.ts`,
`src/lib/editor/caption-repair.ts`, `src/stores/useBuiltSnapshotStore.ts`.
Verification harness (not app runtime): `scripts/verify-step5-edit-path.mjs`.

---

## Plain-language summary (for a non-coder)

The app is built from **nodes** — each node is one piece of the app (a card, a 3D watch, a decoration). Before
this work, editing a node and clicking "Save & Rebuild" didn't actually do anything reliable. Now the full
loop works, and you can see it in the pictures in `notes/verification/step5/`:

1. **Your edit is registered.** When you change a node and Save, the app marks that node **"Dirty — rebuild"**
   (an orange tag), meaning "you changed me, but my picture is still the old one." See `02-feature-dirty.png`.

2. **Save & Rebuild rebuilds just that one node.** Compare `01-feature-before.png` (the glass card on the
   right is small) with `03-feature-after-canvas.png` (the same card is now ~2.5× bigger). **Nothing else
   moved or changed** — the watch, the layered panels, and the glowing orbs are exactly as they were. The app
   rebuilt only the card you edited, and only because you actually changed it.

3. **The app checks its own work and fixes breakage.** We deliberately broke a node (told the watch to be a
   3D model but gave it no model). Instead of showing a broken empty hole, the app **noticed** the build
   failed, **read the node's written description** ("3D mesh CTA hero…"), and **rebuilt a working stand-in**
   from that description — then confirmed it renders. Compare `05-cta-before.png` (watch present) with
   `06-cta-repaired.png` (recovered, no error). You never see the broken state.

4. **The change shows up everywhere, instantly.** The bigger card appears both in the editing view (Canvas)
   and in the running app view (Preview App) — see `04-feature-after-preview-app.png` — because both views
   read the same freshly-rebuilt picture from a cache. Switching between views is instant and never rebuilds
   anything.

Everything above was checked automatically against the spec's numbered requirements (11 of 11 passed) and
signed off by an independent reviewer that only saw the code changes and the requirements.
