# PROD-FINISH — App Reality preview-as-app to TRUE PRODUCTION (your eyes, real use)

ROLE: You are headless Claude Code on Logan's Mac. Finish the App Reality "preview-as-app" to PRODUCTION
quality: kill two real defects Logan + Claude caught by eye in the rendered frames, then prove the WHOLE
preview-as-app works visually AND functionally across every hub × every viewport. Self-heal with NO
iteration limit until the acceptance gate passes. Then write the completion marker and STOP.

WORKING DIR: /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing  (git root is one level up).
BRANCH: prism-editor-build.

MODEL GUARD: You must run as claude-opus-4-8. Fable-5 is DOWN and silently falls back to opus — that is
fine (opus IS the target). For ANY subprocess that takes --model, pin claude-opus-4-8 explicitly; never
trust the label.

RESUMABLE — FIRST ACTION: read kid-kode-landing/notes/verification/PROD-FINISH-PROGRESS.md.
- If it exists, continue from the first non-DONE phase. Run `git status` first; if a phase is half-applied,
  finish/repair it before moving on.
- If it does NOT exist, create it (phase table A/B/C = TODO) AND create the report skeleton (bottom of this
  file), then start at Phase A.

LOGAN'S BAR (non-negotiable): photoreal / premium 4K motion-graphics; NOTHING flat/cold/AI-built;
"acceptable" or "passes" == FAIL — the bar is WOW + true production. The editor's real home is a
CONSTRAINED preview-pane (chat on the left) and desktop, so the constrained + desktop result matters most;
mobile + constrained must be lightning fast. DESIGN-REFERENCES.md (docs/prism/) is the required toolkit —
combine techniques for signature wow; include a dependency-usage table in the report.

DECISIONS (locked — never stop to ask):
- D1. Premium-first, code-driven. Procedural PBR + the DESIGN-REFERENCES toolkit. NO new heavy deps. fal
  only if a hero genuinely needs a new image (budget OK; ledger it in notes/verification/app-reality/
  fal-ledger.json) — strongly prefer procedural.
- D2. NO purple anywhere. Observatory-Brass (graphite/bone/brass/ice). One renderer (Three.js r184+ / TSL /
  WebGPU) — no 2nd renderer. No stock icons. No diffusion-drawn letterforms (INV-11 real outlines).
- D3. Additive schema only; canonical viewModes only (galaxy | canvas | preview-app). DOM/navigator only in
  editor overlays (FP-05 safe).
- D4. Prior deliberate overrides STAND: canvas camera FREE; preview-app camera LOCKED + full-bleed.
- D5. NO iteration cap on the self-heal loop. Keep fixing + re-verifying until EVERY criterion C1–C13
  passes. Do not lower the bar; do not declare done early.
- D6. AUTO-CKPT each verified phase, message "PROD-FINISH AUTO-CKPT: <phase>". Standard exclusions
  (mock-app.prism; ralph-state.json + backups; *.bak-*; live-graph.json backups; verification/**/backups;
  .claude/worktrees). Verify `git ls-files | grep -c worktrees` == 0. NEVER `git add -A` mid-edit; add
  targeted files. Secret-leak check (no FAL_KEY / tokens) before every commit.
- D7. Poll kid-kode-landing/notes/LOGAN-INBOX.md at each phase boundary; honor any directive there.

THE TWO DEFECTS (frame-confirmed by Logan + Claude — diagnosis to verify, not blindly assume):

DEFECT 1 — the "full-bleed" hub surface is actually an OVAL on flat corners with a STIPPLED/dithered edge
on EVERY landscape viewport (desktop, tablet, constrained). It only reads full-bleed on the tall mobile
portrait viewport. Architecture (already in code): `HubSceneBackground` / `buildHubSkyGradient`
(src/components/editor/graph/GraphScene.tsx ~L3199) is a camera-centered gradient skybox sphere that DOES
fill the frustum; `SceneBackdropLayer` (~L1826) draws the hub backdrop IMAGE as a feathered "pool" plane,
feathered by `getBackdropFalloffTexture` (~L3257) — a 256px 8-bit radial-alpha CANVAS gradient. The
symptoms map to: (a) the pool ellipse does not cover wide viewports, so the rich dark pool sits centered
and the skybox's flatter vignette shows in the corners → reads as "oval pasted on a background"; (b) the
8-bit falloff BANDS/STIPPLES at its edge; (c) the skybox corners read as flat blue-grey, not atmosphere.

