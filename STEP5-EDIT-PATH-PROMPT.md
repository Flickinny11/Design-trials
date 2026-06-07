STEP 5 — EDIT PATH (edit → save → build → VERIFY → preview, end-to-end). Paste into Claude Code.

================================ MODEL & MODE ================================
MODEL: claude-opus-4-8 (NOT opusplan; confirm active model on line 1). 1M context.
       FOCUSED session (NOT dynamic workflows — interconnected core mechanics).
MODE: APP IMPLEMENTATION, verified. Edit app source under kid-kode-landing/src/** for
      the scoped slice ONLY. Verify every change with /prism-verify and produce EVIDENCE
      (before/after screenshots + console). Do NOT commit (leave staged for Logan's
      screenshot review). Stay on prism-editor-build. Run from git root Design-trials/.

The Step-3 verification system is LIVE — USE it: /prism-verify, the dependency guard,
the spec-criteria Stop hook, the prism-criteria-reviewer subagent, KripVerify (kv_*),
Chrome DevTools MCP, Claude in Chrome. ANTI-STUCK RULE: after ~2 failed attempts on a
criterion, STOP — web-search the CURRENT correct approach, root-cause, then retry. NEVER
downgrade a dependency or take the old/easy path to silence an error.

GROUND TRUTH: PRISM-INTENT-ANCHOR.md §4 + §8 (edit→save→build→verify + caption-driven
repair); kkl/docs/prism/PRISM-NODE-EDITOR-SPEC.md (the edit path + Save-and-Rebuild);
PRISM-CANVAS-EDITOR-SPEC.md §6 node lifecycle (Bubble→Populated→Built→In System→Dirty,
dirty-on-edit) + §11 cache. Map each scope item to the matching numbered criteria and
verify against them. The current edit/save/rebuild path does NOTHING in practice — treat
it as to-be-built, not to-be-trusted.

================================ SCOPE (the edit path ONLY) =================
1. EDIT REGISTERS: editing a node's content/properties in the node editor records the
   change to the node and marks the node `dirty` (Built→Dirty per canvas §6).
2. SAVE & REBUILD: a Save-and-Rebuild action rebuilds ONLY that node (surgical, not a
   full re-mount) and refreshes ONLY that node's builtSnapshot cache entry.
3. VERIFY-IN-PATH: the rebuild verifies the artifact actually built and renders; if it
   fails, DO NOT surface a broken/previous state — fix at the moment of breakage. Wire
   the caption-driven repair loop (anchor §8): on build/verify failure, dispatch the
   repair (read node+hub captions + contents → fix → re-verify). At minimum, demonstrate
   detect → flag → repair-attempt → re-verify on a node that fails to build.
4. CHANGE IS VISIBLE: after Save-and-Rebuild, the updated artifact replaces the old one
   in canvas AND preview-app (served from the refreshed cache). Editing one node must
   NOT rebuild or alter any other node.

================================ OUT OF SCOPE (defer) ======================
In-place coded 3D positions + per-node build/pop animation + per-node code execution
(Step 6); the full canvas visual toolbar + keyframe editor; the 300-primitive catalog;
text/lighting/material systems; engine/harness. If the dependency guard or a forbidden
pattern blocks you, STOP and report — do NOT work around it.

================================ VERIFY (evidence-based "done") =============
Run /prism-verify for each scope item:
- Pick an OBSERVABLE node property to change (something visible in the built artifact).
- SCREENSHOT the built node in preview-app/canvas BEFORE the edit.
- Make the edit → Save-and-Rebuild.
- SCREENSHOT AFTER — the change must be visibly reflected; console shows ZERO new errors.
- Assert ONLY the edited node's snapshot changed (others' hashes unchanged).
- Exercise the failure-repair path (item 3) and capture evidence it fired and recovered.
The prism-criteria-reviewer subagent (fresh context; sees only diff + criteria) must
sign off before any item is "done."

================================ OUTPUT + SCOPE LOCK =======================
Write kkl/notes/STEP5-EDIT-PATH-REPORT.md: per scope item — the criterion, files changed,
and EVIDENCE (before/after screenshot paths + console + which-node-rebuilt assertion +
reviewer verdict). Save screenshots under kkl/notes/verification/step5/. NO commit. End
with a PLAIN-LANGUAGE summary a non-coder can read (what works now, pointing at the
before/after pictures). Then STOP. HEAD stays prism-editor-build.
