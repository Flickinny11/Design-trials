STEP 3 — DRIFT-PREVENTION & VERIFICATION SYSTEM (replace Ralph). Paste into Claude Code.

================================ MODEL & MODE ================================
MODEL: claude-opus-4-8  (NOT opusplan — it falls back to Sonnet. State the active
       model on line 1 and confirm it is claude-opus-4-8.)  CONTEXT: 1M window.
MODE: INFRASTRUCTURE / CONFIG SETUP. You set up the drift-prevention + verification
      SYSTEM. You do NOT fix Prism app FEATURES (preview transition, single-three,
      edit path, camera/view modes, etc.) — those are STEP 4. The ONLY app-code edit
      allowed is the surgical removal in Task 5. No commits (leave staged for Logan).
      Stay on prism-editor-build.
PATHS: git root = Design-trials/ (run from here). app = kid-kode-landing/ (= kkl/).

================================ DECISIONS (locked) =========================
- PRISM-INTENT-ANCHOR.md + the canonical-3 specs are the source of truth; their
  NUMBERED ATOMIC SUCCESS CRITERIA are the verification RUBRIC.
- Ralph loops are RETIRED. Big parallel work → Claude Code DYNAMIC WORKFLOWS (Opus
  4.8, self-checking). Focused work → a normal Opus 4.8 session. No homegrown loop
  scripts.
- Hooks are MODERNIZED, not deleted: a PreToolUse dependency/forbidden-pattern guard,
  plus a Stop/SubagentStop hook that returns hookSpecificOutput.additionalContext
  (feedback that keeps the turn going) — NEVER a blocking/looping hook.
- VERIFICATION = two layers, because Prism renders its UI into a WebGPU CANVAS (DOM /
  selector testing cannot SEE the built UI):
    (a) functional: Chrome DevTools MCP — console errors, structural assertions.
    (b) vision-driven visual + interaction: Claude in Chrome (screenshot, judge the
        look, CLICK/DRAG/toggle modes like a user, confirm it RENDERS and FUNCTIONS)
        + KripVerify (kv_verify).
  Judge against the spec criteria. EVIDENCE-BASED DONE (screenshot / console output),
  never "I added it." A fresh-context reviewer subagent sees ONLY the diff + criteria.
- ANTI-STUCK RULE (mandatory): after ~2 failed fix attempts on the SAME criterion,
  STOP guessing — web-search the CURRENT correct approach (current versions/APIs as of
  today's real date), do root-cause analysis, then retry. NEVER downgrade a dependency
  or pick an older/easier API just to make an error disappear.
- Pin claude-opus-4-8 in EVERY subagent/agent/hook config you create.

================================ INPUTS ====================================
Read: PRISM-INTENT-ANCHOR.md; the canonical-3 (kkl/docs/prism/PRISM-RUNTIME-SPEC.md,
PRISM-NODE-EDITOR-SPEC.md, PRISM-CANVAS-EDITOR-SPEC.md); kkl/docs/prism/SPEC-INDEX.md
§6 (catalogued pending step-3 items); Design-trials/AUDIT_REPORT.md (hook/script
locations); and the .claude/ dir, hooks, and scripts on disk.

================================ TASKS (drift-prevention SYSTEM only) =======
1. ARCHIVE the Ralph loop drivers (ralph.sh family, kickoff-*, *resume* loop scripts)
   → git mv into scripts/archive/ (move, never delete). Leave guardrail hooks in place.
2. RE-WIRE dependency-allowlist-check.sh as an ACTIVE PreToolUse guard (currently
   unwired). Extend it to ALSO block the canonical-3 FORBIDDEN PATTERNS (e.g. PixiJS /
   any second visible renderer / diffusion-drawn text / a stored global fps / wiring
   app behavior in canvas / DEPENDENCY DOWNGRADES). Demonstrate it firing on a test
   edit and paste the output.
3. CLEAN UP dangling/disabled hook references (the .disabled kripverify Stop/
   UserPromptSubmit refs; the inert global photoreal-block-stop.sh if present). ADD a
   modernized Stop/SubagentStop hook that checks UNMET spec criteria and returns
   hookSpecificOutput.additionalContext ("criteria X,Y still unmet — continue")
   instead of erroring or looping. Show it returning feedback once.
4. RETIRE the .ralph-migration-active marker (migration is DONE) and fix the
   migration-only rule that keys off it so the migration-only hooks stop firing.
5. SURGICAL CODE EDIT (the ONLY app-code change allowed): remove the rescinded "no
   scene-level animation outside the primitives library / AI may not author animation
   from scratch" enforcement from codegen/verifier.ts and prompts.ts (canvas decision
   6 rescinds it). Remove ONLY that rule; change nothing else in those files. Paste the
   before/after lines.
6. BUILD THE VERIFICATION PROTOCOL as reusable artifacts:
   - A documented loop — a /verify skill or slash-command PLUS a "How we build &
     verify" section in kkl/CLAUDE.md — that: make a change → load the app in real
     Chrome → (a) functional layer (DevTools MCP: console errors + structural
     assertions) → (b) vision layer (Claude in Chrome + kv_verify: screenshot, judge
     the look, click/drag/toggle like a user, confirm renders AND functions) → grade
     against the relevant canonical-3 numbered criteria WITH EVIDENCE → on fail, edit +
     retry, applying the ANTI-STUCK RULE.
   - A fresh-context reviewer subagent definition (sees only diff + criteria; reports
     gaps), pinned to claude-opus-4-8.
   - Wire KripVerify (kv_verify) as a first-class primitive; confirm its CURRENT
     capabilities by reading its code/docs on disk.
7. RE-VERIFY-AT-RUN-TIME: confirm the CURRENT wiring/versions for Claude in Chrome,
   Chrome DevTools MCP, KripVerify, dynamic workflows, and the Stop-hook
   additionalContext API before relying on them; web-search if unsure (do not trust a
   stale snapshot).

================================ OUT OF SCOPE (defer to STEP 4) =============
Do NOT do now: fixing preview-as-compile → the in-place state transition in page.tsx;
the single-three / CDN-split runtime fix; unifying the dual edit/save paths;
camera/view-mode behavior; ANY Prism app feature. You may NOTE readiness but make no
app-feature edits. (Task 5's removal is the sole exception.)

================================ OUTPUT + SCOPE LOCK =======================
Write kkl/notes/STEP3-DRIFT-PREVENTION-REPORT.md listing every file created/edited/
moved WITH EVIDENCE (the guard firing; the hook returning feedback; the removed rule's
before/after; the verification-protocol location), plus a "ready for STEP 4" checklist.
SELF-CHECK: prove via diff that NO Prism app feature changed except Task 5's surgical
removal. NO commits. Print the summary and stop. HEAD stays prism-editor-build.