DEFECT 2 — the Arrival hub (s1-arrival) hero watch is PRESENT on mobile but ABSENT / INVISIBLE on desktop
and tablet. The headline first screen is empty nebula + two lines of text on the widest, most-common
viewports. Likely a responsive-placement gap (src/app/page.tsx device-pick + the node's responsiveScenePos)
and/or camera framing and/or lighting on wide viewports. (Other hubs, e.g. s2-movement, DO show their
content — Arrival's hero is the outlier.)

PHASES — each: diagnose → fix → verify (DPR-2 frames + NUMERIC) → AUTO-CKPT.

PHASE A — FULL-VIEWPORT ATMOSPHERE (kill oval / stipple / flat-corners).
Make the hub surface fill the ENTIRE rectangle edge-to-edge on every aspect, with a SMOOTH (non-dithered)
feather and PREMIUM atmospheric corners — no visible elliptical boundary, no flat-background corners, no
contrast cliff between the pool and the skybox. Your call on method; options: scale the backdrop pool to
COVER the viewport aspect (cover, not a fixed centered ellipse) and/or blend the pool into the skybox so
the boundary is imperceptible; replace the 8-bit falloff with a smooth analytic alpha (shader/TSL
smoothstep) or a high-res blue-noise-dithered alpha with LinearFilter (no ordered-dither banding); enrich
the skybox corners with subtle nebula/noise/depth so even pure skybox reads as atmosphere matching the
pool's character; ensure the skybox base never resolves to a flat uniform blue-grey. Keep the locked-preview
look premium and the canvas-orbit parallax intact.
VERIFY A — write scripts/prod-finish/atmosphere.mjs (extend the existing p9-appfeel.mjs / verify-editor-
runtimes.mjs harness): for ALL hubs × {desktop 1440×900, tablet 1024×768, constrained 880×600, mobile
390×844}, capture DPR-2 frames into notes/verification/prod-finish/atmosphere/ AND sample corner-luma (4
corners) + mid-edges + center. Assert (i) no corner is a flat plateau diverging from the scene (no hard
step / contrast cliff), (ii) NO elliptical mask edge, (iii) the feather region is smooth (no banding).
Write atmosphere-log.json. PASS = every hub × every viewport fills edge-to-edge, smooth, atmospheric
corners. (Criteria C1–C3.)

PHASE B — HERO PRESENT + LIT (every hub, every viewport).
Ensure every hub's hero / primary product is present, correctly placed, and well-lit on desktop, tablet,
constrained, AND mobile. Fix the Arrival watch on desktop+tablet (responsive placement + camera framing +
premium key/fill/rim lighting via the existing T0/T1/T2 system) so it is a punchy, clearly-visible hero. NO
hub may render as empty atmosphere + text only.
VERIFY B — write scripts/prod-finish/heroes.mjs: for ALL hubs × the 4 viewports, capture DPR-2 frames into
notes/verification/prod-finish/heroes/ AND numerically confirm the hero renders within the frustum with
adequate on-screen coverage + luminance (use the existing node-world-pos / corner-luma dev hooks; if one
returns null, add a reliable hook). Write heroes-log.json. PASS = the product is clearly visible + lit on
every hub × every viewport. (Criteria C4–C5.)

PHASE C — PRODUCTION FUNCTIONAL VALIDATION + CAPSTONE.
Drive the running app like a real user across ALL hubs × the 4 viewports and prove production behavior:
hub→hub navigation (rail + prev/next + hash; content changes; no blank hub); function-bound click → premium
holographic overlay (real raycast click); device-mode switch (auto-from-viewport + manual Desktop/Tablet/
Mobile, each the real responsive layout); preview camera LOCKED (drag = zero move) + the configured view +
the P2 camera journey plays; edit-in-preview (toggle / select / edit). 0 console errors everywhere. NO
regressions: tsc 0-new; vitest 0-fail (existing baseline only); primitives ≥ 409; prebuilt elements ≥ 40;
nothing removed from the catalog or element library.
Then a FRESH-CONTEXT capstone advocate drives the app as a NON-TECHNICAL user at DPR-2 with ZOOM CROPS,
judging vs a pro 3D designer + "visibly SMASHES Slider Revolution", and MUST explicitly confirm: (a) NO
oval / seam / flat-corners / stipple on any landscape viewport, (b) hero present + lit on every hub × every
viewport, (c) the experience is premium + intuitive + production-ready. 0 MUST-FIX to pass.
VERIFY C — write scripts/prod-finish/production.mjs capturing the journey frames into notes/verification/
prod-finish/production/ + production-log.json (per hub per viewport: nav ok, overlay ok, lock ok, errors:0).
Write the capstone verdict (frame-cited) into the report. (Criteria C6–C13.)

SELF-HEAL (NO CAP): if ANY criterion C1–C13 fails at any verify step, FIX and RE-VERIFY. Repeat with no
iteration limit until all pass. "Acceptable" == FAIL.

ON TRUE COMPLETION (all C1–C13 pass + capstone 0 MUST-FIX):
1. Write the full report to kid-kode-landing/notes/PROD-FINISH-REPORT.md: what changed per defect, a
   dependency-usage table, the numeric proofs (atmosphere/heroes/production logs), the capstone verdict,
   honest flags, the fal ledger line.
2. Final AUTO-CKPT commit (secret-leak check first).
3. Write this EXACT line as the LAST line of the report — ONLY when truly done (the sentinel + chain key
   off it; NEVER write it on a partial run):
   PROD-FINISH: RUN COMPLETE
4. STOP. Do not start any other workstream.

REPORT SKELETON (create at run start for visibility; fill as you go; the marker is added ONLY at the end):
---
# PROD-FINISH — preview-as-app to production
(status: in progress)

## Phase A — full-viewport atmosphere (oval/stipple/flat-corner fix) — TODO
## Phase B — hero present + lit (Arrival watch on desktop/tablet) — TODO
## Phase C — production functional validation + capstone — TODO
---
