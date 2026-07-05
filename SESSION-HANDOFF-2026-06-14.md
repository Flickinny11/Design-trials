# Prism / KripTik — SESSION HANDOFF (2026-06-14, CANONICAL — supersedes all prior). Paste this whole file into a NEW chat in THIS project + say "continue".

## HOW TO USE / HOW WE WORK
Logan = non-coding founder; directs via "check status" / "go" / brief corrections. Claude Chat = MONITOR; ALL building via
headless Claude Code on Logan's Mac (Desktop Commander). PATTERN: scope-locked self-contained prompt → launch headless →
monitor ledgers → INDEPENDENTLY verify (read reports AND view frames: `sips -s format jpeg -s formatOptions 60 -Z 1200
in.png --out /tmp/x.jpg` then read the jpg; DC read cap 1MB) → plain-language report + screenshots → gate on GO. EVIDENCE
OVER ASSERTION. Be the HARD VISUAL JUDGE (Logan caught fonts/orbs/blank-surfaces the advocate passed — show him frames,
he is final judge). Bar = WOW; "acceptable/passes" == FAIL. FIRST ACTION in new session: check live state (commands
below), verify what finished, report + gate.

## EXECUTION MECHANICS (hard-won — follow exactly)
- Working dir `/Users/loganbaird/Prototype_Prism/Design-trials` (git root), branch `prism-editor-build`. App in `kid-kode-landing/`.
- CLI `/Users/loganbaird/.local/bin/claude` v2.1.170.
- **MODEL: Fable-5 is DOWN — silently falls back to opus-4-8 (VERIFIED: requesting fable returns modelUsage=claude-opus-4-8).
  ALL runs/sentinels/chains pinned to explicit `claude-opus-4-8`. NEVER trust the label — verify modelUsage via probe.
  Fallback guard is written into prompts. If fable returns someday, verify modelUsage before switching back.**
