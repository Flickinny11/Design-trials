FULL CATALOG — ultracode BATCH 2 (toward ≥300) + glass real-GPU spot-check. Paste into Claude Code.

================================ MODEL & MODE ================================
MODEL: claude-opus-4-8 (NOT opusplan; confirm active model on line 1). 1M context.
ORCHESTRATION: USE DYNAMIC WORKFLOWS — parallel subagents in INTERNAL verified waves (the
reusable harness from batch 1 already exists: notes/catalog-batch-workflow.mjs +
catalog-batch-specs.json + catalog-wire-barrel.mjs — reuse it). Each subagent pins
claude-opus-4-8.
MODE: APP IMPLEMENTATION, verified. Edit app source under kid-kode-landing/src/** only. Verify
      with the hardened /prism-verify. Shut down any dev server you start. Do NOT commit (leave
      staged for Logan). Stay on prism-editor-build. Run from git root. Existing Prism design
      language (no external skill files on this machine). ANTI-STUCK: after ~2 fails, web-search
      the CURRENT correct approach, root-cause, retry; NEVER downgrade or take the easy path.

CONTEXT: catalog is at 90/300 (batches done: pilot 24 + batch 1's 66). READ
kid-kode-landing/notes/CATALOG-PROGRESS.md + CATALOG-BATCH-REPORT.md first and do NOT duplicate
existing primitives — extend the registry.

================================ THIS RUN ==================================
Build the NEXT ~50–70 NEW primitives toward ≥300, balanced across the §8.3 categories not yet
saturated, e.g.: 3D-transform reveals (flip-3d, cube-rotate, card-fold, unfold), more kinetic
typography (split-3d, liquid-text, stretch, decode), GPGPU compute particles (swarm, flocking,
attractor, morph-cloud), fluid (2D/3D smoke volume, ink, paint-spread), ocean/water variants,
fire/embers variants, wind/cloth/hair sway, gravity/physics drops & collisions, splat reveals,
ambient light-refraction shimmer variants, dispersion/caustics variants, mask/wipe transitions,
displacement transitions. Same FROZEN Animatable contract + ControlSchema + hover-tile + Picker/
Keyframe/Driver wiring; contract-first; render through the SHARED RIG. New deps must pass the
dependency-allowlist guard.

================================ VERIFICATION (hardened loop) ==============
Per primitive: contract conformance + `tsc --noEmit` (0 new errors) + RENDERS + PLAYS (capture a
MID-animation frame) + CONTROLS work + ART-FIDELITY reviewer (premium look) + appears in Picker.
Fix-don't-skip; fresh-context reviewer signs off each wave; MUST-FIX blocks done.

GLASS / TRANSMISSION REAL-GPU SPOT-CHECK (Logan authorized using his Mac GPU):
- For the 6 glass primitives flagged in batch 1 AND any new transmission/IBL effects this run,
  do a REAL-GPU verification using a real WebGPU-capable browser on this machine (Claude in
  Chrome, or a GPU-enabled Chromium — NOT the headless rig, which under-renders transmission).
  Capture a frame that actually shows the glass sparkle/refraction. (This briefly uses Logan's
  browser/GPU — that's approved.)
- If a true real-GPU render genuinely can't be achieved in this environment, REPORT THAT HONESTLY
  (do not fake the frame); list which primitives still need a manual real-GPU look.

================================ RESUMABILITY + SAFETY =====================
Internal waves of ~15–25; after each, update notes/CATALOG-PROGRESS.md (done + running total).
Stop after ~50–70 new (or sooner at a clean boundary) and report — do NOT attempt all remaining
in one run. If the guard or a forbidden pattern blocks you, STOP and report.

================================ OUTPUT + SCOPE LOCK =======================
Write kkl/notes/CATALOG-BATCH-2-REPORT.md: new primitives by category, running total toward 300,
a GALLERY (mid-animation frames), the GLASS REAL-GPU results (sparkle frames or honest "still
needs manual look" list), orchestration metrics (timing/parallelism/failures+fixes), and what
remains. Save frames under kid-kode-landing/notes/verification/catalog-batch-2/. NO commit. End
with a PLAIN-LANGUAGE summary for Logan + the running total. Then STOP. HEAD stays prism-editor-build.
