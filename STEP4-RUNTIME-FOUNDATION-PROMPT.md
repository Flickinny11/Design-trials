STEP 4 — RUNTIME FOUNDATION (render clean + unified scene + 3-mode toggle). Paste into Claude Code.

================================ MODEL & MODE ================================
MODEL: claude-opus-4-8 (NOT opusplan; confirm active model on line 1). 1M context.
       FOCUSED session (NOT dynamic workflows — this is interconnected foundational
       work, not mass parallelism).
MODE: APP IMPLEMENTATION, verified. You MAY edit app source under kid-kode-landing/src/**
      for the scoped foundation slice ONLY. You MUST verify every change with the
      /prism-verify protocol and produce EVIDENCE (screenshots + console). Do NOT commit
      (leave staged; Logan reviews the screenshots, then we checkpoint). Stay on
      prism-editor-build. Run from git root Design-trials/.

The Step-3 verification system is LIVE — USE it: /prism-verify, the dependency guard,
the spec-criteria Stop hook, the prism-criteria-reviewer subagent, KripVerify (kv_*),
Chrome DevTools MCP, Claude in Chrome. Honor the ANTI-STUCK RULE: after ~2 failed
attempts on a criterion, STOP — web-search the CURRENT correct approach, root-cause,
then retry. NEVER downgrade a dependency or take the old/easy path to silence an error.

GROUND TRUTH: PRISM-INTENT-ANCHOR.md + kkl/docs/prism/PRISM-RUNTIME-SPEC.md (consult
NODE-EDITOR + CANVAS specs for boundaries). The RUNTIME-SPEC NUMBERED CRITERIA are the
rubric — map each scope item below to its criteria and verify against them.

================================ SCOPE (foundation slice ONLY) =============
1. RENDER CLEAN / KILL THE CRASH: eliminate the multiple-`three`-instances root cause
   (the CDN import-map loading `three/webgpu` separately from the bundled `three`).
   Unify to ONE `three` instance. The app must load on local dev AND a production build
   with ZERO console exceptions and nodes visible. (This is the per-frame "Cannot read
   properties of undefined (reading 'replace')" crash seen on the live site.)
2. UNIFIED SCENE: one `three/webgpu` scene + automatic WebGL2 fallback (verify the
   fallback on a non-WebGPU context).
3. THREE-MODE TOGGLE = state + tooling over the ONE scene (galaxy | canvas | preview-app).
   preview-app shows BUILT nodes from the builtSnapshot CACHE — NOT a separate compiled
   PrismHost mount. Switching modes must NOT rebuild and must NOT mutate the graph.
4. GALAXY shows dormant SPHERES by default (not assembled artifacts).

================================ OUT OF SCOPE (defer) ======================
The edit→save→build→verify path (Step 5); the canvas keyframe editor / animation system;
node + hub editor panels; camera-rig polish beyond what's needed to see the modes; any
engine/harness work. If the dependency guard or a forbidden pattern blocks you, STOP and
report — do NOT work around it.

================================ VERIFY (evidence-based "done") =============
For EACH scope item, run /prism-verify:
- Load the app in real Chrome (Claude in Chrome).
- DevTools console (Chrome DevTools MCP) must show ZERO exceptions.
- SCREENSHOT each mode: galaxy (spheres), canvas (built), preview-app (built/running).
- Toggle across all three modes; confirm fast, correct, and NO graph mutation.
- Via DevTools confirm a SINGLE `three` instance is loaded (no CDN duplicate).
- Use KripVerify (kv_*) for interaction checks where useful.
The prism-criteria-reviewer subagent (fresh context, sees only the diff + criteria) must
sign off before any item is "done."

================================ OUTPUT + SCOPE LOCK =======================
Write kkl/notes/STEP4-RUNTIME-FOUNDATION-REPORT.md. Per scope item: the criterion, the
files changed, and the EVIDENCE (screenshot paths + console snippets + reviewer verdict).
Save screenshots under kkl/notes/verification/step4/. NO commit. End with a PLAIN-LANGUAGE
summary a non-coder can read (what works now, pointing at the screenshots). Then STOP.
HEAD stays prism-editor-build.
