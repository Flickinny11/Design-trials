# Prism / KripTik — Session Handoff (2026-06-01)

**Purpose:** Carry the full context of a long working session into a fresh Claude chat in the "diffusion app" project so we continue *exactly* where we left off, with no lost momentum. Add this file to the project knowledge (or keep it on disk for Claude Code).

---

## WHERE WE ARE RIGHT NOW (the single most important line)
A read-only audit of the Prism codebase just completed. The report is on disk at:
`/Users/loganbaird/Prototype_Prism/Design-trials/AUDIT_REPORT.md`

The next action is **NOT to start editing**. It is to answer the **15 OPEN QUESTIONS** at the end of that report, then proceed through the phased plan below. Nothing in the repo has been changed (HEAD = `prism-editor-build` @ `3c9be0a`).

## THE GOAL
Logan (non-coding founder; directs everything through Claude/Claude Code prompts) is getting unstuck to finish: the **Prism prototype + node editor**, then the **engine, harness, and runtime**, toward a production app-builder. The concept is well-developed; the blocker has been process, not vision.

---

## HOW WE WORK (read this before anything)
- **Recency wins.** The most recently created spec and the most recent conversations hold the correct goals. Older spec versions are superseded even if they still say "canonical."
- **Use claude-mem.** The brainstorming history (all the spec versions) is in memory; use it to *propose* answers to the 15 questions — but flag which are genuine Logan-only decisions and confirm before any change.
- **The project has docs the repo doesn't.** Reconcile the 20 project docs against what the audit found in the repo (e.g., the "caption spec," `DIFFUSION-ENGINE-SPEC.md`, `PRISM_ENGINE_BROWSER_BASED_SPEC.md`, `Editor_UI_Rough_Spec` are referenced but absent from the repo — they may live in the project).
- **No changes without Logan's confirmation.** Audit → propose → gate → act. One gated phase at a time.

---

