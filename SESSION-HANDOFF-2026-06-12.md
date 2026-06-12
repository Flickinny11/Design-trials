# Prism / KripTik — SESSION HANDOFF (2026-06-12, CANONICAL — supersedes 06-11): "Expansion run mid-flight, physics chained, sentinel v2 on watch"

## HOW TO USE
Paste this WHOLE file into a NEW chat in THIS project, then say "continue". You (new session) have: project knowledge,
Desktop Commander to everything on disk, claude-mem, and this map. FIRST ACTION: check live state (commands below),
independently verify whatever finished, report to Logan plain-language + gallery frames, gate on GO. Logan speaks in
"go"/"check"/brief directives — keep it that simple for him.

## WHO / HOW WE WORK (proven across 3 handoffs)
Logan = non-coding founder; directs only. ALL building via Claude Code headless on his Mac; Claude Chat = MONITOR.
PATTERN: scope-locked self-contained prompt → launch headless → monitor ledgers → INDEPENDENTLY VERIFY (read reports
AND view frames: `sips -s format jpeg -s formatOptions 55 -Z 1200 in.png --out /tmp/x.jpg`, DC read cap 1MB) → plain-
language report + screenshots → gate on GO → next. EVIDENCE OVER ASSERTION, always. Honest pushback welcomed.

## EXECUTION MECHANICS (hard-won — follow exactly)
- CLI /Users/loganbaird/.local/bin/claude v2.1.170. PIN `claude-fable-5` (Fable in plan until ~Jun 22; ~2x burn).
  Cheap side-builds → claude-sonnet-4-6 to protect the Fable window.
- Launch: `cd <git root> && unset NODE_ENV && nohup claude -p "$(cat PROMPT.md)" --model claude-fable-5
  --permission-mode bypassPermissions --output-format text > run.log 2>&1 &`. Text flushes at END only.
- ⚠️ SHELL TRAPS (bit us repeatedly): after `... &`, the foreground continuation LOSES the cd — verify in a SEPARATE
  call or use `(cd /abs/path && nohup ... &)` subshells. pgrep -f SELF-MATCHES sh wrappers carrying script text —
  count REAL agents only by binary: `for p in $(pgrep -f 'claude -p'); do case "$(ps -p $p -o comm=)" in *claude) ...`.
  ps argv of the wrapper ≠ the agent's prompt — inspect the *claude* child with `ps -ww`.
- AUTO-CKPT (Logan-approved): agents self-commit VERIFIED waves ("AUTO-CKPT: ..."), standard exclusions
  (mock-app.prism; ralph-state.json+backups; live-graph backups; verification/**/backups; .claude/worktrees;
  check `git ls-files | grep -c worktrees`=0). Monitor SAFETY-CKPTs any interruption.
- SESSION LIMITS are routine (seen resets 3:10am/5am/2:30pm CT). Probe: `claude -p "Say OK"` → "OK"=open.
  run-sentinel-primexp-V2.sh = status pings + 3-strike death confirm (REAL-binary detector) + AUTO-RESUME (15-min
  probes, relaunches *-RESUME-COMBINED.md, logs "launched" → ./sentinel.log). Kill: `touch ./SENTINEL-STOP`.
- CHAIN: ./run-chain-v2.sh auto-fires the NEXT queued run when current completes (report exists + 3min real-agent
  quiet + probe OK), arms its sentinel, notifies. Kill: `touch ./CHAIN-STOP`. v1 scripts are buggy (phantom detector) — use v2 only.
- LOGAN-INBOX (kid-kode-landing/notes/LOGAN-INBOX.md): live mid-run directives; loops poll at wave boundaries;
  3 delivered + DONE with proof so far. Monitor notes go in the run ledger too.
- MISSION CONTROL: /Users/loganbaird/PrismMissionControl → ./start.sh → http://localhost:4321 (node path patched).
- Notifications: osascript; notify-watch.sh retired in favor of sentinels.

## LOGAN'S CODIFIED QUALITY BARS (non-negotiable, in prompts + advocate rubric)
Photoreal/premium 4K motion-graphics; NOTHING flat/blocky/AI-built-looking; advocate judges at DPR-2 with ZOOMED CROPS
vs "professional 3D designer" + SIDE-BY-SIDE "visibly SMASHES Slider Revolution"; docs/prism/DESIGN-REFERENCES.md
(1,066 lines, 29+ libs) = REQUIRED toolkit for ALL UI + DEPENDENCY-USAGE TABLE in reports; NO PURPLE in chrome (open
question for Logan: violet showcase orb in ORRERY Home hub — retint if he says so); editor = the showcase of the stack
we sell; Logan's finish-line quote verbatim in rubrics ("damn, this is really good looking...").

