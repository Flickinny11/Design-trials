# FINISH F-2 — STRUCTURAL TRUTH: GALAXY ↔ CANVAS ↔ PREVIEW PARITY

Date: 2026-07-01 · Model: Fable 5 · Branch: `codex/prism-recovery-harness-20260630`
Verified under `docs/prism/NEAR-HUMAN-QA-PROTOCOL.md`. Baseline HEAD at start: `415234a5` (F-1 complete).

## Founder law (governing, now recorded in the spec)

> "there can't be an element in the ui of the watch app without there being a
> node for it in galaxy mode... galaxy mode shows all those nodes unbuilt
> status and then when built that's when it's visible in the preview and
> canvas."

Appended verbatim to `docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md` as
**Amendment 2026-07-01 — Founder direction (verbatim)**; the spec Status line
is now **founder-directed** and the stale "Next Safe Phase: W3" section points
at the FINISH chain.

## Known discrepancy 1 — "327 NODES" vs "51 NODES": exact diagnosis

Both numbers were real, but counted **different units, unlabeled**:

| Surface | What it counted | Value |
|---|---|---|
| Canvas minimap + canvas hub pills | **raw graph atoms** — every `PrismNode` incl. 107 app-shell fragments, 72 invisible hit-targets, 7 embedded-decoration scrims/chrome | 327 total · Atelier 103 |
| Galaxy minimap + galaxy hub pills | **element-level projection** — 141 content atoms clustered into first-class galaxy elements (22 clusters; shell/hit/decoration collapsed per QA-protocol §4) | 51 total · Atelier 16 |

Evidence: `verify:galaxy` output (141 overview / 51 projected / per-hub
s1:7 s2:7 s3:31 s4:7 s5:17 s6:72 content atoms), raw per-hub counts from
`live-graph.json` (s6-atelier: 103 atoms).

**Resolution (element-level truth, the prompt's default preference):** ONE
count story in every view.
- `overlays/Minimap.tsx` — the radar now always draws the galaxy projection
  (elements) in galaxy, canvas, and preview alike; the kicker reads
  **"51 elements"** (labeled unit). Canvas atom selections map to their
  containing element (self or `clusterNodeIds` cluster) so the reticle stays
  coherent (`elementIdForAtom`).
- `overlays/HubNav.tsx` — hub pills always show
  `countGalaxyProjectedNodesForHub` (Atelier **16** in every view; memoized
  `elementCountByHub`; `title="16 elements"` tooltip labels the unit).
- The raw atom count (327-grade) is no longer a headline number anywhere in
  the chrome. `TopBar`'s health % is a ratio (unit-independent, labeled
  "Graph health") and `HubInspector`'s "ATTACHED NODES (…)" is an explicitly
  labeled technical list — both left as-is.
- Stale test expectations updated (`EB-03-07`: 148→141, 73→72,
  `support-layers` cluster removed — all superseded by the galaxy-semantics
  run `ac54c1ab`; this test was already failing at baseline) + a new test
  pins the unified wiring. 6/6 pass.

Proof frames (desktop): `notes/verification/finish-f2/desktop/01-galaxy-overview.png`
(galaxy: pills + "51 elements") and `06-canvas-counts.png` (canvas: SAME
numbers). Machine-read from the DOM in the sweep: `{"atelierPill":"16",
"minimapLabel":"51 elements"}` in BOTH modes, desktop and mobile.

## Known discrepancy 2 — "Edit in Preview" audit

**Verdict: it does NOT author from Preview — the name was the lie.** Evidence:
- `CanvasCameraHud.tsx` renders the control only while `viewMode === 'canvas'`
  (line: `if (viewMode !== 'canvas') return null;` above the toggle).
- The flag `editInPreview` never changes `viewMode`; it locks the CANVAS
  camera to the shipped framing (`GraphScene.tsx` `shouldLock` /
  `framed = viewMode === 'canvas' && editInPreview`) while toolbar, selection,
  and gizmo stay live in canvas.
