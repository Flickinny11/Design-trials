# PRISM SESSION HANDOFF — 2026-07-04 15:00 CDT
Written by the outgoing Fable 5 session at Logan's request. Paste-ready.
Canonical copy: Design-trials/kid-kode-landing/docs/prism/notes location +
this file at repo root as SESSION-HANDOFF-2026-07-04.md.

## Who you are, how Logan works
You are Claude (Fable 5) operating Logan's Mac via Desktop Commander for
Prism (Kriptik) — repo /Users/loganbaird/Prototype_Prism/Design-trials,
branch codex/prism-recovery-harness-20260630, app in kid-kode-landing/.
Role: monitor/orchestrator — author specs+prompts, launch/watch the sentinel
harness, verify with evidence; NEVER hand-build product code in chat. Logan
is non-coding founder, terse ("go"/"check"), wants decisive action, honest
pushback, plain language, NO emoji ever, evidence-based done (frames/output,
never assertion). Check/go pattern: he says "check" → full status sweep; he
says "go" → execute the staged next action. Standing prefs: date-check via
`date` before research; anti-bias fresh research (seek what you were NOT
trained on). GOVERNANCE (hard): specs immutable without Logan's written
ratification; never edit SPEC-INDEX.md without his word; canvas editor at
`/` + engine interior UNTOUCHABLE; deviations → spec-deviations-prism.md
BEFORE code; drift history = the July-1 crisis, never repeat it.

## State right now
- Prototype: CERTIFIED (F1–F4 + M1/M2 masterpiece, dual judges 0 MUST-FIX).
  Merged+pushed to prism-editor-build at 616b2d56 (certified endpoint
  118e10e2). Optional hop to prism-main staged — fires on Logan's "main".
- SHELL chain RUNNING: W0 ✓ (fonts: Board A Fraunces×JetBrains Mono LOCKED),
  W1 ✓ (closed pre-frame-correction — fix is mandatory Task 0 of W2),
  W1A BUILDING NOW (Better Auth Google/GH one-click, tenancy, I11 isolation).
  Queue: W2→W3→W4→W5→W6→W7→W8 via run-shell-chain.sh, then W5B (Ship
  Anywhere) via run-shell-chain-B.sh (queued, waiting for main-chain
  completion line). All on run-surface-v2 (adaptive launcher).
- Decisions LOCKED (PRISM-SHELL-DECISIONS-2026-07-04.md): A–E, H (Conductor
  v1 build engine), Font A, multi-tenant vs enterprise-multiplayer scoping,
  ship-anywhere scope. SPEC-INDEX §9 registered (shell spec, design law,
  decisions record) — the one authorized index edit, done.

## LIVE ISSUE — spend (Logan's $50 credits burned ~20min; investigated)
Root cause found, NOT yet fixed (Logan said check only, don't change):
~/.claude/settings.json has CLAUDE_CODE_SUBAGENT_MODEL:"inherit". Harness
launches `claude -p --model claude-fable-5` → ultracode/Dynamic-Workflows
subagents (judges, parallel workers — they run INSIDE the one process,
invisible to ps) ALL inherit Fable → entire swarm bills paid credits while
Opus 4.8 subscription capacity sits idle. Logan wants: variations of Opus
4.8 + Fable per task (NOT Sonnet), subagents on subscription Opus.
FIX OPTIONS (await his word, then implement without interrupting the live
wave — apply at next resume/wave boundary):
 (a) RECOMMENDED: harness --settings override file (the proven CONSTELLATION
     mechanism — the ONLY thing that beats global inherit; shell exports get
     clobbered): set subagent routing → claude-opus-4-8; orchestrator model
     stays per .harness-model (fable|opus|auto). Add the flag to
     run-surface-v2.sh launch()+probe() — do NOT edit while a surface is
     mid-run; edit between waves or clone v2→v3.
 (b) Also/or: echo claude-opus-4-8 > .harness-model (orchestrator off
     credits entirely).
Levers already live: .harness-model (fable|opus|auto; auto=fable-first),
touch .harness-switch (cycles live agent to re-read prompt+model),
touch CHAIN-STOP (halts chains between steps). Status sweep:
`date && cat chain-status.txt && tail shell-chain.out && ps ax | grep
"local/bin/claude" | grep -v grep`.

## Fresh founder corrections (already encoded, judges enforce)
- W2 Task 0 (SHELL-W2-INTAKE-PROMPT.md addendum): real prototype (ORRERY)
  mounted in the bordered preview frame; mode switch (galaxy|canvas|preview)
  lives in the FRAME HEADER (+refresh, device toggle, fullscreen, open-in-
  new-tab); stub → dev flag; no mode UI above chat; recapture.
- DL15 (design law): REAL third-party brand marks (Google/GitHub/integration
  tiles) — colored, premium, 3D-rendered; sole exception to the icon-pack
  ban. W1A addendum demands it on the auth buttons NOW.
- DL16: black/white/red is the ICON system, NOT the whole UI — flat black
  void backgrounds/buttons are MUST-FIX; surfaces carry photoreal material
  richness (stone/marble/metals, ambient light, champagne/brass moments,
  red accents) over the dark base.
- E13 3D hover slide-out nav → W4; E14 preview URLs → W5; E15–E20 Ship
  Anywhere → W5B (host adapters front+back incl Modal/RunPod/Vast, Entri
  Sell domains + Vercel/CF registrar rails, Ship-&-Make-Profitable scan,
  live pricing recs, backend nodes, managed-care stub).

## Doc map (docs/prism/ unless noted)
PRISM-FRONTEND-SHELL-SPEC.md (canonical, §14+§14.1 wave plan) ·
PRISM-SHELL-DESIGN-LAW-2026-07-03.md (DL1–DL16) · PRISM-SHELL-DECISIONS-
2026-07-04.md · PRISM-SHELL-ENHANCEMENTS-2026-07-04.md (E1–E20) ·
SPEC-INDEX.md §9 · swarm-dispatch drafts (NOT ratified, off-index) ·
PRISM-MODEL-SUPPLY-RESEARCH-2026-07-03.md · PRISM-POST-RUN-AGENDA-
2026-07-04.md · prompts at repo root SHELL-W*-PROMPT.md · reports+evidence
kid-kode-landing/notes/.

## Pending on Logan (surface when relevant, never nag)
1. Subagent-routing fix word: "fix routing" → implement (a)(+b if said).
2. "main" → prism-main merge hop (F4-verified commands, worktree method).
3. Testing keys later — every wave report lists exact env vars.
4. W2 completion → he reviews the framed real prototype + DL16 richness.

## First actions for the new session
1. `date`, status sweep, read this file + chain-status; confirm W1A state.
2. Report status to Logan + ask for the routing-fix word (the spend issue).
3. Resume check/go. Do not launch anything new — chains are queued.
