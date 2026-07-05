FULL CATALOG — ultracode batch run (toward ≥300 primitives). Paste into Claude Code.

================================ MODEL & MODE ================================
MODEL: claude-opus-4-8 (NOT opusplan; confirm active model on line 1). 1M context.
ORCHESTRATION: USE DYNAMIC WORKFLOWS — parallel subagents in INTERNAL verified batches. Each
subagent pins claude-opus-4-8.
MODE: APP IMPLEMENTATION, verified. Edit app source under kid-kode-landing/src/** only. Verify
      with the hardened /prism-verify. Shut down any dev server you start. Do NOT commit (leave
      staged for Logan). Stay on prism-editor-build. Run from git root. Use the existing Prism
      design language (no external skill files on this machine). ANTI-STUCK: after ~2 fails on a
      primitive, web-search the CURRENT correct approach, root-cause, retry; NEVER downgrade a
      dependency or take the easy/old path.

GOAL: grow the Animation Primitive Catalog toward the canvas spec's ≥300 (PRISM-CANVAS-EDITOR-
SPEC.md §8.3). The pilot built 24 (see /animation-catalog + the Animatable registry). THIS RUN:
build the NEXT ~50–70 NEW primitives (do NOT rebuild or duplicate existing ones — read the
registry first and extend it), balanced across categories. This is a RESUMABLE batch; another
run will continue. Read kid-kode-landing/notes/ULTRACODE-PILOT-REPORT.md +
CATALOG-PREP-REPORT.md first.

================================ FROZEN CONTRACT ==========================
Each primitive implements the `Animatable` contract (duration/seek/controls:ControlSchema/
serialize), declares its ControlSchema, registers in the shared registry, gets a hover-playing
preview tile, and plugs into the Animation Picker + Keyframe Editor + Driver model. Contract-
first; subagents build TO the contract, no peer negotiation. Render through the SHARED PREVIEW
RIG (single canvas + UI-card subjects + env map) from the prep step.

================================ COVERAGE (pick NEW ones, balanced) ========
Deepen + extend across §8.3, e.g.: more transform tweens (flip, bounce, elastic, overshoot,
rotate-in, swing), more text/kinetic typography (typewriter, glitch, neon-flicker, wave-text,
3D-extrude), more scroll (sticky, horizontal, reveal-mask, scrub-morph), more particles/GPGPU
(confetti, embers, snow, bubbles, fireflies), fluid/water (FFT ocean, ripple-pool, ink-spread,
foam), fire/flame, volumetric (clouds, fog, light-shafts, god-rays variants), physics (gravity
drop, collision, cloth, hair/wind sway), dispersion/refraction variants, caustics variants,
shimmer/iridescence, splat reveals, displacement transitions. Balance simple + heavy-GPU. Any
NEW dependency MUST pass the dependency-allowlist guard.

================================ VERIFICATION (per primitive — hardened loop) ====
contract conformance + `tsc --noEmit` clean (no NEW errors) + RENDERS + PLAYS (capture a
MID-ANIMATION frame, not the settled end frame) + CONTROLS work + ART-FIDELITY reviewer (looks
premium; not too dark/washed/broken) + appears in the Picker. GLASS/TRANSMISSION-family effects:
do a REAL-GPU (WebGPU) spot-check, not the headless frame (headless under-renders transmission).
Fix-don't-skip; fresh-context reviewer signs off each batch; MUST-FIX blocks done.

================================ RESUMABILITY + SAFETY =====================
Work in internal batches of ~15–25; after each batch, WRITE incremental progress to
kid-kode-landing/notes/CATALOG-PROGRESS.md (which categories/primitives are done, running
total) so nothing is lost if interrupted. Stop this run after ~50–70 NEW primitives (or sooner
at a clean batch boundary) and report — do NOT attempt all ~276 in one run. If the guard or a
forbidden pattern blocks you, STOP and report.

================================ OUTPUT + SCOPE LOCK =======================
Write kkl/notes/CATALOG-BATCH-REPORT.md: new primitives by category, running total toward 300,
a GALLERY (mid-animation frames), per-batch orchestration behavior (timing, peak parallelism,
failures + how the loop fixed them), any flagged for real-GPU art follow-up, and what remains.
Save screenshots under kkl/notes/verification/catalog-batch-1/. NO commit. End with a PLAIN-
LANGUAGE summary for Logan + the running total. Then STOP. HEAD stays prism-editor-build.