## KEY ARCHITECTURE DECISIONS MADE THIS SESSION (authoritative)
1. **Contract-first planning.** Opus's most important output is a *frozen interface/contract layer* (typed interfaces, env vars, shared design tokens, integration map). Parallel node agents build **against the contract**, NOT by negotiating with each other at runtime ("call Joe" = race conditions/deadlocks). Peer messaging is the rare escalation path, not the mechanism.
2. **Knowledge graph = blackboard.** Nodes publish their contract to the shared graph (append-only, conflict-free/hash-based IDs, à la Beads). Others read it from the graph; nobody mutates another node's contract.
3. **Progressive asset streaming.** Code is fast; 3D/image generation is the real wall-clock floor. Build structure + placeholders first, hot-swap final assets in after visual verification. Bound the regenerate-on-fail loop.
4. **Integrations via user-supplied API keys / OAuth for EXISTING accounts.** Never auto-create accounts (browser signup is CAPTCHA/ToS-fraught). Prefer scoped OAuth delegation over storing raw keys (liability). Emerging sanctioned paths: OAuth 2.0 On-Behalf-Of for agents, Web Bot Auth. Agentic-commerce protocols (ACP/AP2/x402) are buyer-side, mostly not our use case (AP2 "mandates" = the scoped-delegation primitive to aim at). Build a signup *handoff* (deep-link user to platform's own signup), not auto-signup.
5. **Self-healing = detect → isolate (circuit breaker, serve fallback) → diagnose → fix in shadow → validate → hot-swap → rollback.** Never blind hot-patch live apps. This is what makes the paid monitoring tier safe to sell.
6. **Token model correction:** user-supplied tokens are for *integration + deployment* (agents authenticating into Stripe/RunPod/DB/host on the user's behalf), NOT for paying build-time inference. So *Logan* eats build-time model cost → the cheap/fast open-weight executor tier is his margin.

## COMPETITIVE FRAMING (validated this session)
Nobody ships the *combination*: Claude.ai/design-level UI + Slider-Revolution-level optional 3D visuals + minutes-not-days builds + self-healing + genuinely production-ready. Competitors (Lovable, Bolt, v0, Cursor, Replit) build linearly or in small agent teams. **The durable moat is the coordination architecture (contract-first + blackboard) that lets massive parallelism stay coherent — NOT the agent count.** "Production-ready" is the sharpest wedge *and* the biggest credibility risk; the supervision layer (verifier + hub-manager + self-heal) is what earns the right to claim it.

---

## DRIFT-PREVENTION PLAYBOOK (replaces Ralph loops)
The old loops verified that *work happened*, not that the *right outcome* happened — that's a definition-of-done problem, not a loop problem. The new playbook:
- **Hardened spec = single source of truth, with OBSERVABLE acceptance criteria** (e.g., "change node A-3 color in editor → apply → rendered node shows new color," not "editor lets you edit nodes").
- **Evidence-based done:** the agent shows proof (command output, test output, screenshot of the rendered runtime). Never "I added it."
- **Fresh-context reviewer subagent:** sees ONLY the diff + acceptance criteria, reports gaps. Replaces "loop until done."
- **PreToolUse dependency guard:** the surgical replacement for stop-hook loops (blocks edits to package.json/lockfiles/forbidden imports). NOTE: the repo already has `dependency-allowlist-check.sh` but it is currently UNWIRED — re-wire it.
- **Model config (critical):** use `/model opus` = Opus 4.8 for BOTH planning and coding. Do **NOT** use `opusplan` (it switches to Sonnet for implementation — this is the "plan mode sends Sonnet" behavior Logan observed). Pin `claude-opus-4-8` (e.g. `ANTHROPIC_DEFAULT_OPUS_MODEL=claude-opus-4-8`) and set the model explicitly in every subagent definition (beware silent Sonnet fallback at usage thresholds). Requires Claude Code v2.1.154+. Use `ultracode` / Dynamic Workflows (Opus 4.8 coordinates hundreds of parallel subagents with adversarial verification, capped ~1,000) for the big parallel node builds LATER — not the focused editing now.

---

## AUDIT HEADLINE FINDINGS (full detail in AUDIT_REPORT.md)
- **Branch:** continue from `prism-editor-build` (newest 2026-05-20, 430 ahead of `prism-main`, superset of all other editor/codex/worktree branches). Unmerged work to decide on: `prism-renderer-ralph` (+64 commits — a whole renderer-migration line incl. a richer 5-hub mock) and `power-cut-iter18-salvage` (+2 commits — failing Save-and-Rebuild test stubs). Four `claude/*` worktrees are stale.
- **Load failure did NOT reproduce** on a clean run (dev + prod both HTTP 200, 12 nodes render, 0 console errors). The 500 seen (`Cannot find module './vendor-chunks/three.js'`) was self-inflicted by running `next build` while `next dev` shared `.next/`. Ranked real causes: (1) stale `.next/` cache → `rm -rf kid-kode-landing/.next` first; (2) Vercel/CDN import-map path (runtime player loads three.js from jsdelivr at page load — production-only fragility).
- **Automation:** `ralph.sh` family = loop drivers (archive them). Hooks = guardrails (keep). No cron/launchd auto-runner. Global `photoreal-block-stop.sh` is a Stop loop driver but cwd-scoped to OpenDesign (inert here). Two dangling Stop/UserPromptSubmit refs to `.disabled` kripverify scripts (clean up). **`dependency-allowlist-check.sh` is UNWIRED (re-wire it).**
- **Specs:** mid-supersession with 5 quoted contradictions (C1–C5): the false "docs/prism/* not on disk" claim in `kid-kode-landing/CLAUDE.md`; "5 canonical view modes" vs "exactly 3" in the same file (code runs 3); CLAUDE.md describes a PixiJS app that was migrated to Three.js; renderer-migration "done-ness" asserted three ways. Proposed canonical-4 + `/archive` plan in the report. **No "caption spec" exists in the repo.**
- **BIG ONE — existing vs intended:** the **engine (the actual diffusion app-builder) is NOT built.** What shipped is the **node editor + a runtime player for one hand-authored mock** (1 hub / 12 nodes). The generation/codegen/asset/deploy pipeline was explicitly out-of-scope of the loop that ran. Honest framing: finishing the prototype + editor is real, but the engine/harness/generation pipeline is still ahead.

## THE 15 OPEN QUESTIONS — approach
They're in AUDIT_REPORT.md → "OPEN QUESTIONS FOR LOGAN." Most-blocking: Q1 (merge or abandon the 64 renderer commits?), Q5 (may we load the live Vercel URL to test the real load failure?), Q11 (is the renderer migration actually done?). For each: propose an answer from claude-mem + recency, mark genuine Logan-only decisions, confirm before acting.

---

## PHASED PLAN (where we are = end of Phase 1)
1. **Phase 1 — Audit (DONE).** AUDIT_REPORT.md produced; zero changes.
2. **Phase 2 — Answer the 15 questions + collapse to one source of truth.** Resolve C1–C5, pick canonical-4, archive the rest (move, don't delete), fix the false CLAUDE.md claims, re-wire the dependency guardrail, retire the loop drivers.
3. **Phase 3 — Harden the spec** with observable acceptance criteria per component. Highest-leverage missing artifact = the **plan/caption spec** (the doc that lets "the models that come next know what to do"). Its absence is generating downstream chaos.
4. **Phase 4 — Stand up the drift-prevention scaffolding** (CLAUDE.md as constitution → hardened spec; PreToolUse guard live; fresh-context reviewer subagent pinned to Opus 4.8; evidence-based done protocol).
5. **Phase 5 — Infra-first implementation** (world/plan-storage → plan/caption spec → editor actually mutating nodes → engine/harness fan-out), each verified against acceptance criteria with evidence, in gated chunks via ultracode + Opus 4.8. Logan iterates on visuals.

**Immediate next step for the new session:** walk Logan through the 15 questions (proposing answers from memory + recency), then move into Phase 2/3.