## THE ARC (compressed; details in notes/ reports)
Pre-06-08 (older handoffs): specs hardened, verification loop built, steps 4-8.6 core editor. THIS ARC: 312-primitive
catalog (5fa695f) → parallel verify harness 3-5x/realGPU 25-40x (920237c) → Material+Lighting T0/T1/T2 (4fdd78e) →
art-polish (c1cba73) → USER-ADVOCATE evidence-gate (2e422fb) → volumetric sweep, slab→smooth, 1st Fable run (584b92d)
→ Observatory Brass design system (AUTO-CKPTs→0d0afa9) → CANVAS COMPLETION RUN P1-P6 (~26h, 9baa249→d1c3485): text
MSDF 1,935 fonts + sharpness=MIP-corruption fixed; picker→bindings→plays; media; 3D objects; punch-list 312/312 +
2,536 tests/0 fail; §18 = 20 MET/5 PARTIAL/6 UNMET (absence-proven, product-scope) → UI-FIDELITY-2 (→2e423f8, ONE
session): real-material chrome +0.2ms prod cost, advocate "SR ceiling cleared", ORRERY No.7 5-hub showcase (16 fal
imgs FLUX.2-pro/seedream, 4 Hunyuan3D meshes, Kling video-texture; fal spend $4.02/$50), gizmo fixed, secret-leak 8/8.
fal: FAL_KEY in kid-kode-landing/.env.local — REMIND LOGAN TO ROTATE IT post-project (passed through chat).

## LIVE STATE RIGHT NOW (2026-06-12 ~1pm CT)
RUN IN FLIGHT: PRIMITIVES-EXPANSION (~60-100 new primitives from DESIGN-REFERENCES + P0 fixes).
- DONE: P0 ✅ (5 primitives root-caused incl. scroll-depth-dolly "ORRERY headline killer"; fixed __catalogSeek bug in
  the advocate capture itself; ckpt ff8b9c6; suite 2,562/0). W1 MORPH: 14 authored + unit-green, browser verification
  INCOMPLETE (limit-killed; safety-ckpt 69ae119).
- STATUS: agent DOWN on session limit (resets 2:30pm CT). SENTINEL v2 alive → will auto-resume + log "launched".
  Resume = ./PRIMITIVES-EXPANSION-RESUME-COMBINED.md (re-verifies W1 then W2 scroll-story → W3 distortion → W4 cursor
  → W5 particles → WF report+no-regression). Ledger: notes/verification/PRIMITIVES-EXPANSION-PROGRESS.md.
- CHAIN v2 armed: on expansion completion auto-fires ./PHYSICS-FLUID-PACK-PROMPT.md (research-first stack decision —
  NOT liquidfun-era; Rapier/Jolt/WebGPU-compute per June-2026 web research; ~30-50 sim primitives tier-gated) with
  ./run-sentinel-physics.sh (NOTE: physics sentinel is v1-pattern — REGENERATE with the v2 real-binary detector before
  it arms, or patch run-chain-v2's NEXT_SENTINEL to a v2 copy. Known follow-up!).

## IMMEDIATE NEXT ACTION (new session)
1. Check: real agents (binary-comm count), sentinel.log "launched" lines, ledger checklist, git log for AUTO-CKPTs.
   If running → monitor/verify/report. If down + past reset → confirm sentinel resumed; if sentinel failed, SAFETY-CKPT
   then manually relaunch resume prompt + sentinel v2 (mechanics above).
2. FIX the physics-sentinel v1 issue above BEFORE the chain fires it.
3. When expansion completes: INDEPENDENT verify (galleries, dependency-usage table, no-regression), report Logan, gate.
   Physics auto-fires; same loop. After physics: prototype runway COMPLETE → full review, then next horizon per specs
   (§18 UNMET product features, engine/harness, AI-relighting harness item, key rotation).

## REASSURANCE
Everything real is ON DISK (git + ledgers + reports + prompts + this doc). Chat context is disposable. The pattern has
survived 3 handoffs, 4 limit-kills, 1 model migration, and 2 of its own bugs — each made the system stronger.
