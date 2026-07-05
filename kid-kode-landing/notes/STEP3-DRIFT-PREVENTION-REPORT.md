# STEP 3 — Drift-Prevention & Verification System — Report

**Model:** `claude-opus-4-8` (confirmed active; not opusplan).
**Mode:** Infrastructure / config setup. **No commits** — all changes left for Logan.
**Branch:** `prism-editor-build` (HEAD unchanged).
**Date:** 2026-06-05.

The ONLY app-code (`src/**`) edit is Task 5's surgical removal. Everything else is
hooks / settings / commands / agents / markers / docs. Self-check proof at the end.

---

## Task 1 — Ralph/Harness loop drivers ARCHIVED (moved, not deleted)

`git mv` into `kid-kode-landing/scripts/archive/` (shell scripts) and
`…/scripts/archive/commands/` (slash-command workers — moving them out of
`.claude/commands/` **de-registers** `/ralph-step`, `/kickoff-*`, `/harness-step`
so the loops can't be launched).

| Moved | From → To |
|---|---|
| `ralph.sh`, `ralph-resume.sh`, `kickoff-loop.sh`, `harness.sh`, `ralph-migrate-state.sh` | `scripts/` → `scripts/archive/` |
| `ralph-step.md`, `ralph-step-editor.md`, `kickoff-renderer-migration.md`, `kickoff-prism-editor.md`, `kickoff-harness-lockin.md`, `harness-step.md` | `.claude/commands/` → `scripts/archive/commands/` |

**Kept active** (not loop drivers): all `verify-*.mjs`, `browser-smoke.mjs`,
`live-*-smoke.mjs`, `wait-for-vercel-preview.mjs`, `fetch-vercel-logs.mjs`, asset
pipeline scripts; **all guardrail hooks**. New: `scripts/archive/README.md`
documents why and what stays.

**Evidence:** `git status` shows `R  …/scripts/{ralph,…}.sh -> …/scripts/archive/…`
and `.claude/commands/` now contains only the auto-generated `CLAUDE.md` + the new
`prism-verify.md`.

---

## Task 2 — `dependency-allowlist-check.sh` RE-WIRED (PreToolUse) + EXTENDED

Rewrote it as a thin wrapper around a new Python analyzer
(`dependency-allowlist-check.py`) that inspects the **pending** PreToolUse content
(Write `content` / Edit `new_string` / MultiEdit `edits[]`), because PreToolUse
runs *before* the write. Key changes:

- **PixiJS removed from the allowlist and made FORBIDDEN** (`pixi.js`,
  `pixi-filters`, `@pixi/*`) — renderer migration to `three/webgpu` is done.
  `html-to-image` stays forbidden.
- **Extended with canonical-3 forbidden patterns:** PixiJS / any second *visible*
  renderer import (`@babylonjs`, `regl`, `ogl`, `phaser`) → INV-R1/FP-R1; a CDN
  `three` import-map or CDN `three` URL → RT-SC-02/INV-R1; diffusion-drawn text
  (FLUX/fal call lacking "no text/letters/labels") → INV-R11; a stored global
  `fps` → canvas §19; app-behavior wiring (`fetch`/`router.push`/`navigate`)
  inside a `/canvas/` module → FP-NE-2.
- **Dependency DOWNGRADE detection:** compares pending `package.json` versions to
  the on-disk versions; a lower semver blocks (enforces the ANTI-STUCK rule —
  never downgrade to silence an error).

**Wired** into `PreToolUse` (matcher `Write|Edit|MultiEdit`) in **both**
`.claude/settings.json` (active session cwd) and `kid-kode-landing/.claude/settings.json`.

**Evidence — guard firing (each fed as a hook JSON; `[exit 2]` = block):**

```
DEMO 1 PixiJS import (src/lib/prism/runtime/foo.ts):
  - FORBIDDEN import in foo.ts: 'pixi.js' — PixiJS/html-to-image are disallowed (runtime INV-R1 / spec line 1251).
  - FORBIDDEN: PixiJS in the visible path (runtime INV-R1 / FP-R1) — one three/webgpu scene only.   [exit 2]
DEMO 2 unapproved dep "left-pad" in package.json:
  - UNAPPROVED dep in package.json: "left-pad" — not on the allowlist …                              [exit 2]
DEMO 3 downgrade three ^0.184.0 -> ^0.150.0:
  - DEPENDENCY DOWNGRADE: "three" ^0.184.0 -> ^0.150.0. Downgrading … is forbidden (ANTI-STUCK rule). [exit 2]
DEMO 4 CDN three import-map (src/app/foo.tsx):
  - FORBIDDEN: `three` import-map (RT-SC-02 / INV-R1) …
  - FORBIDDEN: CDN `three` URL (RT-SC-02 / INV-R1) …                                                  [exit 2]
DEMO 5 stored global fps (src/lib/prism/canvas/clock.ts):
  - FORBIDDEN: stored global fps (canvas §19) …                                                       [exit 2]
DEMO 6 fetch() in a canvas module (src/lib/prism/canvas/panel.ts):
  - FORBIDDEN: app-behavior wiring in a canvas module ('fetch(') — FP-NE-2 …                          [exit 2]
DEMO 7 clean import * as THREE from 'three/webgpu' + 'three/tsl':                                     [exit 0]  ✓ passes
DEMO 8 FLUX call w/o negative-text in scripts/generate-thing.mjs:
  - FORBIDDEN: FLUX/fal image call without negative-text discipline (INV-R11) …                       [exit 2]
```

Files: `kid-kode-landing/.claude/hooks/dependency-allowlist-check.sh` (rewritten),
`…/dependency-allowlist-check.py` (new), both `settings.json` (wired).

---

## Task 3 — Dangling hook refs CLEANED + modernized non-blocking Stop hook ADDED

- **Removed** the two dead references in `.claude/settings.json`: the `Stop` →
  `$HOME/.claude/hooks/kripverify-stop.sh` entry and the `UserPromptSubmit` →
  `…/kripverify-userprompt.sh` entry (both files are `.disabled-20260519`). The
  `UserPromptSubmit` block is gone entirely. (`grep kripverify` over both repo
  settings → "none — clean".)
- **Global `photoreal-block-stop.sh`:** confirmed **inert** in this repo and **left
  untouched** (it belongs to the OpenDesign project). With a realistic Stop payload
  including `cwd` (which Claude Code always sends), it exits 0 silently because it
  scopes to `/Users/loganbaird/OpenDesign` via the payload's `cwd` field. *(Edge
  note: a Stop payload with no `cwd` falls through to its OpenDesign state file —
  not a real-operation case, but flagged.)*
