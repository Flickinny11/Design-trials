# QUEUE-PREP — progress ledger

Headless research+spec agent. Scope: web-research current (June 2026) tooling + DRAFT two
build prompts as markdown. NO code, NO browser, NO git. Leave files untracked.

Model contract: opus-4-8 (verify via modelUsage; never trust label).

## WRITE-ONLY allowlist (hard scope lock)
- `THREE-D-BACKGROUNDS-PROMPT.md`            (git root)
- `GUIDED-TIPS-PROMPT.md`                     (git root)
- `kid-kode-landing/notes/QUEUE-PREP-RESEARCH.md`
- `kid-kode-landing/notes/QUEUE-PREP-REPORT.md`
- `kid-kode-landing/notes/verification/QUEUE-PREP-PROGRESS.md`  (this file)

Everything under src/public/scripts and every existing prompt/spec/doc is READ-ONLY.

## Steps
- [x] S0  create progress ledger + report skeleton (status: in progress)
- [ ] S1  read templates (NODE-EDITOR-PROMPT.md, PROD-FINISH-PROMPT.md), confirm model
- [ ] S2  read docs/prism specs + src/lib/prism-graph/types.ts (schema, viewModes, PrismHub.background)
- [ ] S3  read docs/prism/DESIGN-REFERENCES.md (existing toolkit baseline)
- [ ] S4  research — 3D background library (depth/parallax, volumetric, gaussian-splat, particle, fal models)
- [x] S5  research — guided tips / onboarding (tour, spotlight, coach-mark, cursor-driving, 2026 libs)
- [x] S6  write QUEUE-PREP-RESEARCH.md (every finding: date searched, tool, why better)
- [x] S7  write THREE-D-BACKGROUNDS-PROMPT.md (match template structure exactly)
- [x] S8  write GUIDED-TIPS-PROMPT.md (match template structure exactly)
- [x] S9  self-check both prompts against FORMAT checklist (all elements present; grep-verified)
- [x] S10 write full QUEUE-PREP-REPORT.md + final completion marker line ("QUEUE-PREP: RUN COMPLETE" is the last line)
- [x] S11 STOP (no commit, no other work) — DONE. Files left untracked for the monitor to commit.

## Log
- S0 — ledger + report skeleton created. Status: in progress.
- S1 — read NODE-EDITOR-PROMPT.md + PROD-FINISH-PROMPT.md (template structure captured). Model env = claude-opus-4-8 (verified via env block).
- S2 — read src/lib/prism-graph/types.ts. Key: PrismHub.background?:PrismHubBackgroundLayer[] (attachment ∈ viewport-fixed|camera-locked|parallax|world|infinite-environment; sourceUrl/z/opacity/parallaxDepth). PrismHub.cameraKeyframes?:PrismKeyframe[] (coordinateSpace 'camera', P2 journeys). renderMode sprite|plane|parallax-plane|mesh|text. depthMapUrl/meshUrl/materialSpec/lightingSpec/depthLayer(environment..overlay). Tiers T0/T1/T2.
- S3 — read DESIGN-REFERENCES.md (Feb 2026 / upd Jun 10). Existing toolkit: TSL/WebGPU, postprocessing(pmndrs), OGL, gl-noise/simplex-noise, ray-march SDF (iq), Locomotive v5/Lenis, mouse-follower/magnetic-elements/Cursify, Rapier, Spline/Rive/Unicorn, Gaussian splat (gsplat.js, @mkkellogg/gaussian-splats-3d). Canvas §4: splat via Spark (@sparkjsdev/spark); parallax-plane via FAL depth-anything/v2. Primitives in src/lib/prism/animatable/primitives (clouds.ts, nebula.ts already exist; ~406+ catalog).
- S4 — research 3D backgrounds DONE (searches: Gaussian splat/Spark 2.0, depth-anything V3/Depth Pro, fal FLUX.2, volumetric raymarch TSL, GPU compute particles).
- S5 — research guided tips DONE (searches: tour libs driver.js/Onborda/Shepherd/Joyride/userTourKit, cursor-driven/Jimo Smart Cursors, a11y prefers-reduced-motion/WCAG 2.2/focus).
- S6 — QUEUE-PREP-RESEARCH.md written (Domain A + B + DESIGN-REFERENCES proposals + instinct-vs-newest scorecard).
- S7 — THREE-D-BACKGROUNDS-PROMPT.md written (git root). 6 phases P0-P5, 14 criteria, full FORMAT.
- S8 — GUIDED-TIPS-PROMPT.md written (git root). 5 phases P0-P4, 13 criteria, full FORMAT.
- S9 — self-check grep PASS for both: MODEL GUARD, LOGAN BAR (acceptable==FAIL), DECISIONS, INVARIANTS, FORBIDDEN, SUCCESS CRITERIA, VERIFICATION GATE (advocate Opus 4.8 1M + numeric harness + NO-CAP self-heal + chat-monitor), completion marker, resumable ledger, AUTO-CKPT, LOGAN-INBOX, canonical viewModes, INV-11, NO purple, r184.
- S10 — writing report.
