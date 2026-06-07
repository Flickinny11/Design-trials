ULTRACODE PILOT — Animation Primitive Catalog (trial batch ~24). Paste into Claude Code.

================================ MODEL & MODE ================================
MODEL: claude-opus-4-8 (NOT opusplan; confirm active model on line 1). 1M context.
ORCHESTRATION: USE DYNAMIC WORKFLOWS — write an orchestration script that builds these
primitives across PARALLEL subagents (this is our first intentional parallel run). Each
subagent pins claude-opus-4-8.
MODE: APP IMPLEMENTATION, verified. Edit app source under kid-kode-landing/src/** only.
      Verify with /prism-verify; produce EVIDENCE. Shut down any dev server you start. Do NOT
      commit (leave staged for Logan's review). Stay on prism-editor-build. Run from git root.

This is a PILOT. Goal: PROVE the parallel-build + verification pattern at small scale BEFORE
the full 300-primitive catalog. Use the EXISTING Prism design language in the codebase (no
external skill files on this machine).

================================ THE FROZEN CONTRACT (build against, don't renegotiate) ====
Every primitive implements the `Animatable` contract (duration()/seek(t)/controls():
ControlSchema/serialize()) from the now-locked motion system (Steps 6–7), declares its own
ControlSchema (knobs/faders/dropdowns/curves), registers in the shared Animatable registry,
gets a hover-playing PREVIEW TILE, and plugs into the existing Animation Picker + Keyframe
Editor (Step 8) and the Driver model (Step 7: Time/Scroll/Pointer/State/Event). Contract-first:
each subagent builds to THIS contract; no peer-to-peer negotiation.

================================ BATCH (~24, spread easy→hard across categories §8.3) =====
Pick a representative ~24 spanning the catalog's range, e.g.: transform tweens (fade, slide,
scale-pop), scroll (parallax, pin-reveal), pointer (magnetic, tilt), text (split-stagger,
scramble, dissolve-to-dust), glass/dispersion refraction, caustics, volumetric godray,
GPGPU particles (dust, sparks), smoke, displacement transition, wave, shimmer, blur-in,
mask-wipe. Choose a mix that stresses BOTH simple tweens and heavy GPU effects so the pilot
is a real test. Any new dependency for an effect MUST pass the dependency-allowlist guard.

================================ VERIFICATION (per primitive — the loop, coordinated) =====
For EACH primitive: (a) contract conformance (implements Animatable + a working ControlSchema)
— unit-testable; (b) RENDERS; (c) PLAYS — animates over the timeline (capture frames showing
real motion); (d) CONTROLS work (changing a ControlSchema param changes the output); (e)
appears in the Picker as a hover-preview tile. Use /prism-verify's vision+interaction for
(b)-(e). IMPORTANT: COORDINATE the browser verification to avoid contention — do NOT run ~24
browsers at once; batch/serialize the visual passes (or use offscreen render where possible).
Fix-don't-skip; ANTI-STUCK: after ~2 fails on a primitive, web-search the current correct
approach, root-cause, retry; NEVER downgrade a dependency or take the easy path. The
prism-criteria-reviewer (fresh context) signs off the batch; MUST-FIX blocks done.

================================ OUT OF SCOPE ==============================
Do NOT build all 300 — only the pilot ~24. Do not wire app function/behavior (node editor).
Do not alter graph topology (INV-1). No engine/harness. If the guard or a forbidden pattern
blocks you, STOP and report.

================================ OUTPUT + SCOPE LOCK =======================
Write kkl/notes/ULTRACODE-PILOT-REPORT.md with: a GALLERY (preview frame(s) of EACH primitive
playing) + per-primitive verdict (built / verified / notes); HOW THE PARALLEL ORCHESTRATION
BEHAVED (timing, peak parallelism, any contention/races, any failures + how the loop caught/
fixed them); and an explicit GO / NO-GO recommendation for the full 300 with reasoning. Save
screenshots under kkl/notes/verification/ultracode-pilot/. NO commit. End with a PLAIN-LANGUAGE
summary a non-coder can read. Then STOP. HEAD stays prism-editor-build.
