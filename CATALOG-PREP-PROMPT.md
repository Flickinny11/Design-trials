CATALOG PREP — shared preview rig + loop hardening (before the full 300). Paste into Claude Code.

================================ MODEL & MODE ================================
MODEL: claude-opus-4-8 (NOT opusplan; confirm active model on line 1). 1M context.
       FOCUSED session (NOT dynamic workflows — this is shared-infra + loop config).
MODE: APP IMPLEMENTATION + LOOP CONFIG, verified. Edit app source under kid-kode-landing/src/**
      and the verification/hook config. Verify with /prism-verify; produce EVIDENCE. Shut down
      any dev server you start. Do NOT commit (leave staged for Logan). Stay on
      prism-editor-build. Run from git root. Use the existing Prism design language (no external
      skill files on this machine). ANTI-STUCK: after ~2 fails, web-search the current correct
      approach, root-cause, retry; NEVER downgrade a dependency.

CONTEXT: the ultracode pilot built 24 primitives and recommended GO for the full 300 AFTER two
prep items. This step does those two items so the full catalog run is clean and looks premium.
Read kid-kode-landing/notes/ULTRACODE-PILOT-REPORT.md first.

================================ SCOPE ====================================
A. SHARED PREVIEW RIG (build once; the full 300 render against it):
   - A shared tile renderer: ONE persistent shared-context canvas/renderer that all catalog
     preview tiles draw through (the pilot proved routing through a single persistent canvas
     eliminates GPU "device lost"). All 24 existing tiles must render through it with zero
     device-lost.
   - Richer sample SUBJECTS for primitives to animate (not bare quads) — a small set of
     representative UI-element subjects so motion reads clearly.
   - An ENVIRONMENT / reflection map in the rig so glass/refraction/dispersion and PBR shaders
     look their best (fixes the pilot's "glass needs an env map to shine").
B. LOOP HARDENING (make the verification loop tighter for the 300):
   - Add a `tsc --noEmit` (typecheck) GATE to /prism-verify's done-criteria (the pilot found
     vitest misses what `next build`/tsc enforces). It must run with the correct node (nvm)
     and pass before any criterion is "done."
   - Add an ART-FIDELITY REVIEWER pass to the loop: a vision-based judgment that each primitive
     looks GOOD/premium (not just that it renders/plays) against the Prism quality bar — flags
     art issues (too dark, washed out, broken material) as fixes, separate from functional pass.
   - Confirm the import-guard false-positive fix is in the actual guard script (permanent), not
     only in prompt text.

================================ OUT OF SCOPE ==============================
Building more primitives (that's the next ultracode run); the deferred toolbar groups' features;
engine/harness. If the guard or a forbidden pattern blocks you, STOP and report.

================================ VERIFY (evidence-based "done") =============
Run /prism-verify:
- Re-render the existing 24 primitives through the SHARED RIG: SCREENSHOT the catalog with the
  new subjects + env map; ASSERT zero device-lost across all tiles; show glass/refraction now
  visibly shining vs the pilot frame.
- Demonstrate the `tsc` gate running + passing (and that it would BLOCK a deliberate type error).
- Demonstrate the art-fidelity reviewer producing a per-primitive look judgment.
- Console ZERO new errors; existing wired editor still works; toggling modes still rebuilds nothing.
The prism-criteria-reviewer subagent (fresh context) must sign off.

================================ OUTPUT + SCOPE LOCK =======================
Write kkl/notes/CATALOG-PREP-REPORT.md: what changed (rig + loop), EVIDENCE (before/after glass
screenshot, device-lost=0 assertion, tsc-gate demo, art-reviewer demo, reviewer verdict), and a
short "ready for full-300 ultracode" checklist. Save screenshots under
kkl/notes/verification/catalog-prep/. NO commit. End with a PLAIN-LANGUAGE summary for Logan.
Then STOP. HEAD stays prism-editor-build.