- `useGraphEditorStore.setViewMode` resets it to `false` on every mode change,
  so it can never leak into `preview-app`. Preview keeps zero authoring chrome
  (sweep check: no inspector, no toolbar controls in preview — PASS).

**Fix (rename so it cannot be misread):** button → **"Shipped Frame"**
(tooltip: "Lock the canvas camera to the shipped framing — edit here in
Canvas against the real result (Preview stays read-only)"); active pill →
**"Canvas · Shipped Frame — CAMERA LOCKED · EDITING LIVE"**. The store field
name is retained (additive discipline) with the rename documented in its
doc-comment. Sweep proves: "Edit in Preview" string GONE from the DOM;
lock-enter/exit round-trip works (frames `07-canvas-hud-shipped-frame.png`,
`08-canvas-shipped-frame-locked.png`).

## Task 1+2 — bidirectional parity audit, machine-checked and permanent

**New gate: `scripts/galaxy-parity-gate.mjs`** (sibling of
node-authorship-gate), wired into `package.json`:
- `npm run verify:parity` — LIVE mode (dev server): walks ALL 6 hubs in
  canvas, unions `__PRISM_NODE_AUTHORSHIP__` captures, and enforces
  - **Direction A** (element → galaxy node): every mounted artifact is
    graph-backed (Law-0 floor, zero hardcoded) AND every content-role artifact
    is a galaxy projection member; sanctioned-collapsed roles
    (app-shell / hit-target / ambient-background / embedded-decoration /
    global-overlay) are hub-layer implementation detail per QA-protocol §4.
  - **Direction B** (galaxy node → element): every first-class galaxy element
    (or cluster member) mounts a non-empty artifact on its hub — stage-0
    UNBUILT nodes exempt (structure-without-element by design) and asserted
    ABSENT from preview-app.
- `npm run verify:parity-static` — graph-level half (no browser), appended to
  the standard `npm run verify` chain (which stays serverless).
- **Anti-drift is machine-enforced:** a new in-page probe
  `window.__PRISM_GALAXY_PARITY__` (`src/app/page.tsx`, dev-hook idiom)
  evaluates the REAL `galaxy-semantics.ts` module against the live store; the
  gate cross-checks its script mirror against it every run
  (`live.mirror-matches-app`). The mirror itself was deduplicated into
  `scripts/lib/galaxy-roles.mjs`, now shared with `verify-galaxy-semantics.mjs`
  (one mirror instead of two).
- Gate gotcha handled: fresh Playwright profiles auto-launch the first-visit
  walkthrough, which DRIVES viewMode mid-gate — the gate pre-seeds
  `prism.guidedTips.seen.v1`.

**Audit result: 13/13 checks pass — ZERO parity breaks found.**
- Direction A: 277 mounted artifacts across all hubs, all graph-backed, all
  content galaxy-represented, zero hardcoded.
- Direction B: all 141 element atoms verified mounted with real renderables.
- `live-graph.json` needed **no changes** (the one graph already IS the source
  of truth in all three views); the fixture is byte-identical to HEAD.
Artifacts: `notes/verification/finish-f2/galaxy-parity-gate.json` +
`parity-gate-final-frame.png`.

## Task 3 — UNBUILT vs BUILT semantics, proven with one real round-trip

`scripts/verify-f2-roundtrip.mjs` (kept, re-runnable), real Chrome/GPU, real
UI clicks (Canvas → Add group → **Add Element** → lifecycle **Add Object** →
image-link **Use**). All 10 steps PASS
(`notes/verification/finish-f2/roundtrip/roundtrip.json` + 6 frames):

1. Add Element → stage-0 bubble node created in canvas (`01-…bubble.png`).
2. The app's own semantics report it **content + UNBUILT + first-class in the
   galaxy projection** (galaxy = unbuilt structure, `02-…structure.png`).
3. Preview-app does **NOT** mount it (`03-…absent.png`) — "not rendered in
   Canvas/Preview until Built".
4. BUILD via image populate → surgical rebuild → textured element in canvas
   (`04-canvas-built.png`); parity probe flips it to BUILT.
5. Preview-app now mounts the built element (`05-…visible.png`).
6. `saveToServer` → `/api/prism/regen` → reload → the node restores **BUILT**
   from `live-graph.json` (`06-reload-persisted-built.png`).

The checked-in fixture was restored via git after the proof (the round-trip
proves the persistence machinery; the demo fixture is not permanently
mutated) — same discipline as F-1. The parity gate's
`live.unbuilt-hidden-in-preview` check enforces the unbuilt law permanently.

## Task 5 — verification per NEAR-HUMAN-QA-PROTOCOL

**Interaction sweep** (`scripts/_f2-sweep.mjs`, real Chrome + real GPU,
desktop 1600×900 + mobile 390×844): **16/16 PASS, 0 page errors, 0 console
errors.** Highlights: unified counts machine-read in both modes/viewports;
physical hub hover → pointer-cursor raycast feedback; node label ENLARGE on
hover (scale 0.93→1.55, Sora display type); hub pill navigation; Inspector
opens on selection; REAL staged edit through the Visual-tab ColorPicker
(preview-state patch registered) then Discard (buffer cleared — no
persistence); physical artifact hover in canvas sets `hoveredNodeId`;
Shipped-Frame lock/exit; preview clean of authoring chrome; mobile taps all
land. Frames: `notes/verification/finish-f2/{desktop,mobile}/`.
(Galaxy moon-sphere hover is verified at the state→label layer because the
2.6u orbiting moons + idle camera drift defeat blind pointer automation; the
raycast pipeline itself is proven physically on hubs and on canvas artifacts.)

**Gates (all green):**
- `npm run verify` (verify:prism + repair-loop + galaxy 7/7 + global-shell +
  parity-static 6/6) — PASS
- `npm run verify:parity` (live) — 13/13 PASS
- `node scripts/node-authorship-gate.mjs` — 9/9 PASS
- `node scripts/typecheck-gate.mjs` — 0 new errors (9 vs baseline 10)
- `npm run gate:no-dom-ui` — PASS (44 files)
- vitest: 3405 passed · 8 failed — **all 8 failures reproduce identically at
  clean HEAD `415234a5`** (pre-existing GraphScene source-grep tests, proven
  via a throwaway HEAD worktree; none introduced by F-2). EB-03-07 (the
  touched suite): 6/6.
- Secret scan over the full diff: clean (only the spec's own "No raw secrets"
  prose matches).
- Console-error fix along the way: `shared-editors/ColorPicker.tsx` mixed the
  `background` shorthand with longhands (React dev-mode error on every
  rerender while the picker was open) — converted to longhand layers; sweep
  now records 0 console errors.

## Files touched (surgical)

- `src/components/editor/overlays/Minimap.tsx` — element-projection radar +
  labeled count + atom→element selection mapping.
- `src/components/editor/overlays/HubNav.tsx` — always element counts.
- `src/components/editor/overlays/CanvasCameraHud.tsx` — Shipped Frame rename.
- `src/stores/useGraphEditorStore.ts` — doc-comments for the rename (no logic).
- `src/app/page.tsx` — `__PRISM_GALAXY_PARITY__` dev probe.
- `src/components/editor/shared-editors/ColorPicker.tsx` — style-longhand fix.
- `scripts/galaxy-parity-gate.mjs` (new) · `scripts/lib/galaxy-roles.mjs`
  (new, shared mirror) · `scripts/verify-galaxy-semantics.mjs` (imports the
  shared mirror; output identical 7/7) · `scripts/verify-f2-roundtrip.mjs`
  (new) · `scripts/_f2-sweep.mjs` (new) · `package.json` (verify:parity,
  verify:parity-static, verify chain).
- `docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md` — founder amendment +
  Status + Next Safe Phase refresh.
- `tests/editor-build/EB-03-07.galaxy-semantics.test.ts` — stale numbers
  fixed + unified-count wiring pinned.
- `public/prism-mock/home/live-graph.json` — **unchanged** (restored after
  the round-trip proof; zero parity fixes required graph edits).

## Judge round 1 → fixes → judge round 2

**prism-criteria-reviewer (round 1): PASS, 0 MUST-FIX** (C1–C8 all MEET;
independently re-ran the gates; confirmed the EB-03-07 number update traces to
the earlier galaxy-semantics commit `ac54c1ab`, not this diff; confirmed
live-graph.json untouched and the founder quote byte-identical to source).

**user-advocate (round 1): 1 MUST-FIX + 3 SHOULD-FIX** — all addressed:

1. **MUST-FIX — bottom-chrome collision:** the resting camera HUD stack
   (JOURNEY strip + Shipped Frame pill) sat at `bottom-4`, directly on the
   hub-count rail (`bottom-5`), occluding the "Materia 7" pill in the
   node-selected canvas state. FIX: the HUD stack now rests one clear band
   ABOVE the rail (`md:bottom-[84px]`; the F-1 keyframe lift to 318px is
   unchanged) — `CanvasCameraHud.tsx`. Recaptured `desktop/06` + `07`: the
   band reads instrument / JOURNEY / Shipped Frame / hub rail as four clean
   stacked layers, every count legible.
2. **SHOULD-FIX — mobile counts unlabeled:** on compact density (no minimap
   to spell the unit) the ACTIVE hub pill now teaches it — "16 elements" —
   while idle pills stay bare numbers (`HubNav.tsx`). Machine-read on mobile:
   `minimapLabel:"16 elements"` from the pill.
3. **SHOULD-FIX (criteria) — static-gate evidence clobbering:** static mode
   now writes `galaxy-parity-gate.static.json`; the committed LIVE 13-check
   evidence can no longer be overwritten by `npm run verify`.
4. **SHOULD-FIX (criteria) — static-mode mirror drift blind spot:** new
   `tests/editor-build/F2-galaxy-mirror-sync.test.ts` imports BOTH
   `scripts/lib/galaxy-roles.mjs` and the real `galaxy-semantics.ts` and
   asserts identical roles + identical projection member sets over the live
   fixture — mirror drift now fails the plain test run, no browser needed.
   2/2 pass.
5. **SHOULD-FIX — mobile/02 half-black frame:** reproduces with a 6.5s settle,
   so it is NOT capture lag: after a galaxy hub fly-in on the narrow mobile
   aspect, the right portion of the frame is void (background envelope edge at
   close zoom). None of F-2's diff touches cameras or backgrounds (chrome,
   probes, scripts only) — this is a PRE-EXISTING mobile fly-in framing
   artifact that F-2's sweep is the first to capture. Deferred to F-3
   (shippable polish) with this note; the navigation itself is proven
   (machine-check `hub === 's6-atelier'` + hub content visible in frame).
6. Advocate flags noted for F-3 polish backlog (not F-2 surfaces): top-bar
   breadcrumb/mode-switch overlap at 1600px; view-mode slider track striking
   inactive labels; capture cursor-ring in two frames.

Post-fix state: sweep re-run — **15 recorded interaction checks + the
page-errors check, ALL PASS; 0 console errors, 0 page errors** (desktop +
mobile frames recaptured; the page-errors check is now persisted into
sweep.json for future runs — advocate honesty nit); typecheck gate still
0-new; EB-03-07 6/6 + mirror-sync 2/2.

## Judges — final verdicts (fresh context, Fable 5)

- prism-criteria-reviewer: **PASS — 0 MUST-FIX** (round 1; delta re-checked
  round 2).
- user-advocate: **PASS — 0 MUST-FIX** (round 2, after the de-collision fix).

PRISM-FINISH-F2: RUN COMPLETE