- **Added** `.claude/hooks/spec-criteria-stop.sh` (+ `.py`), wired to **`Stop` and
  `SubagentStop`**. It is **non-blocking, non-looping**: it returns
  `hookSpecificOutput.additionalContext` naming still-unmet canonical-3 criteria
  (from `notes/verification/unmet-criteria.json`) instead of `decision:block` /
  exit 2. Honors `stop_hook_active` (can never loop). Silent when the ledger is
  empty/absent.

**Evidence — hook returning feedback once:**

```
DEMO A Stop + seeded ledger -> stdout (non-blocking, exit 0):
  {"hookSpecificOutput": {"hookEventName": "Stop", "additionalContext":
   "Spec criteria still UNMET (9): RT-SC-02, RT-SC-03, RT-SC-06, RT-SC-10, RT-SC-11,
    NE-SC-01, NE-SC-03, NE-SC-13, NE-SC-14. Tracked in notes/verification/unmet-criteria.json …"}}
DEMO B stop_hook_active=true -> silent, exit 0   (anti-loop tripwire)
DEMO C empty unmet[] -> silent, exit 0
```

---

## Task 4 — `.ralph-migration-active` marker RETIRED

- `git rm kid-kode-landing/.ralph-migration-active` (the only such marker; root had
  none). No `.ralph-migration-active` remains anywhere.
