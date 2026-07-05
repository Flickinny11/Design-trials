# PRISM FIX 1 — REPORT (S3d node-authorship gate + G5 orphan nodes)

**Date:** 2026-06-22 · **Branch:** `prism-editor-build` · **Model:** claude-opus-4-8 · **Mode:** ULTRACODE
**Commits:** `ef865afa` (wave1 S3d) · `9e025d5e` (wave2 G5) · `<wave3>` (this report)
**Scope done:** the first two items of `AUDIT-REMEDIATION-PLAN.md` — **S3d** (verification upgrade) + **G5** (7 orphan nodes). The 3 hardcoded signature artifacts (watch/orrery/transition = G1/G2/G3) were **NOT touched** — separate NEEDS-GREENLIGHT sessions.

---

## HEADLINE

The drift the foundation audit caught happened because verification asserted that an **object of a given name** existed in the scene — not that a **graph node authored it**. This session built the gate that closes that hole (S3d) and fixed the 7 orphan nodes that rendered nothing/wrong (G5). Both reviewers signed off **PASS, 0 MUST-FIX**. Cold load is clean (1 canvas, 0 console errors, 0 `_next` 404s). tsc green (0 new).

---

## WAVE 1 — S3d: what the node-authorship gate does + its current flags

**The mechanism (PRISM-MASTER-SPEC §B Law 0 verification corollary).** A success criterion for a rendered artifact now passes only when the artifact was **authored by a node** — the mounted `Object3D` carries an authoring nodeId that exists in the graph — not merely when an object of that name is present.

- **`src/lib/prism/runtime/node-authorship.ts`** — pure, **DOM-free** `computeSceneAuthorship(scene, nodeGroups, camera)` (FP-05/INV-15: no `window`/`document` in `runtime/`). Classifies every content artifact as **node-authored** (carries `userData.prismNodeId`/`nodeId`, or is a value in the `__PRISM_EDITOR_NODE_GROUPS__` registry keyed by nodeId) or **hardcoded** (mounted outside the node map → `nodeId: null`). `EXPECTED_HARDCODED_ARTIFACTS = {configurator-watch, orrery-complication, hub-transition}`.
- **Live accessor `window.__PRISM_NODE_AUTHORSHIP__()`** — bound in `GraphScene.tsx` (editor-shell, NODE_ENV-gated, beside `__PRISM_SCENE__`; the window binding stays OUT of the runtime module). Node-authored roots self-tag `userData.prismNodeId` at the node-group ref callback. The two declarative rigs (watch/orrery) are tagged at their GraphScene **mount host** via a neutral `<group userData={{prismHardcodedArtifact}}>` — **the rig component files are untouched** (verified: not in the diff); the transition curtain is recognized by its existing group name `hub-scene-transition` (zero-edit).
- **`scripts/node-authorship-gate.mjs`** — Playwright; boots preview-app, navigates s4-celestia (orrery) + s6-atelier (watch) so every rig mounts (the transition is always mounted in preview-app), unions authorship across hubs. **FAILS on unsanctioned hardcoded drift**; the 3 known are expected-hardcoded (warn). Cross-checks node-authored ids against the graph + reports the 7 former orphans (`--strict-orphans` makes those fatal). `/prism-verify` + `prism-criteria-reviewer` updated to require node-authorship.

**Current flags (proof the gate works).** The gate correctly flags all **3 known hardcoded** artifacts with `nodeId: null` — `configurator-watch`, `orrery-complication`, `hub-transition` — and reports `unexpectedHardcoded: []` (no fresh Law-0 drift). These 3 are **expected-known until their G1/G2/G3 greenlight sessions**. A NEW hardcoded scene-content component would FAIL the gate.

---

## WAVE 2 — G5: per-orphan decision (the 7)

**The 6 ambience PLANES → REMOVED** (graph 331 → 325 nodes). Evidence-grounded rationale (all four points held for every plane): (a) they fail `hasArtifactData` → render a wrong-shape glass bubble in canvas and **nothing** in preview-app (currently broken); (b) their bound primitive is either an **UNMOUNTABLE category** the binding engine explicitly refuses to run on a mounted artifact, or a self-generating particle system that renders **off-palette**; (c) every hub already carries a rich, on-theme `background[]` nebula+particle stack (the Ruler-sanctioned ambience mechanism) that subsumes the implied motif; (d) **0 edges, 0 code references** → safe. This is `AUDIT-REMEDIATION-PLAN` G5 **option (b)**. Removal also *improves* canvas (6 junk bubbles gone) with **zero** preview-app regression.

| Orphan (REMOVED) | Hub | Bound primitive (category) | Why redundant — ambience already delivered by |
|---|---|---|---|
| `orr-arrival-dust` | s1-arrival | cosmic-dust (**volumetric → UNMOUNTABLE**) | `brass-nebula-scatter` (embers) + camera-locked `brass-nebula-motes` |
| `orr-movement-rings` | s2-movement | orbit-rings (particles, off-brass icy `#9fd0ff`) | mvmt nebula + scatter + motes + `bg-macro` gear-movement backdrop |
| `orr-celestia-starfield` | s4-celestia | starfield-twinkle (**shimmer → UNMOUNTABLE**) | `celestia-deep-scatter` **variant:"starfield"** (the same effect) |
| `orr-celestia-galaxy` | s4-celestia | galaxy-particles (particles) | `celestia-deep-env` volumetric-nebula swirl + scatter |
| `orr-celestia-orbits` | s4-celestia | orbit-rings (particles, off-theme) | the `orr-celestia-armillary` node + the orrery complication's brass orbit rings |
| `orr-acquire-sweep` | s5-acquire | light-sweep (**shimmer → UNMOUNTABLE**) | acquire nebula env + motes + `bg-gallery` plate + scene lighting |

