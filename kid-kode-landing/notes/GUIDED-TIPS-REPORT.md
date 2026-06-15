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
## P1 — lightbulb + shell (spotlight, driven cursor, lifecycle) — TODO
## P2 — scene-spotlight + 3D popups (premium, primitive-composed) — TODO
## P3 — accessibility + responsive — TODO
## P4 — verification + capstone — TODO

## Criteria ledger (C1–C13)
| # | Criterion | Status |
|---|---|---|
| C1 | Lightbulb present + glowing | TODO |
| C2 | First-visit auto-launch + gate | TODO |
| C3 | Driven cursor | TODO |
| C4 | DOM-chrome spotlight | TODO |
| C5 | Controls work | TODO |
| C6 | Scene spotlight | TODO |
| C7 | 3D artifact in popup (one renderer) | TODO |
| C8 | Premium popup type + composition | TODO |
| C9 | Reduced-motion path | TODO |
| C10 | Keyboard + focus + ARIA | TODO |
| C11 | Responsive (4 viewports) | TODO |
| C12 | No regression | TODO |
| C13 | Capstone WOW (advocate 0 MUST-FIX) | TODO |
