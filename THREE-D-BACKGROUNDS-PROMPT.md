# THREE-D-BACKGROUNDS — a library of massive, depth-scattered 3D hub backgrounds (image + real-3D hybrid)
# Bar is WOW + true production. Logan judges frames; the advocate + monitor are hard pre-judges. Interactive + visual verification, no exceptions.

ROLE: You are headless Claude Code on Logan's Mac. Build a **library of reusable 3D BACKGROUNDS**
for Prism hubs/scenes: each one a massive, depth-scattered, animated, customizable environment —
an **image + REAL-3D-sprinkle HYBRID** (a base image/diffusion layer with real depth-scattered 3D
elements layered into actual scene Z), **CAMERA-JOURNEY ready** (works with the P2
`PrismHub.cameraKeyframes` journeys), premium on desktop + lightning-fast on mobile/constrained,
each a **droppable, customizable asset bound to a hub background layer** (`PrismHub.background`).
Self-heal with NO iteration cap until the acceptance gate passes. Then write the completion marker
and STOP.

WORKING DIR: /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing  (git root is one level up).
BRANCH: prism-editor-build (push every verified phase).

MODEL GUARD: You must run as **claude-opus-4-8**. Fable-5 is DOWN and silently falls back to opus —
that is fine (opus IS the target). Confirm `modelUsage == claude-opus-4-8` at start AND after any
resume; record in the ledger; NEVER trust the label. For ANY subprocess that takes `--model`, pin
claude-opus-4-8 explicitly.

RESUMABLE — FIRST ACTION: read kid-kode-landing/notes/verification/THREE-D-BACKGROUNDS-PROGRESS.md.
- If it exists, continue from the first non-DONE phase. Run `git status` first; if a phase is
  half-applied, finish/repair it before moving on.
- If it does NOT exist, create it (phase table P0–P5 = TODO) AND create the report skeleton (bottom
  of this file), then start at P0.

## READ FIRST (authoritative — do not re-derive)
- docs/prism/PRISM-CANVAS-EDITOR-SPEC.md §4 render-mode catalogue (plane/parallax-plane/mesh/splat/
  text/rive/code), §7 lighting tiers, §2 invariants.
- docs/prism/PRISM-RUNTIME-SPEC.md §9 renderer foundations (INV-R1/R11/R12), camera constraints.
- src/lib/prism-graph/types.ts — `PrismHub.background?: PrismHubBackgroundLayer[]`
  (attachment ∈ viewport-fixed|camera-locked|parallax|world|infinite-environment; sourceUrl/z/
  opacity/parallaxDepth), `PrismHub.cameraKeyframes?` (coordinateSpace 'camera'), `renderMode`,
  `depthMapUrl`, `depthLayer` ('environment'|'background'|…), `LightingTier` T0/T1/T2.
- docs/prism/DESIGN-REFERENCES.md — the REQUIRED premium toolkit (TSL/WebGPU, postprocessing,
  noise/FBM, ray-march SDF, Gaussian splat). Combine techniques for signature wow; report a
  dependency-usage table.
