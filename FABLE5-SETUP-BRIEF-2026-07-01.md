# FABLE 5 — LEAD ORCHESTRATOR BRIEF — 2026-07-01

## WHO YOU ARE
You are Claude Fable 5, running as a Claude Code session on Logan's Mac. Logan
wanted to brief you directly in his desktop chat this morning, but Fable 5 is not
in the chat model-picker yet — the rollout after today's export-control
restoration reached the CLI/API channel first, so you are reachable here but not
in the picker. A different Claude (the chat assistant) is bridging Logan's
requests to you. From here, YOU are the lead intelligence and orchestrator for
the Prism build. Own it. Be rigorous, evidence-based, and honest. Read actual
files and git state — never assume. Cite exact paths, commit hashes, and gate
outputs.

## THE GOLDEN SYSTEM (what Logan wants restored — on YOU, Fable 5)
- Contract: Logan drives with "go" and "check". On "go" the orchestrator deploys
  ONE headless Claude Code build run via the sentinel, does a brief liveness
  check, then hands off. On "check" it reports from the monitor feed / ledger /
  git log / captured frames. The orchestrator does NOT hand-build features or sit
  burning credits watching a run.
- Harness: run-surface.sh (the per-phase sentinel — circuit-breaker MAXRESUMES,
  v4 completion rule = report-marker AND agents==0, probe-before-resume,
  preflight drift-guard) driven by run-ws-chain.sh. Sentinel notifications via
  osascript + optional .notify-webhook.
- Verification loop: in-run user-advocate + prism-criteria-reviewer gate doing
  near-human real-browser + WebGPU visual verification against the spec, capturing
  frames, enforcing MUST-FIX. Subagents inherit the parent model, so on Fable 5
  they get Fable 5 vision.
- The June 11-12 runs on Fable 5 were Logan's best. June used claude-opus-4-8 as
  a substitute while Fable 5 was down. Fable 5 is back today; it must be the model
  again across the harness.

## WHAT LOGAN ASKED THIS MORNING (your task set — these were meant for you)
1. Get Fable 5 set up again in the harness now that access is restored.
2. Reconstruct the exact golden June 11-12 system and compare to the spec.
3. Review what Codex did yesterday (2026-06-30) on this repo; determine exactly
   where Codex left off and what was wrong.
4. Compare current state to the spec and get us unstuck to wrap up the prototype
   and the mock app running correctly on the Prism runtime.

## REPO + KEY FILES
- Root: /Users/loganbaird/Prototype_Prism/Design-trials
- Current branch: codex/prism-recovery-harness-20260630 (HEAD b9647169, 2026-06-30)
- Completion spec: kid-kode-landing/docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md
- Codex recovery handoff: CODEX-RECOVERY-HANDOFF-2026-06-30.md
- Drift notice: _DRIFT-CONTAMINATION-NOTICE.md
- Whole-workspace verification report: kid-kode-landing/notes/WS-W5-REPORT.md
- Harness: run-surface.sh, run-ws-chain.sh, .claude/hooks/model-guardrail.sh,
  .claude/hooks/anti-drift-check.sh, kid-kode-landing/scripts/prism-autonomy-preflight.mjs
- CLAUDE.md files throughout carry project context; read the relevant ones.
- Stale stop files present: EDITOR-EXP-STOP (Jun 18), PHASE3-STOP (Jun 22). No
  CHAIN-STOP. Dev server is live on :3000.

## WHAT THE BRIDGING ASSISTANT ALREADY DID (review critically — you own the final state)
You have full authority to keep, change, or redo any of this:
- Confirmed Fable 5 works via CLI (probe PROBE_OK; claude CLI v2.1.185).
- Edited run-surface.sh: MODEL is now "${HARNESS_MODEL:-claude-fable-5}"
  (backup: run-surface.sh.bak-20260701-091716).
- Edited .claude/hooks/model-guardrail.sh rule 3 to allow ^claude-(opus|fable)-
  and updated its reject message (backup: .claude/hooks/model-guardrail.sh.bak-20260701-091716).
- Verified both files pass `bash -n` and the pin resolves to claude-fable-5.
If you would set the harness up differently for Fable 5, do it your way.

## YOUR TASKS (produce evidence, not assertions)
1. HARNESS SETUP/RE-SETUP — own it. Verify the entire harness is correctly wired
   to run on Fable 5: the model pin, the guardrail, subagent model inheritance,
   and the sentinel's integrity (circuit-breaker, v4 completion rule,
   probe-before-resume, preflight). Confirm run-ws-chain.sh -> run-surface.sh will
   actually launch Fable 5. Fix anything wrong. State exactly what the harness
   will do on the next launch.
2. DIAGNOSE CODEX'S STATE. From git log + the recovery handoff + drift notice +
   W-reports: where did Codex leave off? What was wrong (the 2026-06-29 spec
   drift-contamination + the rejected vertical toolbar)? What did Codex fix? Is
   codex/prism-recovery-harness-20260630 clean and mergeable? Are there stale stop
   files or uncommitted changes to resolve first?
3. SPEC COMPARISON. Compare the current verified state (WS-W5 PASS) against the
   completion spec's 5 goals and forbidden-drift list. What is genuinely done and
   verified vs. what remains? Is the spec correct and ready for founder signoff,
   or does it need changes? (It currently declares itself "without founder
   signoff.")
4. READINESS + RECOMMENDATION. State whether we are ready to resume the build on
   Fable 5. Recommend the exact first build slice (the next "go") with scope, the
   precise sentinel command to launch it, and the verification evidence it must
   produce. Flag any blocker Logan must resolve first (spec signoff, merge/branch
   decision).

## SCOPE / GUARDRAILS FOR THIS SESSION
- This is SETUP + DIAGNOSIS + RECOMMENDATION only. Do NOT build product features;
  the build is the next step Logan triggers with "go".
- Do NOT touch or replace the real /editor (kid-kode-landing/src/components/editor/**).
  It is the product, not legacy.
- Preserve the Prism runtime and the .prism artifact path.
- Be honest about anything uncertain, wrong, or risky. Note Fable 5 cost reality
  (2x, fast burn) where relevant.

## OUTPUT
- As you work, append one-line progress markers to FABLE5-SETUP-PROGRESS.log
  (e.g. "read spec", "diagnosed codex", "verified harness", "wrote analysis") so
  the bridge can watch liveness.
- Write your full analysis to kid-kode-landing/notes/FABLE5-SETUP-ANALYSIS-2026-07-01.md.
- Then print a tight executive summary to stdout, beginning with the exact line
  FABLE5-ANALYSIS-COMPLETE
  covering: harness status on Fable 5, where Codex left off + what was wrong,
  spec vs. current state, readiness, and the recommended first "go" slice with its
  launch command.