- Launch (use a /tmp script to avoid quote breakage): `cd <root> && unset NODE_ENV && nohup
  /Users/loganbaird/.local/bin/claude -p "$(cat PROMPT.md)" --model claude-opus-4-8 --permission-mode bypassPermissions
  --output-format text > run.log 2>&1 &`. Text flushes at END only (can't read run.log mid-run; use the ledger).
- **SHELL TRAPS (bit us repeatedly):** (1) inline nested quotes/`case`/`for` in start_process BREAK with "unexpected EOF";
  write a `/tmp/*.sh` helper and run it. (2) `pgrep -f 'claude -p'` SELF-MATCHES sh wrappers; `pgrep -fl`/`ps|grep` also
  self-match the grep — count REAL agents ONLY by binary: helper at `/tmp/realagents.sh` (counts procs whose comm is
  *claude). (3) after `... &`, foreground continuation LOSES the cd — use `(cd /abs && nohup ... &)` subshells or /tmp
  scripts. (4) verify sentinel/chain counts with `ps ax -o args | grep NAME | grep -vcE 'grep'`.
- AUTO-CKPT (Logan-approved): agents self-commit VERIFIED phases ("AUTO-CKPT: ..."); standard exclusions
  (mock-app.prism; ralph-state.json+backups; live-graph backups; verification/**/backups; .claude/worktrees; verify
  `git ls-files | grep -c worktrees`==0). Monitor SAFETY-CKPTs interruptions (targeted `git add <files>`, NOT -A while an
  agent runs, to avoid races).
- SESSION LIMITS routine (seen resets 3:10am/5am/2:30pm CT). Probe: `claude -p "Say OK" --model claude-opus-4-8` → "OK".
- **Sentinels v2 (real-binary detector)** `run-sentinel-<name>.sh` = status pings + 3-strike death confirm + AUTO-RESUME
  (15-min probes, relaunches `*-RESUME-COMBINED.md`, logs "launched" → `./sentinel.log`). Kill: `touch ./SENTINEL-STOP`.
- **Chain-runner v2** `run-chain-<name>.sh`: auto-fires NEXT queued run when current completes (report exists + 3-min
  real-agent quiet + probe OK), arms its sentinel, notifies. Kill: `touch ./CHAIN-STOP`. ONE browser-driving run at a
  time (Chrome/dev-server/git contention) — serialize via chain. v1 scripts had a phantom self-match bug; v2 fixes it.
- **LOGAN-INBOX** `kid-kode-landing/notes/LOGAN-INBOX.md`: live mid-run directives; loops poll at phase boundaries.
- **Mission Control** `/Users/loganbaird/PrismMissionControl` → `./start.sh` → http://localhost:4321.
- View frames: resize then read the jpg. **Phone review URL: http://192.168.0.198:3000** (Mac LAN IP en1; `npx next dev
  -H 0.0.0.0 -p 3000` from kid-kode-landing via node v24.15.0; first load compiles=slow; live view in flux during builds).
- **fal**: `@fal-ai/client`; FAL_KEY in `kid-kode-landing/.env.local`. **REMIND LOGAN TO ROTATE IT post-project (it passed
  through chat).** $50 budget; cumulative spend ~$0.48 across ALL runs to date. Never print the key; secret-leak check before checkpoints.

## LOGAN'S QUALITY BARS (non-negotiable; in prompts + advocate rubric)
Photoreal/premium 4K motion-graphics; NOTHING flat/cold/AI-built; advocate judges at DPR-2 with ZOOM CROPS vs "pro 3D
designer" + SIDE-BY-SIDE "visibly SMASHES Slider Revolution"; `docs/prism/DESIGN-REFERENCES.md` (1,066 lines, 29+ libs)
= REQUIRED toolkit for ALL UI, COMBINED for signature wow, + a dependency-usage table in reports; NO PURPLE in chrome;
prompt→texture on text; editor = the showcase we sell; mobile + constrained(preview-pane) must be LIGHTNING fast (this
whole view embeds in an AI-builder preview pane w/ chat on the left, expandable to fullscreen). One renderer (Three.js
r184+ / TSL / WebGPU; NO 2nd renderer/PixiJS). No stock icons. No diffusion-drawn letterforms (INV-11 real font outlines).
Verification must INTERACT (build/edit/navigate a real scene), not just inspect. Finish-line quote in rubric: "damn,
this is really good looking. it's intuitive, easy to use, and all those animations and primitives are awesome..."

## THE ARC (git checkpoints on prism-editor-build; details in notes/ reports)
312-primitive catalog → parallel verify harness → Material+Lighting T0/T1/T2 → USER-ADVOCATE evidence gate → Observatory
Brass design system (NO PURPLE) → CANVAS COMPLETION RUN (text MSDF 1,935 fonts, picker→bindings→plays, media, 3D objects,
312/312, §18 20MET/5PARTIAL/6UNMET) → UI-FIDELITY-2 (real-material chrome, ORRERY No.7 5-hub showcase w/ fal: FLUX/seedream
imgs + Hunyuan3D meshes + Kling video; gizmo fixed) → PRIMITIVES-EXPANSION (catalog→370) → PHYSICS-FLUID (+36 sim prims,
hand-rolled deterministic integrators, no new dep; registry ~406) → CANVAS-PRODUCTION-FINAL (Change-Artifact wizard wired
to fal = "Prism Media Generator", credit-metered, fal-invisible; signed off) → PREBUILT-LIBRARY (criterion 21 closed: 36
premium element-clusters across 16 categories, drag-to-place, hybrid customization) → UI-WOW (font cascade-race fixed,
typography/chrome/library beauty) → UI-WOW-2 (mobile container-density + bottom sheets, keyframe premium+smoky-expand,
GALAXY transformed [glowing sun/orbit-rings/energy-tethers/nebula], perf 60fps mobile+desktop, prompt→texture on text) →
3D-TEXT (just signed off WOW: true extruded 3D text from opentype outlines, font preview gallery, B/I/S/U, shadow
offset/color/opacity/blur, prompt→texture on 3D faces).

## LIVE STATE (2026-06-14, latest)
APP REALITY — FINISHING (into P9 verification, advocate browsers active). P1-P8 all checkpointed: P1 camera model
(canvas FREE 3D / preview LOCKED + full-bleed + reset-to-zero HUD w/ angle readout + haptic) - P2 keyframeable camera
journeys (canvas authors, preview plays) - P3 edit-in-preview - P4 full-viewport hub background desktop+mobile - P5
real-responsive device modes (not resized frames) - P6 hub navigation in preview - P7 Function binding (the AMENDMENT) +
premium holographic overlay payoff - P8 nav chrome primitives (header/footer/dropdown/menu). Prompt ./APP-REALITY-PROMPT.md,
ledger notes/verification/APP-REALITY-PROGRESS.md, report notes/APP-REALITY-REPORT.md (skeleton until P9 done), frames
notes/verification/app-reality/. Sentinel run-sentinel-appreality.sh armed.
SENTINEL v4 RULE (learned this session, applies to ALL future sentinels): completion = report-exists AND agents==0. Agents
PRE-CREATE the report skeleton at run start; old v3 read mere file-existence as "done" and exited, leaving the run with no
auto-resume net. The fixed sentinels (appreality, nodeeditor) have this guard; copy from them.
SPEC AMENDMENT 2026-06-14 (end of PRISM-CANVAS-EDITOR-SPEC.md): Function/nav configurable in Canvas AND node editor, synced
via the node's additive schema (single source). App Reality P7 implements the Canvas side.

NODE EDITOR (next big workstream) — SPEC HARDENED + BUILD READY-TO-FIRE:
- docs/prism/PRISM-NODE-EDITOR-SPEC-V2.md (committed): 33 numbered criteria + invariants + forbidden for prompt-to-edit
  (canvas + node), Functions tab, Integrations tab, galaxy planets. LOCKED DECISIONS: provider-agnostic CapabilityProvider
  adapter (MCP default + Pipedream/Composio/Nango stubs - defers vendor/COGS choice); prompt-edit via Vercel AI SDK v6 +
  @anthropic-ai/sdk NEWEST Opus with DESIGN-REFERENCES + 406 primitives + 36-element library injected (premium-first);
  Supabase for saved/named snippets; capability-references-only for secrets (INV-R13); HARNESS/CONTRACT build (UI +
  interfaces + stubs + MCP reference adapter, production-ready so the live AI service + aggregator are a SWAP).
- Build kit READY (committed): ./NODE-EDITOR-PROMPT.md (5 phases), ./NODE-EDITOR-RESUME-COMBINED.md, run-sentinel-
  nodeeditor.sh (v4), launcher /tmp/launch-nodeeditor.sh. FIRE with: bash /tmp/launch-nodeeditor.sh (ONLY after App Reality
  clears - one browser-run at a time). Analysis + live June-2026 tool versions: notes/NODE-EDITOR-HARDENING.md.

QUEUED (fire-on-command, gate on Logan, ONE browser-run at a time): NODE EDITOR (kit ready) - 3D BACKGROUND LIBRARY (massive
depth-scattered 3D backgrounds, image+3D-sprinkle hybrid, animated/customizable, camera-journey ready - prompt not yet
written) - GUIDED TIPS (glowing lightbulb top-right; first-visit walkthrough where Prism "drives the screen": animated
cursor highlights areas, high-tech popups w/ the artifact animated in 3D + premium-type explanation + Skip/Close; built from
primitives + DESIGN-REFERENCES; advocate verifies by interacting - prompt not yet written). Logan picks order; can chain.


## IMMEDIATE NEXT ACTION (new session)
1. Check live state (realagents, sentinel/chain, ledger, git log). If App Reality running → monitor/verify/report/gate.
   If done → INDEPENDENT review (frames at DPR-2, behaves-like-an-app + WOW), show Logan, gate.
2. After App Reality gates: write+fire 3D BACKGROUND LIBRARY, then GUIDED TIPS (same loop), OR proceed to NODE EDITOR
   hardening per notes/NODE-EDITOR-HARDENING.md — Logan's call.
3. Keep "check status"/"go" simple for Logan. Independently verify; show frames; be the hard judge.

## REASSURANCE
Everything real is ON DISK (git + ledgers + reports + prompts + this doc + the hardening doc). Chat context is disposable.
The pattern has survived 4+ handoffs, many limit-kills, a model migration, and 2 of its own infra bugs.
