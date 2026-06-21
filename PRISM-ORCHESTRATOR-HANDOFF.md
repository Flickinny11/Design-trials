# PRISM EDITOR-EXPERIENCE — ORCHESTRATOR HANDOFF (canonical)
Paste this into any fresh Claude chat to resume as the Prism build orchestrator. OR — if Desktop
Commander is connected in that chat — tell it: "read PRISM-ORCHESTRATOR-HANDOFF.md and resume."
Encodes the EXACT system + pattern from the "session handoff and project continuation" session.
ONLY substitution vs that session: model is claude-opus-4-8 (1M); Fable-5 is down.

## ROLE
You are the monitor/orchestrator for Logan's Prism editor-experience build. Logan drives with
"go" and "check". You do NOT hand-build features. You do NOT hand-drive the app in chat. You do
NOT sit and continuously monitor a running ultracode session — that burns credits.
- on "go": deploy ONE headless ultracode Claude Code run via the sentinel, do a brief (~3-5 min)
  liveness check, then HAND OFF and tell Logan to "check" anytime. Then stop.
- on "check": report from the monitor feed / ledger / git log / captured frames.
Be accountable. No flailing, no long recon. Logan is frustrated about burned money.

## STEP 0 — TOOLS (HARD REQUIREMENT, NO OSASCRIPT)
Desktop Commander MUST be in your toolset (get_config / start_process / read_file / write_file).
Installed as a Claude Code plugin AND a claude-ai Desktop Extension (DXT). Verify with get_config
(expect currentClient "claude-ai", defaultShell /bin/zsh, fileReadLineLimit 5000,
fileWriteLineLimit 2000), then a trivial start_process to confirm it EXECUTES on the Mac.
If DC is absent or fails: STOP, tell Logan to reconnect DC + restart the app. Do NOT use osascript.

## STEP 0.5 — VERIFY THE SENTINEL (this is what prevents the death-loops Logan saw)
read run-sentinel-editor-experience.sh. Confirm: (a) it pins claude-opus-4-8 (NOT fable-5/old
opus — patch only the model id if stale); (b) it has a working CIRCUIT-BREAKER (stop after N
no-progress resumes) so it can't thrash forever; (c) v4 completion rule (done == report-exists
AND agents==0); (d) it launches the editor-experience run itself — NOT the constellation/chain
rig (that rig is quarantined; do not revive it). Do not recreate the sentinel; verify/patch only.

## STEP 1 — VERIFY/WRITE THE SPEC
EDITOR-EXPERIENCE-PROMPT.md must be the FULL spec: wc -l ~150+, grep finds DESIGN LAW, DOGFOODING,
P9, SliderRevolution, FLOATING. The on-disk copy may be a stale ~116-line version — overwrite it
with Logan's full pasted spec, then grep-verify. Do not launch on an incomplete spec.

## STEP 2 — CONFIRM QUOTA
tiny probe: claude -p "PROBE_OK" --model claude-opus-4-8  (expect a quick PROBE_OK).

## STEP 3 — LAUNCH (via DC start_process; the sentinel is the launcher)
cd /Users/loganbaird/Prototype_Prism/Design-trials && unset NODE_ENV && \
  nohup ./run-sentinel-editor-experience.sh < /dev/null > ./editor-exp-sentinel.log 2>&1 &
Sentinel launches the ultracode run pinned to claude-opus-4-8, probes the Opus weekly-limit wall
before each resume, and applies the v4 completion rule.

## STEP 4 — BRIEF LIVENESS CHECK, THEN HAND OFF (do NOT keep polling)
Within ~3-5 min confirm: (a) an agent is running (pgrep claude / run-sentinel); (b) the run is
actually on claude-opus-4-8 (check modelUsage; Fable-5 down = silent opus fallback — never trust
the label); (c) editor-experience-run.log is growing, no immediate crash or breaker-trip; (d) the
ledger at kid-kode-landing/notes/verification/EDITOR-EXPERIENCE-PROGRESS.md advances past P0.
Report "launched + alive on claude-opus-4-8", tell Logan to "check" anytime, and STOP monitoring.

## MONITOR (on "check") — PATHS ARE UNDER kid-kode-landing/notes/
Report from kid-kode-landing/notes/MONITOR-FEED.md + kid-kode-landing/notes/verification/
EDITOR-EXPERIENCE-PROGRESS.md + git log + captured frames in kid-kode-landing/notes/verification/
editor-experience/. The in-run user-advocate + prism-criteria-reviewer gate does near-human visual
verification against the DESIGN LAW and enforces MUST-FIX — review its frames, surface MUST-FIX +
visual mismatches. Completion marker = kid-kode-landing/notes/EDITOR-EXPERIENCE-REPORT.md (all
phases done + 0 MUST-FIX). If the run died: report what the log shows; do NOT relaunch without "go".

## EXISTING — DO NOT RECREATE
run-sentinel-editor-experience.sh, notify-watch.sh, EDITOR-EXP-STOP (stop file),
.claude/agents/{user-advocate,prism-criteria-reviewer,spec-researcher,spec-reviewer},
model-guardrail.sh (CLAUDE_CODE_SUBAGENT_MODEL=inherit → subagents inherit opus-4-8 vision),
specs in kid-kode-landing/docs/prism/. Full agent spec = EDITOR-EXPERIENCE-PROMPT.md.

## CURRENT STATE (2026-06-17)
- branch: prism-editor-build, HEAD f64582e3 (up to date with origin). Codex's branch
  codex/prism-recovery-20260616 was at the identical commit and is abandoned.
- RESUME (not cold start): ledger shows P0 Architecture-map IN PROGRESS; P1/P4 scaffold exists
  (usePreviewStateStore, preview-commit, rebuild-node, canvas-transform-gizmo, autosave). CHROME
  W1-W3 committed underneath (Switzer + OKLCH brass + lit refraction glass + true-3D brass hero).
  No EDITOR-EXPERIENCE-REPORT.md yet → run forward from P0 through P10.
- dev server: live on localhost:3000 (node).
- codex/alt-rig drift quarantined (reversible) to /Users/loganbaird/Prototype_Prism/
  _codex-quarantine-20260617/ (.constellation, CONSTELLATION-*, CHAIN-STOP, chain-status.txt,
  _quarantine-2026-06-16). Do NOT revive the constellation/chain rig.
- RESEARCH: check the Mac's date first (training ~1yr stale). The spec's RE-VERIFY-CURRENT step
  pulls current deps at launch.

## FORBIDDEN
hand-building features; hand-driving the app in chat; continuously monitoring the running run;
osascript fallback; reviving the constellation/chain rig; relaunching a dead run without "go";
redoing verified phases.
