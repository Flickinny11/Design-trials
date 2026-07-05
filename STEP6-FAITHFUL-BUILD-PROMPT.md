STEP 6 — FAITHFUL BUILD (artifacts realize their node's own schema: position + code + motion). Paste into Claude Code.

================================ MODEL & MODE ================================
MODEL: claude-opus-4-8 (NOT opusplan; confirm active model on line 1). 1M context.
       FOCUSED session (NOT dynamic workflows).
MODE: APP IMPLEMENTATION, verified. Edit app source under kid-kode-landing/src/** for
      the scoped slice ONLY. Verify every change with /prism-verify and produce EVIDENCE
      (before/after screenshots + console + assertions). Do NOT commit (leave staged for
      Logan's screenshot review). Stay on prism-editor-build. Run from git root.

Step-3 verification system is LIVE — USE it: /prism-verify, dependency guard, spec-criteria
Stop hook, prism-criteria-reviewer subagent, KripVerify (kv_*), Chrome DevTools MCP, Claude
in Chrome. ANTI-STUCK RULE: after ~2 failed attempts on a criterion, STOP — web-search the
CURRENT correct approach, root-cause, retry. NEVER downgrade a dependency or take the easy/
old path to silence an error.

GROUND TRUTH: PRISM-INTENT-ANCHOR.md §2–§4 + kkl/docs/prism/PRISM-RUNTIME-SPEC.md +
PRISM-CANVAS-EDITOR-SPEC.md (renderMode, scenePosition, Driver model). Map each scope item
to the matching numbered criteria and verify against them.

================================ THE LOAD-BEARING RULE (Logan, do not violate) ====
A built artifact's POSITION, BEHAVIOR, and ANIMATIONS come ENTIRELY from the NODE'S OWN
schema/code. Building a node simply REALIZES what the node already contains — it reads the
node's stored position (scenePosition) and runs the node's own code/bindings/animations,
and the artifact manifests accordingly. There is NO external placement step, NO layout
engine, NO hardcoded/default-grid positioning that the runtime imposes from outside the
node. If it is coded correctly, the artifact lands and behaves exactly as the node's schema
says — because the node says so, not because anything positioned it. (INVARIANT + see
forbidden patterns below.)

================================ SCOPE ====================================
1. POSITION FROM SCHEMA: on build, each artifact is placed at the position defined in its
   OWN node schema (scenePosition / position computed by the node's own code) and the
   runtime APPLIES that — it does not override it with a layout/grid.
2. CODE + MOTION RUN: building a node executes the node's own code/bindings/animations so
   the artifact does what the node specifies (its baked behavior/animation runs in
   canvas + preview-app via the Driver model). Scope this to what each node's schema
   ALREADY specifies — not new authoring tools.
3. BUILD REALIZATION (transition): building transitions a node from node-state into its
   built artifact at its schema position (the node→built realization; the build/"pop"
   transition is the visual of this).
4. FAITHFUL IN BOTH MODES: canvas and preview-app show every artifact at its schema
   position running its code (served from cache); preview-app reads as the running UI.

================================ OUT OF SCOPE (defer) ======================
The full canvas authoring toolbar + keyframe editor; the 300-primitive catalog;
text/lighting/material systems; engine/harness. CRITICAL: if a node's schema LACKS a
position or code, DO NOT invent a layout or place it yourself — SURFACE it as a schema/
authoring gap in the report (position belongs in the node, authored by editing the node,
never injected by the runtime). If the dependency guard or a forbidden pattern blocks you,
STOP and report — do not work around it.

================================ FORBIDDEN PATTERNS (halt) =================
- Any external layout/placement engine, auto-arrange, or hardcoded/default positions that
  the runtime imposes instead of reading the node's own scenePosition/code (violates the
  load-bearing rule above).
- Mutating a node's schema to "fix" a layout (positions are authored by the user editing a
  node, not by the build).

================================ VERIFY (evidence-based "done") =============
Run /prism-verify:
- Build the active hub's nodes. ASSERT (programmatically) each artifact's world position
  EQUALS its node's schema scenePosition (not a grid/default) — this proves position comes
  from the node, not from placement.
- SCREENSHOT canvas + preview-app: artifacts arranged per their schema (a designed page,
  not a rough/default scatter); capture any node animation actually running.
- Console shows ZERO new errors. Toggling modes still rebuilds nothing.
- Report any node whose schema lacks position/code (authoring gap, per OUT OF SCOPE).
The prism-criteria-reviewer subagent (fresh context; diff + criteria only) must sign off.

================================ OUTPUT + SCOPE LOCK =======================
Write kkl/notes/STEP6-FAITHFUL-BUILD-REPORT.md: per scope item — criterion, files changed,
EVIDENCE (screenshots + the position==schema assertions + console + reviewer verdict), and a
list of any schema/authoring gaps found. Save screenshots under
kkl/notes/verification/step6/. NO commit. End with a PLAIN-LANGUAGE summary a non-coder can
read (what works now, pointing at the pictures). Then STOP. HEAD stays prism-editor-build.
