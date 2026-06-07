# STEP 6 — FAITHFUL BUILD — Report

**Branch:** `prism-editor-build` (HEAD unchanged — **no commit**, staged for Logan's screenshot review)
**Model:** claude-opus-4-8 · focused session
**Date:** 2026-06-07
**Load-bearing rule under test:** a built artifact's **position, behavior, and animations come entirely from the node's own schema/code**. The runtime *applies* `scenePosition` and *runs* the node's own `cinematicPrimitives`; it imposes **no** external layout/grid and mutates **no** schema.

**Verdict: PASS — 12/12 automated checks, fresh-context reviewer APPROVED (no MUST-FIX).**

---

## What changed (source, scoped slice only)

| File | Change | Scope item |
|---|---|---|
| `src/components/editor/graph/ArtifactNode.tsx` | The built-state surface (`scene` layout → canvas + preview-app) now runs each node's **own** `cinematicPrimitives` via the real primitives API + factory `runPrimitives:true`. The galaxy force-graph map (`topology` layout) stays static. One cached factory per layout. | **2 — code + motion run** |
| `src/components/editor/graph/GraphScene.tsx` | `AssembledSceneNode` gains a once-per-build **realization "pop"** (scale 0.6→1 on an inner group), keyed by `nodeId:rebuildVersion` so it plays on a genuine build/rebuild but **never** on a mode toggle. Position composition (`scenePosition ⊕ canvasTransform`) is **unchanged**. | **3 — build realization** |
| `scripts/verify-step6-faithful-build.mjs` | New dependency-free Playwright verifier (evidence harness). | verification |

No layout/placement engine added. No node schema mutated. No dependency added (the dependency guard blocked an attempt to import `pngjs`/`pixelmatch` for a pixel-diff — I did **not** work around it; the verifier uses node builtins + the already-approved `playwright` instead).

Diff: `src/` = 2 files, +84/−12. Typecheck: **0 new errors** (the 10 pre-existing `tsc` errors — the `createUnifiedRenderer` GL-factory typing + test-fixture `NodeContext.THREE` — are untouched). Unit+integration: **361 passed**; the only 3 failures pre-exist on clean HEAD (two enforce the *rescinded* no-bespoke-animation rule per SPEC-INDEX pending #2; one is a stale test using the retired `preview-hub` literal).

---

## Scope item 1 — POSITION FROM SCHEMA

**Criterion:** RT-SC-04/05 + CANVAS INV-25 — the renderer applies the node's own `scenePosition`; it does not override it with a grid/default. *(No code change needed — the existing `AssembledSceneNode` wrapper was already the sole consumer of `scenePosition ⊕ canvasTransform`. STEP 6 proves it with assertions.)*

**EVIDENCE — programmatic `world position == schema scenePosition` (canvas mode, tolerance ≤ 0.01):**

| node | schema scenePosition | measured world position | match |
|---|---|---|---|
| home-headline | (0.00, 1.50, 0.10) | (0.00, 1.50, 0.10) | ✅ |
| home-feature-card | (2.60, 0.20, 0.00) | (2.60, 0.20, 0.00) | ✅ |
| home-parallax-stack | (−2.80, −0.50, −1.00) | (−2.80, −0.50, −1.00) | ✅ |
| home-orbit-decor | (−1.40, −1.60, 0.20) | (−1.40, −1.60, 0.20) | ✅ |
| home-floating-accent | (1.80, −1.40, 0.15) | (1.80, −1.40, 0.15) | ✅ |
| home-cta-hero | (0.00, −0.20, 1.00) | (0.00, −0.20, 1.00) | ✅ |

- **6/6 exact match.** Positions are **6 distinct designed coordinates**, not a uniform grid → proves placement came from the node, not from a layout engine. (`canvas.position-eq-schema`, `canvas.positions-distinct`.)
- Screenshot: **`notes/verification/step6/canvas.png`** — a designed page (parallax stack lower-left, mesh hero center, feature card right, accent below), each artifact at its authored spot.

## Scope item 2 — CODE + MOTION RUN

**Criterion:** RT-SC-10 (live drivers running) + RUNTIME §9 (the runtime executes whatever animations a node declares).

**EVIDENCE:**
- **Functional:** the `home-orbit-decor` node's inner artifact **moved 0.84–0.99 units in 700 ms** (its own `orbit` primitive running) **while its wrapper anchor stayed exactly at scenePosition (−1.40, −1.60, 0.20)** — i.e. the node's coded motion plays *around* its schema anchor, the anchor itself never drifts. (`motion.inner-moves`, `motion.anchor-stable`.)
- **Vision:** two canvas frames 600 ms apart differ (`motion.frames-differ`). Screenshots: **`motion-a.png`**, **`motion-b.png`**.
- Galaxy map stays static (no cinematic motion fighting the force-graph sim) — `topology` layout still uses the no-op primitives.

## Scope item 3 — BUILD REALIZATION (transition)

**Criterion:** RT-SC-06 — building reveals the artifact at its coded position; the "pop" is the visual of node→built realization.

**EVIDENCE:** an inner-group scale-pop (`0.6 → 1`, `back.out` ease, 0.5 s) plays **once per build** — keyed by `nodeId:rebuildVersion` in a module-level set, pruned to ≤ one entry per node. It fires on first realization and on Save-and-Rebuild (version bump), and is provably **inert on a mode toggle** (the `AssembledSceneNode` instances don't remount across canvas↔preview-app, and the guard short-circuits a galaxy→canvas re-mount). It never fully hides the artifact (min scale 0.6, with a cleanup that guarantees final scale 1) so a dropped frame can't leave a node invisible. Confirmed by the fresh-context reviewer (mechanism) and by `toggle.no-rebuild` (below). Verified not to perturb position (pop animates an inner group's scale; the measured world positions above are at-rest and unaffected).

## Scope item 4 — FAITHFUL IN BOTH MODES

**Criterion:** RT-SC-10 — canvas and preview-app show every artifact at its schema position running its code, served from cache.

**EVIDENCE:**
- **preview-app `world == schema` for all 6 nodes** (`preview.position-eq-schema`). Screenshot **`preview-app.png`** = same artifacts, same positions, authoring chrome hidden → reads as the running app.
- **Toggling never rebuilds:** artifact build count **6 → 6** across a canvas→preview-app→canvas toggle (`toggle.no-rebuild`, RT-SC-08 / INV-R6).
- Galaxy renders dormant spheres only (no artifacts) — **`galaxy.png`** (RT-SC-04, two-state invariant intact).

## Console / errors

- **Zero** new console or page errors across the full run (`console.no-errors`).

## Fresh-context reviewer (prism-criteria-reviewer)

**VERDICT: APPROVE — no MUST-FIX.** Confirmed against on-disk code: position still flows from the node's own `scenePosition` via the unchanged wrapper (INV-25); the pop is nested *inside* the wrapper so it imposes no position; primitives animate the inner artifact, not the anchor; the pop is gated to genuine builds (no FP-R4 toggle-rebuild); no FP-R3/R8/R11 drift. One hygiene nit (unbounded `poppedBuilds` set) — **applied** (set now pruned to ≤ one entry per node). Full verdict captured in this session's transcript.

---

## Evidence index (`notes/verification/step6/`)

| File | Shows |
|---|---|
| `canvas.png` | Canvas: designed page, artifacts at schema positions, authoring frame visible |
| `preview-app.png` | Preview-app: same artifacts/positions, chrome hidden — the running app |
| `galaxy.png` | Galaxy: dormant spheres (node-state) |
| `motion-a.png` / `motion-b.png` | Two canvas frames 600 ms apart (animation running) |
| `step6-report.json` | All 12 checks + per-node position assertions (canvas + preview-app) |

---

## Schema / authoring gaps found (per OUT OF SCOPE — surfaced, NOT "fixed" by inventing layout)

1. **Stacked clones in the autosave graph (data, not runtime).** The working-tree `public/prism-mock/home/live-graph.json` had grown from the committed **6-node designed page** to **12 nodes** — 6 of them UUID clones (from Step-5 clone testing) all carrying the source's identical `scenePosition (0, 1.5, 0.10)`. Faithfully realized, they **stack** at that one point. This is an **authoring** situation (a clone inherits its source's position and must be repositioned by *editing each node*), not a runtime layout bug — and confirms the load-bearing rule (the runtime placed them exactly where their schema said, even when that means overlap). For clean "designed page" evidence I reverted `live-graph.json` to the committed 6-node version; the 12-node state is preserved at `notes/live-graph.json.step6-12node-backup-20260607-084633`. **No schema was edited to "spread them out."**
2. **Scroll-/pointer-driven motion is inert in the editor scene.** `parallax-scroll` (7 nodes) and `magnetic-cursor` (1 node) require the Driver model's `scroll`/`pointer` sources, which the editor scene does not yet bind (the shared primitives context exposes scene/camera only). Their *time-driven* siblings (`orbit`, `kinetic-text` intro, etc.) run. Wiring scroll/pointer drivers belongs to the **Canvas spec §16 Driver model** and was **not invented here** — it is the natural next step. (`displacement-transition` likewise returns a paused timeline awaiting a trigger.)
3. **`home-cta-hero` declares no `cinematicPrimitives`.** It builds **static** — which is faithful (its own schema specifies no motion). Noted for completeness, not a defect.

---

## Plain-language summary (for a non-coder)

**What this step proves: when Prism "builds" a piece of your page, that piece lands exactly where *its own card says it should* and starts doing *its own animation* — nothing on the outside is arranging or moving it.**

- Open **`canvas.png`**: that white page with the blue stack, the dark hero shape, the glowing card, and the little accent is your home page. Each piece sits where its node's saved position says — I measured all six and every one matched its saved coordinates **exactly** (not a tidy auto-grid — six genuinely different, hand-placed spots).
- **`preview-app.png`** is the *same* page with the editor tools hidden — what your finished app looks like. Same pieces, same spots.
- Things **move now**: the little orbiting decoration actually orbits its home spot (I measured it travelling while its anchor stayed put). Compare **`motion-a.png`** vs **`motion-b.png`** — the scene is alive, not a frozen picture.
- **`galaxy.png`** is the zoomed-out "map" view — here every piece is a calm sphere (not built yet), which is exactly right.
- Switching between these views is **instant and rebuilds nothing** (I confirmed the build counter never moved).
- **One thing to know:** there are 6 leftover duplicate "headline" copies from earlier clone-testing that were all saved at the *same* spot, so they'd pile up on top of each other. That's a *content* thing — they each need to be dragged to their own spot by editing them — not something the builder should silently rearrange. I set those aside (safely backed up) so the pictures above show your real designed page. Also, the scroll-follow and mouse-follow animations don't play yet in this editor view (they need a "driver" hookup that's a separate, later piece of work); the time-based animations do play.

Nothing was committed — everything is staged for your review.
