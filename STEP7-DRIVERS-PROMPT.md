STEP 7 — DRIVERS (scroll / pointer / state / event motion plays in the built scene). Paste into Claude Code.

================================ MODEL & MODE ================================
MODEL: claude-opus-4-8 (NOT opusplan; confirm active model on line 1). 1M context.
       FOCUSED session (NOT dynamic workflows).
MODE: APP IMPLEMENTATION, verified. Edit app source under kid-kode-landing/src/** for the
      scoped slice ONLY. Verify with /prism-verify and produce EVIDENCE (screenshots +
      measured input→motion response + console). Do NOT commit (leave staged for Logan's
      review). Stay on prism-editor-build. Run from git root.

Step-3 verification system is LIVE — USE it: /prism-verify, dependency guard, spec-criteria
Stop hook, prism-criteria-reviewer subagent, KripVerify (kv_*), Chrome DevTools MCP, Claude
in Chrome. ANTI-STUCK RULE: after ~2 failed attempts on a criterion, STOP — web-search the
CURRENT correct approach, root-cause, retry. NEVER downgrade a dependency or take the easy/
old path.

GROUND TRUTH: PRISM-CANVAS-EDITOR-SPEC.md §8.2 (Driver model) + §16 (Preview: drivers respond
to real input) + PRISM-INTENT-ANCHOR.md §3. Map each scope item to the matching numbered
criteria and verify against them. Step 6 left scroll/pointer drivers unwired (the shared
primitives context exposed scene/camera only); time drivers already work.

================================ THE RULE (still in force) =================
Motion comes ENTIRELY from each node's OWN schema (its declared cinematicPrimitives + the
driver each one declares). Drivers only PLAY what the node already specifies — they do not
add, author, or invent motion, and they do not position anything. (Realize the node's
contents; never impose from outside.)

================================ SCOPE ====================================
Wire the four currently-missing drivers into the runtime so node-DECLARED interactive
animations play (canvas + preview-app), per the Driver model:
1. ScrollDriver — scroll progress 0→1 drives node-declared scroll animations (the 7
   `parallax-scroll` nodes respond to scrolling the built view).
2. PointerDriver — hover bool + pointer xy drives node-declared pointer animations (the
   `magnetic-cursor` node responds to the mouse).
3. StateDriver — named state inputs (idle/hover/pressed/loading/success/error) drive
   node-declared state animations.
4. EventDriver — click/submit/custom triggers drive node-declared event animations
   (e.g. the paused `displacement-transition` plays on its trigger).
INVARIANT (INV-6): an animation's keyframes/states are INDEPENDENT of its driver —
changing/adding a driver never edits keyframes. Drivers play ANIMATION only, never app
behavior/function (that's the node editor's job, out of scope here). In preview-app,
TimeDriver plays deterministically while scroll/pointer/state/event respond to REAL input.

================================ OUT OF SCOPE (defer) ======================
The keyframe-editor UI; the 300-primitive catalog; new animation authoring; wiring app
FUNCTION/behavior (node editor); text/lighting/material systems; engine/harness. If a node
declares no interactive driver, it stays as-is (faithful). If the dependency guard or a
forbidden pattern blocks you, STOP and report — do not work around it.

================================ VERIFY (evidence-based "done") =============
Run /prism-verify in preview-app (drivers must respond to real input there):
- SCROLL the built view → capture that the `parallax-scroll` nodes visibly move with scroll
  (before/after frames or measured position delta vs scroll progress).
- MOVE the pointer → capture the `magnetic-cursor` node responding (measured delta tied to
  pointer position).
- Trigger an EVENT/STATE animation → capture it playing.
- ASSERT keyframes unchanged when a driver is (re)assigned (INV-6).
- Console ZERO new errors; toggling modes still rebuilds nothing.
The prism-criteria-reviewer subagent (fresh context; diff + criteria only) must sign off.

================================ OUTPUT + SCOPE LOCK =======================
Write kkl/notes/STEP7-DRIVERS-REPORT.md: per scope item — criterion, files changed, EVIDENCE
(screenshots + measured input→motion deltas + console + reviewer verdict). Save screenshots
under kkl/notes/verification/step7/. Shut down any dev server you start when done. NO commit.
End with a PLAIN-LANGUAGE summary a non-coder can read (what moves now and in response to
what), pointing at the pictures. Then STOP. HEAD stays prism-editor-build.
