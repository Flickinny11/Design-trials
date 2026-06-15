# GUIDED-TIPS — a glowing-lightbulb first-visit walkthrough where Prism DRIVES the screen
# Bar is WOW + true production. Logan judges frames; the advocate + monitor are hard pre-judges. The advocate must TRIGGER and STEP THROUGH the walkthrough.

ROLE: You are headless Claude Code on Logan's Mac. Build a **guided-tips walkthrough**: a glowing
**lightbulb affordance (top-right)** that launches a first-visit walkthrough where **Prism drives
the screen** — an **animated cursor moves + highlights areas**, **high-tech popups appear with the
relevant artifact animated in 3D + premium-type explanation + Skip/Close controls**; built from the
**406+ primitives + DESIGN-REFERENCES**; **skippable, dismissible, first-visit-aware,
re-triggerable from the lightbulb**. Self-heal with NO iteration cap until the acceptance gate
passes. Then write the completion marker and STOP.

WORKING DIR: /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing  (git root is one level up).
BRANCH: prism-editor-build (push every verified phase).

MODEL GUARD: You must run as **claude-opus-4-8**. Fable-5 is DOWN and silently falls back to opus —
that is fine (opus IS the target). Confirm `modelUsage == claude-opus-4-8` at start AND after any
resume; record in the ledger; NEVER trust the label. For ANY subprocess that takes `--model`, pin
claude-opus-4-8 explicitly.

RESUMABLE — FIRST ACTION: read kid-kode-landing/notes/verification/GUIDED-TIPS-PROGRESS.md.
- If it exists, continue from the first non-DONE phase. Run `git status` first; if a phase is
  half-applied, finish/repair it before moving on.
- If it does NOT exist, create it (phase table P0–P5 = TODO) AND create the report skeleton (bottom
  of this file), then start at P0.