- **`migration-forbidden-patterns.sh` is now inert** — it keys off the marker. Fed a
  node-module edit with `async function createNode` → `[exit 0]` (no longer fires).
- **No guardrail lost:** `anti-drift-check.sh`'s editor-build block (FP-05 `document/window`,
  FP-09 async `createNode`) still fires on the same input → `[exit 2]`, active via the
  retained `.prism-editor-build-active` marker. The migration's binding invariants were
  already carried into `PRISM-RUNTIME-SPEC.md` (INV-R9/R11/R12; SPEC-INDEX S8).
- Added a **RETIRED/INERT banner** atop `.claude/rules/prism-renderer-migration.md`;
  updated the stale "Pending STEP-3 cleanups" note in `kid-kode-landing/CLAUDE.md` to
  "DONE".

---

## Task 5 — Surgical removal of the rescinded animation rule (the ONLY app-code edit)

Per SPEC-INDEX S4 / §6.2 (canvas §2 decision 6 rescinds "no scene-level animation
outside the primitives library / AI may not author animation from scratch").

**`src/lib/prism/codegen/prompts.ts`** — removed one line from `SHARED_SYSTEM_PROMPT`:

```
- BEFORE: '- DO NOT author bespoke shader code — use TSL through ctx.primitives or three/tsl built-ins.',
+ AFTER:  (line removed; surrounding lines unchanged)
```

**`src/lib/prism/codegen/verifier.ts`** — removed the `MISSING_PRIMITIVES_LOOP`
structural check:

```
- BEFORE:
-   const iteratesPrimitives = /config\.cinematicPrimitives/.test(source);
-   const callsPrimitives = /ctx\.primitives\[/.test(source);
-   if (!iteratesPrimitives || !callsPrimitives) {
-     out.push({ rule: 'MISSING_PRIMITIVES_LOOP', severity: 'error',
-       message: 'all modes must iterate config.cinematicPrimitives and call ctx.primitives[name] (§10.C L384)' });
-   }
+ AFTER: a comment recording the rescission (S4 / canvas §2 decision 6); no rule emitted.
```

Nothing else in either file changed. **Typecheck:** full `tsc --noEmit` shows **no
type errors referencing `verifier.ts` or `prompts.ts`** (run with nvm node on PATH;
see Discovered Issues re the hook's own PATH).

---

## Task 6 — Verification protocol (reusable artifacts)

- **`/prism-verify`** slash-command (`.claude/commands/prism-verify.md`, now
  registered): make a change → load in real Chrome → **(a) functional** (Chrome
  DevTools MCP / `kv_check_console` / `kv_check_network` / `kv_evaluate`: console
  errors + scene-graph assertions) → **(b) vision** (`kv_screenshot` + judge +
  `kv_click`/`kv_type`/`kv_evaluate`/`kv_verify` + Claude-in-Chrome: render AND
  function like a user) → grade vs the canonical-3 numbered criteria **with
  evidence** → on fail edit+retry under the **ANTI-STUCK rule** → fresh-context
  review. (The generic global `/verify` skill is left intact; this is the
  Prism-specific superset.)
- **"How we build & verify"** section added to `kid-kode-landing/CLAUDE.md` (loops
  retired → dynamic workflows / Opus-4.8 sessions; two-layer evidence-based protocol).
- **Fresh-context reviewer subagent** `.claude/agents/prism-criteria-reviewer.md` —
  sees only diff + criteria, reports MUST-FIX gaps, never edits, demands evidence,
  knows the rescinded rule must NOT be flagged. **Model:** see the reconciliation
  note below.
- **KripVerify as a first-class primitive** — capabilities confirmed by reading the
  MCP server on disk (`/Users/loganbaird/Code/kripverify/mcp-server/src`): tools
  `kv_navigate, kv_wait_for, kv_screenshot, kv_check_console, kv_check_network,
  kv_click, kv_type, kv_evaluate, kv_verify, kv_dev_server_status,
  kv_restart_dev_server`. Wired as `kv` in `.mcp.json` (`KV_PROJECT_ROOT` = this
  repo). Referenced throughout `/prism-verify`.

### Model-pin reconciliation (surfaced decision)
The paste says "pin `claude-opus-4-8` in every subagent/agent." But the active
`model-guardrail.sh` **rejects** any `model:` frontmatter in `.claude/agents/*.md`,
and the user's global `CLAUDE.md` states model is **UI-driven; never hardcode**. I
honored the **intent** (opus-4-8 only) the project-correct way: the reviewer agent
**inherits** the parent session's model and carries a prominent prose requirement to
run only from an Opus-4.8 session (never opusplan). Hooks don't spawn a model, so
there's nothing to pin there — by design (the retired kripverify hook *did* spawn
`claude`; the replacement does not).

---

## Task 7 — Current wiring/versions RE-VERIFIED (not trusted from a stale snapshot)

| Capability | Status (verified 2026-06-05) |
|---|---|
| **Stop/SubagentStop `additionalContext`** | **Supported** — official hooks reference confirms `Stop`/`SubagentStop` accept `hookSpecificOutput.additionalContext` for *non-blocking* feedback (distinct from `decision:block` / exit 2). 10k-char cap. Used by `spec-criteria-stop`. |
| **Chrome DevTools MCP** | Official Google server, `npx chrome-devtools-mcp@latest`, **29 tools**, requires **Chrome 144+**. **Not currently wired** in `.mcp.json` (only `kv`). Also available as an Anthropic plugin. → action for STEP 4: add to `.mcp.json` if the functional layer should use it directly. |
| **KripVerify** | Installed `/Users/loganbaird/Code/kripverify` (Tauri 2 + Rust + Node MCP); wired as `kv` in `.mcp.json`; tools confirmed from source. The two auto-run hooks remain `.disabled-20260519` (intentionally — we use the explicit `/prism-verify` flow, not auto-spawn). |
| **Claude-in-Chrome** | Anthropic's Claude-for-Chrome agentic browsing — usable as the vision/interaction layer alongside KripVerify. Confirm the extension/session is connected before relying on it in a run. |
| **Dynamic workflows** | The Claude Code **Workflow** tool (Opus 4.8, self-checking) is the sanctioned replacement for the homegrown loops — use it for big parallel STEP-4 work. |

---

## SELF-CHECK — no Prism app feature changed except Task 5

`git diff --stat` scoped to `kid-kode-landing/src/`:

```
 kid-kode-landing/src/lib/prism/codegen/prompts.ts  |  1 -
 kid-kode-landing/src/lib/prism/codegen/verifier.ts | 18 ++++++------------
 2 files changed, 6 insertions(+), 13 deletions(-)
```

These two files **are** Task 5. No other file under `src/**` is modified or added.
All other STEP-3 changes are under `.claude/**`, `kid-kode-landing/.claude/**`,
`kid-kode-landing/scripts/archive/**`, `kid-kode-landing/notes/**`, `docs/` notes, and
`CLAUDE.md` — config, hooks, commands, agents, markers, and documentation. No
`page.tsx`, runtime, store, camera, view-mode, or edit/save-path code was touched.
HEAD remains `prism-editor-build`; **no commits** were made.

### Files created / edited / moved (STEP-3 footprint)

- **Edited (config/docs):** `.claude/settings.json`, `kid-kode-landing/.claude/settings.json`,
  `.claude/rules/prism-renderer-migration.md`, `kid-kode-landing/CLAUDE.md`,
  `kid-kode-landing/.claude/hooks/dependency-allowlist-check.sh`.
- **Edited (app code — Task 5 only):** `src/lib/prism/codegen/verifier.ts`,
  `src/lib/prism/codegen/prompts.ts`.
- **Created:** `.claude/hooks/spec-criteria-stop.sh`, `.claude/hooks/spec-criteria-stop.py`,
  `kid-kode-landing/.claude/hooks/dependency-allowlist-check.py`,
  `.claude/commands/prism-verify.md`, `.claude/agents/prism-criteria-reviewer.md`,
  `kid-kode-landing/notes/verification/unmet-criteria.json`,
  `kid-kode-landing/scripts/archive/README.md`, this report.
- **Moved (git mv):** 5 shell scripts → `scripts/archive/`; 6 command `.md` files →
  `scripts/archive/commands/`.
- **Removed:** `kid-kode-landing/.ralph-migration-active` (`git rm`).

---

## Discovered issues (not in STEP-3 scope; noted for the operator)

1. **`post-edit-typecheck.sh` PATH bug.** The hook calls bare `npx`, which is not on
   the hook's PATH in this shell (nvm node), so it exits with
   `npx: command not found` and **false-blocks every `.ts/.tsx` edit**. It did not
   prevent Task 5 (PostToolUse block is after-the-fact feedback). The typecheck was
   re-run manually with nvm node → clean. **Fix:** source nvm / resolve a node bin in
   the hook before calling `npx`.
2. **Stale loop references in docs/rules.** `kid-kode-landing/CLAUDE.md`
   ("One-task-per-session discipline", "Build commands") and
   `.claude/rules/prism-editor-build.md` still point at `scripts/ralph.sh` /
   `/ralph-step-editor` (now archived). Non-blocking; cleanest folded into the STEP-4
   doc pass. The migration rule and the migration-status note were already corrected here.
3. **`.prism-editor-build-active` retained on purpose** — it keeps the valuable
   editor-build FP-NN checks in `anti-drift-check.sh` live. Only the migration marker
   was retired.

---

## Ready for STEP 4 — checklist

- [x] Ralph/Harness loop drivers archived; slash-commands de-registered; no auto-spawning Stop hook.
- [x] Supply-chain + forbidden-pattern guard (`dependency-allowlist-check`) ACTIVE as PreToolUse in both settings; demonstrated blocking 7 drift classes incl. dependency downgrades.
- [x] Dangling kripverify Stop/UserPromptSubmit refs removed; non-blocking `spec-criteria-stop` (additionalContext) live on Stop + SubagentStop; demonstrated.
- [x] `.ralph-migration-active` retired; migration-only hook inert; carried-forward invariants still enforced by `anti-drift-check.sh`.
- [x] Rescinded animation rule removed from codegen (`verifier.ts` + `prompts.ts`); typecheck clean.
- [x] `/prism-verify` two-layer protocol + "How we build & verify" + `prism-criteria-reviewer` subagent + KripVerify primitives documented.
- [x] Current wiring/versions verified (Stop additionalContext, Chrome DevTools MCP, KripVerify, workflows, Claude-in-Chrome).
- [x] `notes/verification/unmet-criteria.json` seeded with the STEP-4 work list (RT-SC-02/03/06/10/11, NE-SC-01/03/13/14).
- [ ] **STEP 4 (app features — deferred):** preview-as-compile → in-place state transition (`page.tsx`); single bundled `three` (kill CDN import-map); unify the dual edit/save paths; galaxy camera + deep-zoom; view-mode/build behavior. Verify each via `/prism-verify` with evidence; clear it from the ledger as you go.

**Optional operator action:** add `chrome-devtools` to `.mcp.json` if STEP 4 should
use the functional layer directly (KripVerify already covers both layers).

*No commits made. HEAD = `prism-editor-build`. Changes left for Logan to review.*