- notes/QUEUE-PREP-RESEARCH.md §DOMAIN A — the June-2026 tooling picks + the layer-stack synthesis
  this run implements (read it; it IS the build plan's research base).
- src/lib/prism/animatable/primitives/ — `nebula.ts`, `clouds.ts` and the ~406-primitive catalog
  already exist. COMPOSE/extend them; do not reinvent.

## RE-VERIFY CURRENT (training stale ~1yr) — do at start, record in ledger
Re-pull current versions (npm registry): `three` (confirm r184+ / `three/webgpu` + `three/tsl`),
`@sparkjsdev/spark` (confirm Spark 2.0 LoD + `.SOG`/`.SPZ` support), the fal client + current
`fal-ai/flux-2-*` model ids + the current `depth-anything` model id on fal. Use newest stable;
NEVER downgrade a dep to silence an error. If a pick is unreachable, fall back per the DECISIONS
order and ledger it — do not block.

LOGAN'S BAR (non-negotiable): photoreal / premium 4K motion-graphics; NOTHING flat/cold/AI-built;
"acceptable" or "passes" == FAIL — the bar is WOW + true production. The editor's real home is a
CONSTRAINED preview-pane (chat on the left) and desktop, so the **constrained + desktop result
matters most**; **mobile + constrained must be lightning fast**. A background that reads as a flat
gradient, a pasted oval, a 2D star texture, or a static skybox is a FAIL.

## DECISIONS (locked — never stop to ask)
- D1. **Procedural-first, code-driven.** The premium core is procedural (TSL volumetric raymarch +
  GPU-compute particles). fal base images are the "image half" of the hybrid + a richness/fallback
  booster, NOT the default for every background. Strongly prefer procedural where it reads premium.
- D2. **The hybrid background = a typed LAYER STACK** bound to `PrismHub.background`, composited
  back-to-front (per QUEUE-PREP-RESEARCH §A6): (1) far env skybox = procedural volumetric nebula OR
  fal base plate [`infinite-environment`]; (2) mid depth = depth-displaced plate(s) [`parallax`/
  `world`]; (3) scatter = GPU-compute particle/star field in real Z [`world`]; (4) optional Spark
  splat [`world`, desktop/T2 only]; (5) near FX = camera-locked motes/godrays. Every layer is a
  real `PrismHubBackgroundLayer` with customizable `z`/`opacity`/`parallaxDepth`.
- D3. **Tooling order** (use newest reachable; fall back without blocking): volumetric = TSL
  raymarch (Beer-Lambert + Henyey-Greenstein phase + light-march) → WebGL2 billboard/FBM fallback;
  particles = WebGPU compute `instancedArray` → instanced `THREE.Points` fallback; base image =
  `fal-ai/flux-2` Turbo/Flex → existing FLUX path; depth = fal `depth-anything` v2 (proven default)
  → v3 only if reachable; splat = `@sparkjsdev/spark` 2.0 `.SOG`/`.SPZ`.
- D4. **Tiering (INV-R: T0/T1/T2).** Desktop/T2 = full raymarch + compute particles + (opt) splat;
  T1 = reduced raymarch steps + compute particles; T0/mobile = billboard/FBM env + instanced
  points, splat DROPPED. `'auto'` capability detection picks the tier; heavy paths are NEVER the
  default. Mobile/constrained must hold a smooth frame rate.
- D5. **Camera-journey ready.** Backgrounds live in scene Z and are read by the runtime against
  `PrismHub.cameraKeyframes` — the camera flies THROUGH the depth layers with true parallax. No
  special-casing per background; no layer welds to the camera except the explicit `camera-locked`
  near-FX layer.
- D6. **Droppable + customizable asset.** Each library entry is a named preset (e.g. "Brass Nebula",
  "Ice Field", "Observatory Deep") selectable/applied in the editor, writing a `background` layer
  stack onto the hub via the additive schema ONLY. Re-skinnable params (palette within
  Observatory-Brass, density, drift speed, depth spread) round-trip through save/reload.
- D7. **NO purple anywhere.** Observatory-Brass palette (graphite/bone/brass/ice). One renderer
  (Three.js r184+/TSL/WebGPU) — no 2nd renderer. No stock icons. No diffusion-drawn letterforms
  (backgrounds carry NO text; INV-11; fal negative prompt MUST include "no text, no letters, no
  labels"). NO new heavy dependency beyond the DECISIONS-named ones; if one is genuinely needed,
  ledger the justification.
- D8. **fal budget-aware.** Same fal account; cumulative ledger at
  notes/verification/three-d-backgrounds/fal-ledger.json (model, params, cost, why). Reuse a
  generated plate across hubs where possible; prefer procedural.
- D9. **AUTO-CKPT each verified phase**, message "THREE-D-BACKGROUNDS AUTO-CKPT: <phase>". Standard
  exclusions (mock-app.prism; ralph-state.json + backups; *.bak-*; live-graph.json backups;
  verification/**/backups; .claude/worktrees). Verify `git ls-files | grep -c worktrees` == 0.
  NEVER `git add -A` mid-edit; add targeted files. Secret-leak check (no FAL_KEY / tokens) before
  every commit.
- D10. **NO iteration cap** on the self-heal loop. Keep fixing + re-verifying until EVERY criterion
  C1–C14 passes + the capstone advocate returns 0 MUST-FIX. Do not lower the bar; do not declare
  done early.
- D11. Poll kid-kode-landing/notes/LOGAN-INBOX.md at each phase boundary; honor any directive there.

## INVARIANTS (numbered — binding throughout)
- INV-1. **One renderer.** Three.js r184+ / TSL / WebGPU with WebGL2 fallback. NO second renderer,
  no CDN-vs-bundled `three` split, no PixiJS in the visible path.
- INV-2. **Additive schema only.** Backgrounds are expressed via existing/extended optional fields
  (`PrismHub.background`, `PrismHubBackgroundLayer`, `depthLayer`, `renderMode`, `depthMapUrl`).
  Never delete/rename an existing field. Legacy hubs without `background` render unchanged.
- INV-3. **Canonical viewModes only:** galaxy | canvas | preview-app. Backgrounds render in all
  three where the hub is shown; no new viewMode literal.
- INV-4. **Position/appearance/behavior come from the node/hub schema ONLY** — no hard-coded
  per-hub background hacks in component code. The same schema the editor writes is what the runtime
  reads (one source of truth).
- INV-5. **Non-destructive compile (INV-17/FP-04).** compile*/organize*/preview* MUST NOT write to
  scenePosition/editorTransform/canvasTransform/compiledTransform or any hub.layout field. Applying
  a background writes only `PrismHub.background` (+ optional `cameraKeyframes` left untouched here).
- INV-6. **Text rule (INV-11).** No diffusion-drawn letterforms, no `THREE.TextGeometry`, no DOM
  text overlays in runtime. Backgrounds carry no text at all.
- INV-7. **Secrets (INV-R13).** FAL_KEY / any token NEVER in graph data, src/, or the client
  bundle. Generation runs server-side; the graph holds only resolved asset URLs / capability refs.
- INV-8. **DOM/navigator only in editor overlays** (FP-05 safe). Runtime/node modules touch only
  `window.devicePixelRatio` (+ `navigator.gpu?.requestAdapter()` for capability detection in the
  capability-detector module, not in node code).
- INV-9. **NO purple.** Observatory-Brass design tokens only; `hub.color` never tints chrome.
- INV-10. **Tiered, never heavy-by-default** (INV-R9). The expensive path is gated by capability
  detection; `'auto'` degrades to T0/T1.

## FORBIDDEN PATTERNS (numbered — any hit is a defect, not a warning)
- FP-1. A background that renders as a flat 2D gradient / pasted oval / static star texture / flat
  skybox with no depth response to the camera journey.
- FP-2. A second renderer, a separate canvas for the background, or a DOM/CSS background faking 3D.
- FP-3. Per-hub hard-coded background logic in component code (bypassing `PrismHub.background`).
- FP-4. Heavy path (full raymarch / compute particles / splat) running by default on mobile/T0.
- FP-5. Writing scenePosition/editorTransform/hub.layout from a background apply/compile/preview fn.
- FP-6. Any text baked into a background; any `THREE.TextGeometry`/DOM text in runtime.
- FP-7. Raw secret in graph/src/bundle/logs; printing FAL_KEY; surfacing the literal "fal" in UI.
- FP-8. Downgrading a dependency or choosing an older API to silence an error (use ANTI-STUCK).
- FP-9. Purple anywhere; stock icons; fake brand assets.
- FP-10. Assertion-only "verification" (`expect(...).toBe`) standing in for real frame + numeric +
  interaction evidence.

## PHASES — each: contract → build → verify (DPR-2 frames + NUMERIC + interaction) → AUTO-CKPT

**P0 — CONTRACT + RE-VERIFY.** Confirm model + current tooling versions (above). Write the typed
background-library contract: the layer-stack model over `PrismHub.background`, the preset registry
shape, the tier map, and the capability-detector seam. Define the ≥3 launch presets ("Brass
Nebula", "Ice Field", "Observatory Deep") as DATA. No visible change yet; tsc clean.

**P1 — PROCEDURAL CORE (the premium engine).** Implement the TSL **volumetric nebula/atmosphere**
(Beer-Lambert absorption + Henyey-Greenstein phase + light-march self-shadow; WebGL2 billboard/FBM
fallback) and the **GPU-compute particle/star field** (`instancedArray` in real Z; instanced
`Points` fallback), both tiered (D4) and composing the existing `nebula.ts`/`clouds.ts` primitives.
These mount as `infinite-environment` + `world` background layers. (Criteria C1–C4.)

**P2 — HYBRID IMAGE LAYER.** Wire the base-image plate (procedural-first; fal `flux-2` only where a
plate genuinely lifts the look, ledgered) and the **depth-displaced parallax** path
(`renderMode: 'parallax-plane'` + `depthMapUrl` via fal `depth-anything`) so the "image half" gains
real depth and parallaxes with the camera. Server-side generation; URLs into the schema only.
(Criteria C5–C6.)

**P3 — SPLAT (optional premium, desktop/T2).** Integrate a `@sparkjsdev/spark` 2.0 splat as a
`world` layer for at least one photoreal "captured environment" preset, LoD-streamed, gated to
desktop/T2 with a procedural/still fallback on lower tiers. (Criterion C7.)

**P4 — LIBRARY UX + CAMERA-JOURNEY READINESS.** Make every preset a **droppable, customizable
asset**: selectable in the editor, applied to a hub by writing `PrismHub.background` (additive,
round-trips), with live-customizable params (palette/density/drift/depth-spread). Prove a preset
renders correctly under a `PrismHub.cameraKeyframes` journey (the camera flies through the depth
layers with true parallax) in preview-app. (Criteria C8–C11.)

**P5 — VERIFICATION + SIGN-OFF.** Numeric harness + fresh-context advocate + monitor (see GATE).
Drive the real app: apply each preset to a hub, customize a param, play the camera journey, switch
device modes, across DESKTOP + TABLET + CONSTRAINED + MOBILE. 0 MUST-FIX. No regression.
(Criteria C12–C14.)

## SUCCESS CRITERIA (atomic — each needs DPR-2 frames + a NUMERIC measure + a real interaction)
- **C1 Depth, not flat.** A procedural background shows measurable parallax between two camera-journey
  waypoints (near and far layers shift by different on-screen pixel deltas — numeric proof, not a
  static frame). Evidence: 2 DPR-2 frames + per-layer pixel-delta table.
- **C2 Volumetric atmosphere.** The nebula reads as raymarched volume (soft density falloff, internal
  light scatter), not a flat plane: edge-feather + luminance-gradient stats across the frame show no
  hard contrast cliff / banding. Evidence: DPR-2 frame + luma-histogram/edge stats.
- **C3 Depth-scattered particles render in real Z.** Star/dust field present with a measured count
  and a visible near/far size+parallax spread. Evidence: frame + particle-count + Z-spread metric.
- **C4 Tiering verified.** T2 path (raymarch+compute) and T0/mobile fallback (billboard+points) both
  render the SAME preset acceptably; mobile holds a smooth frame budget. Evidence: T2 + T0 frames +
  frame-time numbers per tier.
- **C5 Hybrid image layer.** A base plate composites behind the procedural layers without a visible
  seam/oval; corners read as atmosphere. Evidence: DPR-2 frame + corner-luma sample.
- **C6 Parallax-plane depth.** A `parallax-plane` plate displaces by its depth map and parallaxes
  with the camera (measured shift vs a flat plate control). Evidence: 2 frames + shift delta.
- **C7 Splat premium (desktop/T2).** A Spark splat preset renders photoreal on desktop and the
  documented fallback renders on mobile/T0 (no hard error). Evidence: desktop splat frame + mobile
  fallback frame + console-error count 0.
- **C8 Droppable asset.** Selecting a preset in the editor applies it to a hub and it renders in
  galaxy + canvas + preview-app. Evidence: before/after frames in all 3 view modes.
- **C9 Customizable + round-trips.** Changing a preset param (e.g. drift speed / density / palette
  within brass) visibly changes the render AND survives save→reload (re-read schema). Evidence:
  param-A vs param-B frames + the persisted `background` JSON.
- **C10 Schema-only.** The applied background lives entirely in `PrismHub.background` (additive);
  legacy hubs without it render unchanged. Evidence: the diff of the hub JSON + a legacy-hub frame.
- **C11 Camera-journey ready.** Under a `cameraKeyframes` journey in preview-app, the background
  parallaxes through its depth layers smoothly (no clipping, no exposed scene edge / blank corner).
  Evidence: ≥3 journey frames + a "no blank corner" corner-luma check.
- **C12 Cross-viewport.** Every preset renders premium on desktop 1440×900, tablet 1024×768,
  constrained 880×600, AND mobile 390×844. Evidence: the 4-viewport frame grid per preset.
- **C13 No regression.** tsc 0-new; vitest 0-fail (existing baseline only); primitives ≥ baseline;
  prebuilt elements ≥ baseline; nothing removed from the catalog; 0 console errors in the driven app.
  Evidence: command outputs + console-error count.
- **C14 Capstone WOW.** The fresh-context advocate, driving it as a non-technical user, confirms the
  backgrounds are premium 4K motion-graphics quality (visibly beat a generic Spline/stock background)
  with 0 MUST-FIX. Evidence: frame-cited advocate verdict in the report.

## VERIFICATION GATE (the bar we actually use — all four, every phase verify + at sign-off)
1. **NUMERIC HARNESS.** Write scripts/three-d-backgrounds/*.mjs (extend the existing
   verify-editor-runtimes.mjs / p9-appfeel.mjs harness): for ALL presets × {desktop 1440×900,
   tablet 1024×768, constrained 880×600, mobile 390×844}, capture DPR-2 frames into
   notes/verification/three-d-backgrounds/<phase>/ AND emit the per-criterion numeric logs
   (parallax pixel-deltas, luma/edge stats, particle count + Z-spread, frame-time per tier, corner
   luma). NEVER assert-only; measure pixels off the REAL render.
2. **FRESH-CONTEXT COMPUTER-USE ADVOCATE (Opus 4.8, 1M).** A `user-advocate` subagent with NO build
   context DRIVES the live app like a non-technical user at DPR-2 with ZOOM CROPS: apply each preset,
   play the camera journey, customize a param, switch device modes. It judges vs a pro 3D
   motion-designer ("does this look like a $10k/min premium environment or an AI-built gradient?"),
   CITES a visual frame per verdict, and holds MUST-FIX power. A verdict without cited evidence is
   INVALID (anti-rubber-stamp).
3. **NO-CAP SELF-HEAL LOOP.** If ANY C1–C14 fails at any verify step, root-cause → fix → re-verify.
   No iteration limit. After ~2 fails on the same criterion, web-search the CURRENT (June 2026)
   correct approach (ANTI-STUCK); never downgrade a dep, never lower the bar.
4. **CHAT-MONITOR END REVIEW.** Before writing the completion marker, the monitoring session does a
   final review of the report + evidence; unresolved MUST-FIX blocks completion.
PASS = all C1–C14 green + advocate 0 MUST-FIX + monitor review clean.

## ON TRUE COMPLETION (all C1–C14 pass + capstone 0 MUST-FIX + monitor clean)
1. Write the full report to kid-kode-landing/notes/THREE-D-BACKGROUNDS-REPORT.md: per-criterion
   (C1–C14) evidence (frames + numeric + interaction); the layer-stack/preset architecture + which
   schema fields carry it; the tooling/versions wired (+ a dependency-usage table); the tier map +
   measured frame-times; the fal ledger line; honest flags + what's procedural vs fal vs splat; the
   advocate verdict; AUTO-CKPT hashes. Frames under notes/verification/three-d-backgrounds/.
2. Final AUTO-CKPT commit (secret-leak check first).
3. Add this EXACT line as the LAST line of the report — ONLY when truly done (the sentinel + chain
   key off it; NEVER write it on a partial/interrupted run):
   THREE-D-BACKGROUNDS: RUN COMPLETE
4. STOP. Do not start any other workstream.

REPORT SKELETON (create at run start for visibility; fill as you go; marker added ONLY at the end):
---
# THREE-D-BACKGROUNDS — 3D hub background library
(status: in progress)

## P0 — contract + re-verify current tooling — TODO
## P1 — procedural core (volumetric nebula + GPU-compute particles, tiered) — TODO
## P2 — hybrid image layer (fal plate + parallax-plane depth) — TODO
## P3 — splat preset (Spark 2.0, desktop/T2) — TODO
## P4 — library UX + camera-journey readiness — TODO
## P5 — verification + capstone — TODO
---
