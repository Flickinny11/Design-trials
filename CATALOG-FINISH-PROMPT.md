FULL CATALOG — FINISH RUN (build remaining ~147 to reach ≥300). Paste into Claude Code.

================================ MODEL & MODE ================================
MODEL: claude-opus-4-8 (NOT opusplan; confirm active model on line 1). 1M context.
ORCHESTRATION: USE DYNAMIC WORKFLOWS — parallel subagents in INTERNAL verified waves (~20 each),
running STRAIGHT THROUGH all remaining primitives (no pause for human approval between waves).
Reuse the harness (notes/catalog-batch-workflow.mjs + catalog-batch-specs.json +
catalog-wire-barrel.mjs + the real-gpu capture script). Each subagent pins claude-opus-4-8.
MODE: APP IMPLEMENTATION, verified. Edit app source under kid-kode-landing/src/** only. Verify
      with the hardened /prism-verify. Shut down any dev server you start. Do NOT commit (leave
      staged for Logan). Stay on prism-editor-build. Run from git root. Existing Prism design
      language (no external skill files on this machine). ANTI-STUCK: after ~2 fails on a
      primitive, web-search the CURRENT correct approach, root-cause, retry; NEVER downgrade or
      take the easy path.

CONTEXT: catalog is at 153/300 (pilot 24 + batch1 66 + batch2 63). READ
kid-kode-landing/notes/CATALOG-PROGRESS.md + CATALOG-BATCH-2-REPORT.md first; do NOT duplicate
existing primitives — extend the registry to ≥300 total.

================================ GOAL ====================================
Build ALL remaining primitives to reach **≥300 total** this run, balanced to FILL OUT the §8.3
categories not yet saturated (e.g. remaining 3D/dimensional reveals, full kinetic-typography set,
GPGPU/compute particle variety, fluid/smoke/ink/water depth, fire/ember/spark variety,
volumetric (clouds/fog/godrays/aurora/nebula) depth, wind/cloth/hair/physics/collision, splat
reveals, dispersion/caustics/iridescence variety, light-refraction shimmer, mask/wipe/displacement
transitions, ambient/idle loops). Same FROZEN Animatable contract + ControlSchema + hover-tile +
Picker/Keyframe/Driver wiring; contract-first; render through the SHARED RIG. New deps must pass
the dependency-allowlist guard.

================================ VERIFICATION — FULL STRENGTH (do NOT loosen) ====
Per primitive, EVERY gate: contract conformance + `tsc --noEmit` (0 new errors) + RENDERS + PLAYS
(mid-animation frame) + CONTROLS work + ART-FIDELITY reviewer (premium look) + appears in Picker.
GLASS/TRANSMISSION/IBL effects → REAL-GPU spot-check (real WebGPU on this Mac; Logan authorized) —
not the headless rig. Fix-don't-skip; fresh-context reviewer signs off each wave; MUST-FIX blocks
done. The human gate is loosened (run straight through); the machine verification is NOT.

================================ RESUMABILITY (the safety net) =============
After EACH wave: rebuild the registry barrel, run tsc + the test suite, and UPDATE
notes/CATALOG-PROGRESS.md with the running total + which categories are done. Stage files as you
go. If interrupted, a re-launch must be able to read CATALOG-PROGRESS.md and continue from the last
wave (do not restart from zero). If the guard or a forbidden pattern blocks you, STOP and report.

================================ OUT OF SCOPE ==============================
Do NOT do the art-polish pass (clear-glass backdrop, the ~5 nits) — that's a later focused step.
Do NOT touch runtime/editor/page.tsx, the toolbar groups' features, text-MSDF binding, or engine/
harness. Only the catalog/animatable + registry.

================================ OUTPUT + SCOPE LOCK =======================
Write kkl/notes/CATALOG-FINISH-REPORT.md: final count (must state the exact TOTAL vs 300),
new primitives by category, a GALLERY (mid-animation frames), glass real-GPU results, full
orchestration metrics (waves, peak parallelism, total time, every failure + how the loop fixed
it), any primitive that could NOT meet the bar (flagged honestly, not faked), and the art-polish
to-do list carried forward. Save frames under kid-kode-landing/notes/verification/catalog-finish/.
NO commit. End with a PLAIN-LANGUAGE summary for Logan + the final total. Then STOP. HEAD stays
prism-editor-build.