> Note: the planes' `animationBindings` params didn't even match their primitives' schemas (e.g. dust bound `{density, driftSpeed}` vs cosmic-dust's `{drift, scale, starDensity}`) — confirming they were stale, never-rendered authoring leftovers. Forcing the 2 mountable ones (orbit-rings/galaxy) to render would paint icy-blue particles on brass hubs, **violating the on-theme design law** — so removal is *more* law-compliant than authoring.

**`orr-atelier-reason` → KEPT + FILLED.** It is `REASON_NODE_ID`, wired to the configurator's `applyConfiguratorReason` (the constraint-feedback HUD line) — `src/lib/prism/atelier/applier.ts` writes/clears it at runtime. Removing it would break that feature, so it is **not** redundant. Gave it on-brand resting copy: **"Every pairing is bench-checked for mechanical harmony."** It is now node-authored with real `textSpec.content`.

---

## WAVE 3 — verification (all gates, with evidence)

Fresh dev restart (`rm -rf .next`, `unset NODE_ENV`), cold load via Chrome DevTools MCP.

| Gate | Result | Evidence |
|---|---|---|
| **Cold-load** | **PASS** | 1 `<canvas>` (no split-pane), probe installed + 36 node-groups mounted, not stuck on INITIALIZING/LOADING, **0 console errors** (3 benign warnings: coderef dynamic-import, THREE.Clock deprecation, init-params), **0 `_next` 404s** (70 requests, all 200/304/301) |
| **node-authorship-gate (`--strict-orphans`)** | **0 hard-fail** | flags 3 known hardcoded (expected), `unexpectedHardcoded: []`, 176 node-authored all in-graph, `emptyNonText: []`, `orphans.planes-removed` PASS, `orphans.reason-filled` PASS (`node-authorship-gate.json`) |
| **tsc gate** | **PASS** | `9 total · baseline 10 · new 0` (one baseline error fewer) |
| **Per-hub render** (planes removed) | **PASS** | `s1-arrival.png` (dust→background ✓), `s2-movement.png` (rings→gear backdrop ✓), `s4-celestia.png` (starfield/galaxy/orbits→starfield-bg + orrery rings ✓) — all premium, no empty hole |
| **Reason node renders** | **PASS** | `s6-atelier-canvas-reason.png` — in canvas mode the node renders **48 glyph meshes**, `textHandleContent = "Every pairing is bench-checked for mechanical harmony."` (live `evaluate_script` + screenshot). MINIMAP confirms **325 NODES**. |
| **prism-criteria-reviewer** (node-authorship-aware) | **PASS** | 0 MUST-FIX; rig files untouched, gate asserts authorship not name, runtime module DOM-free, graph clean (0 dangling refs) |
| **user-advocate** (capstone) | **PASS** | 0 MUST-FIX; all hubs "premium and complete", removed planes "fully superseded" by backgrounds + complications, reason line "real, elegant, on-brand copy" |

### Honest flags (non-blocking)
- **Reason node on s6 in *preview-app* is configurator-controlled.** `applyConfiguratorReason(scene, null)` blanks the line to empty at rest (the clean-HUD G4 behavior, **out of scope** — `applier.ts` untouched). The graph-authored resting copy therefore renders in **canvas/galaxy** and on a fresh preview-app mount; on s6 in the running app the configurator drives it (live constraint reasons / empty at rest). This is correct functional behavior, not a regression — the node now *carries* real content (closing the audit's "empty at author time" defect) and renders 48 glyphs when not overridden.
- **Criteria-reviewer NIT (deferred to G3):** the transition is recognized by its group `name` (no `prismHardcodedArtifact` tag, since its file is untouched). If a future refactor renames it, it silently reclassifies. Worth a tagged mount host when G3 is greenlit.
- **Criteria-reviewer NIT:** the gate's `authored.text-warm` uses fixed settle timeouts; cold MSDF text can still be warming at capture (warn-only, never fatal). The reason node's render is positively confirmed by the live `evaluate_script` (48 glyphs) + screenshot, and the orphan resolution is asserted graph-side by `orphans.reason-filled` PASS.
- **user-advocate taste FLAG (pre-existing, out of scope):** the s2-movement headline contrast + legibility scrim bars read slightly utilitarian. Unrelated to orphan removal (predates this session).

---

## DONE
S3d gate exists + works (flags the 3 known hardcoded, 0 fresh drift). All 7 orphans resolved: 6 ambience planes removed (superseded by on-theme hub `background[]`), `orr-atelier-reason` kept + renders real copy. Clean cold load, tsc green, criteria-reviewer PASS, user-advocate PASS. Frames + gate JSON in `notes/verification/fix1/`.

PRISM-FIX1: RUN COMPLETE
