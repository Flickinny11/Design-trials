# GUIDED-TIPS — glowing-lightbulb first-visit walkthrough
(status: in progress)

A thin, a11y-first BESPOKE walkthrough controller where Prism DRIVES the screen:
a glowing top-right lightbulb launches a first-visit tour; a synthetic cursor
travels between targets; smooth spotlight cutouts frame chrome regions; the live
3D scene dims around framed artifacts; high-tech popups show the relevant
artifact animated in 3D (sharing the single renderer) with premium type +
Skip/Close. Skippable, dismissible, first-visit-aware, re-triggerable, fully
keyboard + reduced-motion accessible.

## Architecture (P0 contract)
- **Controller store:** `src/stores/useWalkthroughStore.ts` — state machine
  (idle → running → done|skipped), step index, reduced-motion flag, the
  transient artifact-frame rect the popup publishes for the in-scene artifact.
- **Step model + data:** `src/lib/editor/walkthrough/{types,steps}.ts` — 7
  authored steps (DATA), each naming its in-scene 3D artifact primitive (C7) and
  the named-primitive composition of its popup entrance (C8).
- **First-visit flag:** `src/lib/editor/walkthrough/seen-store.ts` — localStorage
  `prism.guidedTips.seen.v1`; auto-launch once, lightbulb re-triggers forever.
- **Lightbulb:** `src/components/editor/walkthrough/GuidedTipsLightbulb.tsx`
  (page-level so it shows in all 3 modes incl. preview-app where TopBar hides).
- **Host + overlay:** `src/components/editor/walkthrough/WalkthroughHost.tsx`
  (scrim+cutout, driven cursor, popup, controls, focus trap, keyboard, a11y).
- **In-scene 3D artifact:** `src/components/editor/graph/TipArtifactStage.tsx`
  — mounted inside GraphScene's single `<Canvas>` (INV-1/FP-2); reuses
  `buildSubject` + the animatable registry to render + animate the step's
  primitive artifact, camera-anchored to the popup's transparent window rect.

## Baselines (for C12 no-regression)
- tsc: **9 pre-existing errors** (all in `tests/**`, `NodeContext.THREE` missing) — snapshot `notes/verification/tips-tsc-baseline.txt`.
- animatable primitives registered: **408**.
- prebuilt element clusters: **37** catalog files.

## P0 — contract + re-verify (bespoke controller, step model) — DONE
- Model confirmed claude-opus-4-8 (env). Bespoke a11y-first controller confirmed
  per QUEUE-PREP-RESEARCH §DOMAIN B (Driver.js spotlight technique borrowed; no
  heavy tour dep — FP-10). Typed contract written; tsc 0-new.
## P1 — lightbulb + shell (spotlight, driven cursor, lifecycle) — DONE
Built: `GuidedTipsLightbulb` (bespoke SVG filament bulb, page-level, all 3 modes),
`WalkthroughHost` (lifecycle + view-mode driving + target measure + cursor + keyboard
+ dev hook `__PRISM_TIPS__`), `WalkthroughScrim` (SVG-mask dimmer, feathered multi-hole
cutouts + brass frames/sweep), `DrivenCursor` (rAF lerp + skew + click pulse), and
`WalkthroughPopup` (glass card, transparent artifact window, kinetic title, controls,
focus trap). Wired into page.tsx (page-level mounts) + layout.tsx (CSS) + Inspector
(`data-component="inspector"`).

Harness `scripts/guided-tips/capture.mjs` (DPR-2, 4 viewports). Evidence
`notes/verification/guided-tips/p1/`. Per-viewport result:
| viewport | C1 | C2 | C3 (cursor px) | C4 | C5 | C7 (Δcanvas) | console |
|---|---|---|---|---|---|---|---|
| desktop 1440×900 | ✓ | ✓ | ✓ 417 | ✓ | ✓ | ✓ Δ0 | 0 |
| tablet 1024×768 | ✓ | ✓ | ✓ 349 | ✓ | ✓ | ✓ Δ0 | 0 |
| constrained 880×600 | ✓ | ✓ | ✓ 268 | ✓ | ✓ | ✓ Δ0 | 0 |
| mobile 390×844 | ✓ | ✓ | ✓ 114 | ✓ | ✓ | ✓ Δ0 | 0 |

Notes: C7 measured as the canvas DELTA the walkthrough adds (0 in every mode — the
editor already owns GraphScene + a pre-existing 2D Minimap in galaxy/canvas; the
walkthrough's 3D artifact will share GraphScene's single renderer, P2). C6 (scene
spotlight) is a P2 criterion — the artifact window is empty until TipArtifactStage
lands; mobile flagged it (expected pre-P2). Playwright's actionability heuristic trips
on the animated bulb/popup glass, so the harness clicks real pixel coordinates
(`page.mouse.click`) — the same real interaction the advocate performs.
## P2 — scene-spotlight + 3D popups (premium, primitive-composed) — TODO
## P3 — accessibility + responsive — TODO
## P4 — verification + capstone — TODO

## Criteria ledger (C1–C13)
| # | Criterion | Status |
|---|---|---|
| C1 | Lightbulb present + glowing | PASS (P1, 4 vp) |
| C2 | First-visit auto-launch + gate | PASS (P1, 4 vp) |
| C3 | Driven cursor | PASS (P1, 4 vp) |
| C4 | DOM-chrome spotlight | PASS (P1, 4 vp) |
| C5 | Controls work | PASS (P1, 4 vp) |
| C6 | Scene spotlight | TODO |
| C7 | 3D artifact in popup (one renderer) | Δcanvas=0 PASS (P1); 3D artifact in P2 |
| C8 | Premium popup type + composition | TODO |
| C9 | Reduced-motion path | TODO |
| C10 | Keyboard + focus + ARIA | TODO |
| C11 | Responsive (4 viewports) | TODO |
| C12 | No regression | TODO |
| C13 | Capstone WOW (advocate 0 MUST-FIX) | TODO |