## READ FIRST (authoritative — do not re-derive)
- docs/prism/PRISM-CANVAS-EDITOR-SPEC.md + PRISM-NODE-EDITOR-SPEC.md — the editor surfaces the
  walkthrough explains (galaxy/canvas/preview-app, toolbar groups, Inspector, the lightbulb's home).
- docs/prism/PRISM-RUNTIME-SPEC.md §9 (one renderer; INV-R1/R11), camera constraints.
- docs/prism/DESIGN-REFERENCES.md — the REQUIRED premium toolkit. §4 postprocessing (bloom/
  vignette/DoF for the scene-spotlight), §7 cursor (`mouse-follower` / lerped cursor — DRIVE this
  programmatically), TSL/glass/holographic. Combine techniques; report a dependency-usage table.
- notes/QUEUE-PREP-RESEARCH.md §DOMAIN B — the June-2026 onboarding/tour tooling survey + the
  bespoke-controller decision this run implements (read it; it IS the build plan's research base).
- src/lib/prism/animatable/primitives/ — the ~406-primitive catalog (glass/dispersion, holographic,
  glitch-in, depth-rotate, kinetic-text). The popup artifacts + transitions COMPOSE these.
- src/lib/prism-graph/types.ts — the additive schema; the walkthrough is editor-overlay UI, not new
  graph schema (any persisted "seen"/step config is local or a small additive store, not graph mutation).

## RE-VERIFY CURRENT (training stale ~1yr) — do at start, record in ledger
Survey the current (June 2026) onboarding/spotlight landscape per QUEUE-PREP-RESEARCH §B and confirm
the pick: **a thin BESPOKE walkthrough controller** (a11y-first) that borrows **Driver.js's
spotlight-cutout technique** for DOM-chrome steps, **programmatically drives the existing
`mouse-follower`/lerped cursor**, and composes **scene-spotlight + 3D-artifact popups** from the
406+ primitives (the part no library can do against a WebGPU canvas). If you vendor Driver.js purely
as the DOM-spotlight primitive, confirm its current version + zero-dep + React-19 fit; otherwise
build the spotlight bespoke (default). Re-pull current versions of any dep touched. NEVER downgrade.

LOGAN'S BAR (non-negotiable): photoreal / premium 4K motion-graphics; NOTHING flat/cold/cheesy;
"acceptable" or "passes" == FAIL — the bar is WOW + true production. This must feel like a confident,
high-tech product demo (Prism driving the screen), not a generic tooltip tour. The editor's real
home is a CONSTRAINED preview-pane (chat on the left) and desktop, so the **constrained + desktop
result matters most**; **mobile + constrained must be lightning fast** and still legible.

## DECISIONS (locked — never stop to ask)
- D1. **Bespoke controller, a11y-first.** Build the walkthrough as a thin editor-overlay controller
  (step list = DATA), NOT a heavy off-the-shelf tour lib. Borrow Driver.js's spotlight-cutout
  technique (SVG mask / box-shadow scrim) for DOM-chrome steps; default to bespoke so we own a11y +
  the premium look. Reject Onborda/Joyride as the core (can't touch the WebGPU scene; Onborda ships
  no a11y).
- D2. **Prism drives the screen.** A synthetic **animated cursor** (the existing `mouse-follower` /
  lerped cursor pattern, DESIGN-REFERENCES §7, driven programmatically along authored step paths
  with magnetic-snap + skew feel) travels between targets and "clicks". Not a tooltip that teleports.
- D3. **Two highlight modes per step:** (a) **DOM-chrome spotlight** — scrim with a smooth cutout
  around a toolbar/Inspector region; (b) **SCENE spotlight** — dim the live 3D scene except a framed
  artifact (in-scene vignette/scrim or a postprocessing focus pass — NO 2nd renderer). A step
  declares which it uses.
- D4. **High-tech popups.** Each step's popup shows the **relevant artifact animated in 3D**
  (a small in-scene framed view / mini view sharing the renderer — NO 2nd renderer, NO separate
  canvas) + a **premium-type explanation** (real MSDF text, INV-11) + **Skip** + **Close** always
  visible. Popup entrance/exit + the 3D artifact motion compose the 406+ primitives + DESIGN-
  REFERENCES (glass/holographic/glitch-in/kinetic-text). Observatory-Brass, NO purple.
- D5. **Lifecycle.** **First-visit-aware** (persist a "seen" flag in localStorage; auto-launch once
  on first visit). **Skippable** (Skip ends it immediately) + **dismissible** (Close + Esc + scrim
  click). **Re-triggerable** any time from the glowing lightbulb (top-right). Next/Back/step-dots
  for navigation.
- D6. **Accessibility (WCAG 2.2, 2026 normal).** Honor `prefers-reduced-motion` — fall back to
  static framed steps (no cursor fly, no heavy 3D motion) with controls intact. Focus-trap the
  active popup; full keyboard (Tab/Shift-Tab, Enter=next, Esc=close/skip, arrows=step); ARIA
  roles/labels on every step + the lightbulb. Visible focus ring (brass, not purple).
- D7. **One renderer.** Three.js r184+/TSL/WebGPU; the 3D popup artifacts share the single renderer.
  No 2nd renderer, no separate background canvas. DOM/navigator usage is allowed because the
  walkthrough is **editor-overlay UI** (FP-05 boundary), NOT runtime/node code.
- D8. **Schema discipline.** The walkthrough does not mutate the graph. Step definitions + "seen"
  state live in an editor-local store / localStorage (additive if persisted at all). No node
  position/behavior is changed by the tour (INV: position/behavior from node schema ONLY).
- D9. **AUTO-CKPT each verified phase**, message "GUIDED-TIPS AUTO-CKPT: <phase>". Standard
  exclusions (mock-app.prism; ralph-state.json + backups; *.bak-*; live-graph.json backups;
  verification/**/backups; .claude/worktrees). Verify `git ls-files | grep -c worktrees` == 0.
  NEVER `git add -A` mid-edit; add targeted files. Secret-leak check before every commit.
- D10. **NO iteration cap** on the self-heal loop. Keep fixing + re-verifying until EVERY criterion
  C1–C13 passes + the capstone advocate returns 0 MUST-FIX. Do not lower the bar; do not declare
  done early.
- D11. Poll kid-kode-landing/notes/LOGAN-INBOX.md at each phase boundary; honor any directive there.

## INVARIANTS (numbered — binding throughout)
- INV-1. **One renderer.** Three.js r184+/TSL/WebGPU + WebGL2 fallback. NO 2nd renderer, no separate
  canvas for the 3D popup artifacts (share the single scene/renderer).
- INV-2. **Additive / non-graph-mutating.** The walkthrough adds editor-overlay UI + a local store;
  it never deletes/renames a schema field and never edits the graph topology or node poses.
- INV-3. **Canonical viewModes only:** galaxy | canvas | preview-app. The lightbulb + walkthrough
  ride on top of these; no new viewMode literal.
- INV-4. **Position/behavior from node schema ONLY.** The tour reads/points at the app; it never
  changes what a node is or where it sits.
- INV-5. **Text rule (INV-11).** Explanation copy is real MSDF text (or DOM text in the overlay
  layer); never `THREE.TextGeometry` in the scene, never diffusion-drawn letterforms.
- INV-6. **DOM/navigator only in editor overlays** (FP-05 safe). The walkthrough is overlay UI, so
  DOM is fine HERE; runtime/node modules stay DOM-free except `window.devicePixelRatio`.
- INV-7. **Secrets (INV-R13).** No raw secret in src/bundle/logs.
- INV-8. **NO purple.** Observatory-Brass tokens only.
- INV-9. **No stock icons / fake brand assets.** The lightbulb + step iconography are bespoke
  (primitive/SDF/MSDF-built), premium, on-brand.
- INV-10. **Reduced-motion is a real path, not a stub** — it must visibly degrade gracefully and
  stay fully usable + controllable.

## FORBIDDEN PATTERNS (numbered — any hit is a defect, not a warning)
- FP-1. A generic teleporting-tooltip tour (no driven cursor, no scene-spotlight, no 3D popup) — the
  "cheesy" baseline the bar explicitly rejects.
- FP-2. A 2nd renderer / separate canvas / iframe for the popup 3D artifact.
- FP-3. The walkthrough mutating the graph (node poses, topology, hub layout) to stage a step.
- FP-4. No first-visit gate (re-launches every load) OR no re-trigger from the lightbulb.
- FP-5. Missing Skip/Close, no Esc, no keyboard nav, no focus trap, or ignoring
  `prefers-reduced-motion`.
- FP-6. `THREE.TextGeometry` / diffusion letterforms / DOM text injected into the runtime scene.
- FP-7. Purple anywhere; stock icons; fake brand logos.
- FP-8. Downgrading a dependency / older API to silence an error (use ANTI-STUCK).
- FP-9. Assertion-only "verification" standing in for real frame + interaction evidence (the
  advocate MUST actually trigger and step through).
- FP-10. Adding a heavy onboarding-SaaS dependency when the bespoke controller + existing toolkit suffice.

## PHASES — each: contract → build → verify (DPR-2 frames + NUMERIC + real interaction) → AUTO-CKPT

**P0 — CONTRACT + RE-VERIFY.** Confirm model + the bespoke-controller decision (above). Write the
typed walkthrough contract: the Step model (`target` selector OR scene-anchor, `highlightMode`
dom|scene, `cursorPath`, `popup` {artifact ref, copy, controls}, `a11y` labels), the controller
state machine (idle→running→step N→done/skipped), the first-visit/seen store, and the lightbulb
affordance seam. Author the launch step sequence as DATA (cover the core editor surfaces). No visible
change beyond the inert lightbulb yet; tsc clean.

**P1 — LIGHTBULB + SHELL.** Build the glowing lightbulb (top-right, bespoke, premium glow via
bloom/SDF), the scrim + **DOM-chrome spotlight cutout** (smooth, non-banded), the **programmatically
driven animated cursor**, and the lifecycle: first-visit auto-launch (once), Skip, Close, Esc,
scrim-click dismiss, re-trigger from the lightbulb, Next/Back/step-dots. (Criteria C1–C5.)

**P2 — SCENE-SPOTLIGHT + 3D POPUPS.** Build the **scene spotlight** (dim the live 3D scene except a
framed artifact) and the **high-tech popups** (relevant artifact animated in 3D sharing the
renderer + premium MSDF explanation), entrances/exits composed from the 406+ primitives +
DESIGN-REFERENCES. (Criteria C6–C8.)

**P3 — ACCESSIBILITY + RESPONSIVE.** Implement the full a11y path (prefers-reduced-motion fallback,
focus trap, keyboard, ARIA, visible brass focus ring) and make every step legible + correctly placed
on desktop/tablet/constrained/mobile (popups reflow, cursor paths re-target, lightbulb stays
reachable). (Criteria C9–C11.)

**P4 — VERIFICATION + SIGN-OFF.** Numeric harness + fresh-context advocate (who TRIGGERS + STEPS
THROUGH) + monitor (see GATE). 0 MUST-FIX. No regression. (Criteria C12–C13.)

## SUCCESS CRITERIA (atomic — each needs DPR-2 frames + a NUMERIC measure + a real interaction)
- **C1 Lightbulb present + glowing.** Bespoke glowing lightbulb renders top-right in all 3 view
  modes; clicking it launches the walkthrough. Evidence: frame + click→launch frame + a glow-luma
  measure (not flat).
- **C2 First-visit auto-launch + gate.** On a fresh profile (no "seen" flag) the walkthrough
  auto-launches once; after completion/skip it does NOT auto-launch on reload; the lightbulb still
  re-triggers it. Evidence: fresh-load frame + reload-no-launch proof + re-trigger frame + the
  stored flag value.
- **C3 Driven cursor.** A synthetic cursor visibly TRAVELS between step targets (lerped/skewed,
  not teleporting) and indicates a click. Evidence: ≥3 frames along one cursor path + a path-length/
  duration measure.
- **C4 DOM-chrome spotlight.** A step dims the chrome and cuts a smooth (non-banded) spotlight around
  a real toolbar/Inspector region. Evidence: frame + cutout-edge smoothness/contrast sample.
- **C5 Controls work.** Skip ends immediately; Close/Esc/scrim-click dismiss; Next/Back/dots
  navigate. Evidence: a frame per control action + the resulting state.
- **C6 Scene spotlight.** A step dims the live 3D scene except a framed artifact (measured luminance
  drop outside the frame vs inside). Evidence: frame + inside/outside luma delta.
- **C7 3D artifact in popup.** The popup shows the relevant artifact ANIMATED in 3D, sharing the one
  renderer (no 2nd canvas). Evidence: 2 frames showing motion + a renderer-count/DOM-canvas-count
  check (== 1 scene renderer).
- **C8 Premium popup type + composition.** Explanation copy is crisp MSDF/overlay text; the popup
  entrance composes named primitives (glass/holographic/glitch-in/kinetic-text). Evidence: zoom-crop
  frame + the list of primitives used.
- **C9 Reduced-motion path.** With `prefers-reduced-motion`, the walkthrough degrades to static
  framed steps (no cursor fly / heavy 3D motion) and stays fully usable. Evidence: reduced-motion
  frame + confirmation controls still work.
- **C10 Keyboard + focus + ARIA.** Full keyboard nav, focus trapped in the active popup, ARIA roles/
  labels present, visible brass focus ring. Evidence: keyboard-driven step frames + an a11y-tree/
  attribute dump.
- **C11 Responsive.** The walkthrough is legible + correctly placed on desktop 1440×900, tablet
  1024×768, constrained 880×600, mobile 390×844. Evidence: the 4-viewport frame grid.
- **C12 No regression.** tsc 0-new; vitest 0-fail (existing baseline only); primitives ≥ baseline;
  prebuilt elements ≥ baseline; 0 console errors while the walkthrough runs. Evidence: command
  outputs + console-error count.
- **C13 Capstone WOW.** The fresh-context advocate TRIGGERS the lightbulb and STEPS THROUGH the whole
  walkthrough as a non-technical first-time user, confirms it is premium + intuitive + non-cheesy
  (Prism convincingly drives the screen) with 0 MUST-FIX. Evidence: frame-cited advocate verdict.

## VERIFICATION GATE (the bar we actually use — all four, every phase verify + at sign-off)
1. **NUMERIC HARNESS.** Write scripts/guided-tips/*.mjs (extend verify-editor-runtimes.mjs /
   p9-appfeel.mjs): capture DPR-2 frames into notes/verification/guided-tips/<phase>/ AND emit the
   per-criterion numeric logs (glow luma, cursor path length/duration, cutout-edge smoothness,
   scene-spotlight inside/outside luma delta, scene-renderer/canvas count, console-error count) ×
   {desktop, tablet, constrained, mobile}. Drive REAL interactions (click the lightbulb, step
   Next/Back, Skip, Esc, toggle reduced-motion) — NEVER assert-only.
2. **FRESH-CONTEXT COMPUTER-USE ADVOCATE (Opus 4.8, 1M).** A `user-advocate` subagent with NO build
   context DRIVES the live app as a non-technical first-time user at DPR-2 with ZOOM CROPS: it must
   actually CLICK the lightbulb, STEP THROUGH every step, try Skip/Close/keyboard, and judge whether
   Prism "drives the screen" premium-ly or feels like a cheesy tooltip tour. It CITES a frame per
   verdict and holds MUST-FIX power. A verdict without cited evidence is INVALID (anti-rubber-stamp).
3. **NO-CAP SELF-HEAL LOOP.** If ANY C1–C13 fails, root-cause → fix → re-verify. No iteration limit.
   After ~2 fails on the same criterion, web-search the CURRENT (June 2026) correct approach
   (ANTI-STUCK); never downgrade a dep, never lower the bar.
4. **CHAT-MONITOR END REVIEW.** Before the completion marker, the monitoring session reviews the
   report + evidence; unresolved MUST-FIX blocks completion.
PASS = all C1–C13 green + advocate 0 MUST-FIX + monitor review clean.

## ON TRUE COMPLETION (all C1–C13 pass + capstone 0 MUST-FIX + monitor clean)
1. Write the full report to kid-kode-landing/notes/GUIDED-TIPS-REPORT.md: per-criterion (C1–C13)
   evidence (frames + numeric + interaction); the controller/step-model architecture + where step
   data + the "seen" flag live; the cursor-driving + scene-spotlight + 3D-popup approach + which
   primitives/DESIGN-REFERENCES techniques were used (+ a dependency-usage table); the a11y proof;
   honest flags; the advocate verdict; AUTO-CKPT hashes. Frames under notes/verification/guided-tips/.
2. Final AUTO-CKPT commit (secret-leak check first).
3. Add this EXACT line as the LAST line of the report — ONLY when truly done (the sentinel + chain
   key off it; NEVER write it on a partial/interrupted run):
   GUIDED-TIPS: RUN COMPLETE
4. STOP. Do not start any other workstream.

REPORT SKELETON (create at run start for visibility; fill as you go; marker added ONLY at the end):
---
# GUIDED-TIPS — glowing-lightbulb first-visit walkthrough
(status: in progress)

## P0 — contract + re-verify (bespoke controller, step model) — TODO
## P1 — lightbulb + shell (spotlight, driven cursor, lifecycle) — TODO
## P2 — scene-spotlight + 3D popups (premium, primitive-composed) — TODO
## P3 — accessibility + responsive — TODO
## P4 — verification + capstone — TODO
---
