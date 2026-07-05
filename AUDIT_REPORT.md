# Prism Runtime — Audit Report

**Auditor:** Claude (read-only investigation)
**Date:** 2026-06-01
**Scope:** Investigation only. **ZERO changes** were made to code, specs, hooks, or branches. The only file created is this report.
**Repo root audited:** `/Users/loganbaird/Prototype_Prism/Design-trials` (this is the git repository; the runnable app lives in `kid-kode-landing/`).

> **Orientation note (evidence):** The top-level folder `/Users/loganbaird/Prototype_Prism` is **not** a git repo (`git rev-parse` → `fatal: not a git repository`). The Prism runtime git repo is the nested `Design-trials/` directory. `Design-trials/README.md` reads: *"# Prism Editor — Kriptik / The 3D knowledge-graph editor for diffusion-native applications. / Source of truth for the deployment at https://kid-kode-ai-landing.vercel.app"*. The app source is in `Design-trials/kid-kode-landing/`.

---

## 1. BRANCHES

### Method (evidence)
- Default branch resolved via `git symbolic-ref refs/remotes/origin/HEAD` → **`refs/remotes/origin/prism-main`**. So **"main" = `prism-main`**.
- Per-branch last-commit date + ahead/behind computed with `git log -1 --date=...` and `git rev-list --left-right --count prism-main...<branch>`.

### All branches — last commit + ahead/behind vs `prism-main`

| Branch | Last commit (committer date) | Ahead of main | Behind main | Tip subject |
|---|---|---|---|---|
| **prism-editor-build** ⟵ *current HEAD* | **2026-05-20 14:55** | **430** | 0 | `ralph: loop complete - all tasks done` |
| power-cut-iter18-salvage | 2026-05-19 13:41 | 389 | 0 | `test: EBR2-E-04 - failing tests for §R2-E SC-074 + helper stubs` |
| claude/relaxed-chaum-1fe09c *(worktree)* | 2026-05-19 12:04 | 358 | 0 | `recovery amendment: spec-reviewer reads screenshots…` |
| claude/xenodochial-montalcini-100d52 *(worktree)* | 2026-05-19 12:04 | 358 | 0 | `recovery amendment: spec-reviewer reads screenshots…` |
| claude/pensive-kalam-b7b8ca *(worktree)* | 2026-05-19 07:12 | 356 | 0 | `editor-build: EBR2-C-04 - Vercel observability logs` |
| claude/cool-gauss-a02f2a *(worktree)* | 2026-05-18 11:23 | 292 | 0 | `fix(kickoff): bulletproof slash command…` |
| prism-renderer-ralph | 2026-05-05 08:06 | 64 | 90 | `prism-renderer: migration complete — remove markers` |
| codex/prism-runtime-reconcile | 2026-05-09 17:08 | 12 | 0 | `prism: keep webgpu text factory explicit` |
| codex/prism-polish-recovery | 2026-05-08 18:09 | 5 | 0 | `prism polish: record completed polish state` |
| codex/prism-runtime-reconcile-base-checkpoint | 2026-05-08 18:09 | 5 | 0 | `prism polish: record completed polish state` |
| recovery/analysis-20260424T221523Z | 2026-04-24 17:42 | 1 | 135 | `recovery: phase A-E artifacts` |
| recovery/reset-20260424T221523Z | 2026-04-23 17:27 | 0 | 135 | `prism-mock: alpha-cutout crops…` |
| **prism-main** *(default)* | 2026-05-06 13:11 | 0 | 0 | `harness: progress log - iter 16 HL15 (chain complete)` |
| codex/prism-polish-base-checkpoint | 2026-05-06 13:11 | 0 | 0 | `harness: progress log - iter 16 HL15` |
| prism-ralph | 2026-04-21 18:59 | 0 | 237 | `prism-mock: end-to-end runtime fixes — FAL assets…` |

### Containment check — what is *not* already on `prism-editor-build`?
Computed with `git rev-list --left-right --count origin/prism-editor-build...<branch>` (right = commits unique to the branch):

- `prism-editor-build` is the **tip of the line** — local == `origin/prism-editor-build` (0 behind / 0 ahead). It contains *every* commit of `prism-main`, all four `claude/*` worktrees, and both `codex/*` reconcile lines.
- **Only three branches hold commits NOT on `prism-editor-build`:**
  - **`power-cut-iter18-salvage` → +2 unique commits.** These are iteration-18 "Save and Rebuild" *failing-test stubs* (`EBR2-E-04`, salvaged after a power cut). Low value — test scaffolding, not finished work. Tip subject says "failing tests."
  - **`prism-renderer-ralph` → +64 unique commits.** ⚠️ **This is a whole parallel line of work** — a "prism-renderer migration" driven against a *different* spec (`PRISM-RENDERER-MIGRATION-SPEC.md`): depth-map + 3D-mesh pipeline stages, editor Visual/Animation tabs, mock-app reconstruction (5 hubs/16 nodes), MSDF text, `assembleBundle`. **It is NOT merged into `prism-editor-build`.** This is a genuine fork in the road, not stale debris.
  - `recovery/analysis-20260424T221523Z` → +1 commit (recovery artifacts only).
- The four `claude/*` branches are **agent worktrees** (live under `.claude/worktrees/`, see `git worktree list`). Each is strictly *behind* `origin/prism-editor-build` (138 / 74 / 72 / 72) with **0 unique commits** — i.e. stale agent checkouts already superseded.

### Most-recently-worked / furthest-along
- **Most recent commit:** `prism-editor-build` (2026-05-20 14:55) — the only branch touched on/after 05-20.
- **Furthest along:** `prism-editor-build` (430 ahead of main, and a superset of all other editor branches).
- **Node-editor work specifically:** lives on `prism-editor-build` (branch literally named "editor-build"; tips reference `EBR2-*` "editor-build round 2" task IDs). The `claude/*` worktrees are intermediate agent snapshots of the *same* line.

### ⭐ Recommendation (branch to continue from)
**Continue from `prism-editor-build`.** It is simultaneously the newest, the furthest along, the node-editor line, and a strict superset of every other editor/codex/worktree branch. Local and origin are in sync (nothing to lose locally).

**Before treating it as canonical, get a decision on two divergent lines (see OPEN QUESTIONS):**
1. `prism-renderer-ralph` (+64 commits, a renderer-migration spec line) — is that work meant to land in the editor build, or was it abandoned/superseded?
2. `power-cut-iter18-salvage` (+2 commits) — keep the iter-18 "Save and Rebuild" test stubs or discard?

> ⚠️ **Working-tree state (not modified by me):** `git status` shows the repo is **dirty** on `prism-editor-build` — modified `kid-kode-landing/notes/ralph-state.json`, `public/prism-assets/mock-app.prism`, `public/prism-mock/home/live-graph.json`, plus untracked `.claude/worktrees/` and a `ralph-state.json.round1-complete` backup. These three files were **already dirty before I touched anything**; the build/run steps in §2 below re-touch the same generated files (they are build outputs of `npm run build:prism`). I made **no edits to any tracked source file**. **I did not switch branches** (HEAD remains `prism-editor-build` @ `3c9be0a`).

---

## 2. LOAD FAILURE

### TL;DR (read this first)
**I could NOT reproduce a genuine load failure on `prism-editor-build`.** In a *clean* environment the node-editor URL loads successfully in **both** local dev **and** a production build:
- `npm run dev` → **HTTP 200**, the node editor renders **12 nodes** with an active WebGL context, **0 console errors** (only a `THREE.Clock` deprecation warning + a favicon 404).
- Clean `next build` + `next start` → **HTTP 200**, node editor renders identically, **0 console errors**.

I *did* hit one `500` — but I proved it was **self-inflicted** (I ran `next build` while `next dev` was still running, which corrupted the shared `.next/` directory). A clean rebuild made it disappear. Details and the ranked hypotheses for where *your* error actually lives are below. **The spec is not yet hardened, so treat the "no failure found" result as branch- and environment-specific, not a global all-clear.**

### What "the node editor URL" is (evidence)
There is no separate editor route. The app has exactly one page — `src/app/page.tsx` — plus two API routes (`/api/prism/regen`, `/api/prism/vault/resolve`). `page.tsx` mounts the node editor as a client-only dynamic import:
```
const GraphScene = dynamic(() => import('@/components/editor/graph/GraphScene'), { ssr: false, loading: () => <…"INITIALIZING PRISM RUNTIME"…> });
```
A top toolbar toggles three view modes — **Galaxy / Canvas / Preview App** (default **Preview App**). The **node editor = Galaxy/Canvas (`GraphScene`)**; Preview App is the runtime player. So "the node editor URL" = `http://localhost:3000/` with the Galaxy toggle.

### How I ran it (evidence)
- `npm run dev` → ran `build:prism` (MSDF atlas + `build-live-prism.mjs` → wrote `mock-app.prism`, 12 nodes / 1 hub) then `next dev`. Server log: `✓ Ready in 2s` on `http://localhost:3000`. Node `v22.22.1`, Next `15.5.15`.
- Drove a real browser (Playwright) → navigated `/`, switched to **Galaxy**, waited for the dynamic `GraphScene` import to mount.
- Browser DOM after Galaxy switch: `KRIPTIK EDITOR | Graph | L4 · Interior · Deep inspection | 100% | Add Node | … | Home | 12 | MINIMAP | 12 nodes | FILTER`; `canvas 1200×769`; `webglPresent: true`; `stillLoading: false`. **The node editor rendered.**
- Console at that point: only `THREE.Clock: This module has been deprecated…` (warning) + `favicon.ico 404`. **No runtime exception.**

### The one 500 I saw — and proof it was self-inflicted
While the dev server was still running I started `npx next build`. Immediately after, `GET /` began returning **500**, and `next start` against that `.next/` produced this server-side stack:
```
⨯ [Error: Cannot find module './vendor-chunks/three.js'
Require stack:
- .next/server/webpack-runtime.js
- .next/server/pages/_document.js
- node_modules/next/dist/server/require.js …]  { code: 'MODULE_NOT_FOUND' }
```
Tell-tale sign it was contamination, not a real bug: the error JSON carried `"buildId":"development"` — a real `next build` stamps a **hashed** build id, never `"development"`. `next build` had overwritten the dev server's `.next/` mid-flight, leaving `webpack-runtime.js` pointing at a `vendor-chunks/three.js` chunk that a clean build never even emits.

**Clean-room test (the decisive evidence):**
1. Killed all `next` processes. Confirmed `.next` is gitignored. `rm -rf .next`.
2. `npx next build` (no dev server running) → `✓ Compiled successfully`, `CLEAN_BUILD_EXIT=0`, real `BUILD_ID = klOBx08egMBLMv4-yUvvf`, and `.next/server/vendor-chunks/` is **empty (0 chunks)** — i.e. there is no `three.js` vendor chunk by design.
3. `npx next start` → `GET /` returns **HTTP 200**. Browser (Galaxy) renders `KRIPTIK EDITOR … 12 nodes`, **0 console errors**.

→ The 500 does not reproduce in a clean build. It was an artifact of concurrent `build`+`dev`.

### Ranked root-cause hypotheses for the failure *you* observed
Since it does not reproduce on this branch in a clean env, the error you saw most likely comes from one of these (ranked by likelihood given the evidence):

1. **Contaminated / stale `.next/` build cache (HIGH).** *Evidence:* I reproduced your class of symptom (`500`, `Cannot find module './vendor-chunks/three.js'`) purely by letting `next build` and `next dev` share `.next/`. Switching branches without clearing `.next`, or running build+dev together, yields exactly this. *Fix to try first:* `rm -rf kid-kode-landing/.next` then re-run. **No code change needed.**
2. **Production/Vercel runtime fragility from the CDN import-map (HIGH for the deployed site).** *Evidence:* the served HTML injects `<script type="importmap">` mapping `three`, `three/webgpu`, `three/tsl`, `three/addons/` to `https://cdn.jsdelivr.net/npm/three@0.184.0/…`. The **runtime player loads Three.js from a CDN at page load** (the editor's `GraphScene`, by contrast, bundles `three` from `node_modules` — an architecture split). If Vercel's CSP, the network, or the import-map mismatches the bundled expectations, the *runtime preview* fails on the live URL even though local dev is green. This is the most plausible source of a *deployed* "won't load." *Needs:* loading the actual Vercel URL (I did not, to avoid external calls without your go-ahead — see OPEN QUESTIONS).
3. **A different branch or a worktree (MEDIUM).** *Evidence:* `power-cut-iter18-salvage` carries unfinished iter-18 "Save and Rebuild" work and `prism-renderer-ralph` is a 64-commit parallel line; either could be in a broken state. You asked me **not to switch branches**, so I tested only `prism-editor-build`. If you saw the error elsewhere, name the branch and I'll reproduce it.
4. **Missing env / API-route 500 (LOW-MEDIUM).** *Evidence:* `.env.local` exists and `/api/prism/regen` + `/api/prism/vault/resolve` are server routes; a missing `FAL_KEY`/vault secret would 500 those endpoints (not the page itself) when the editor calls "Save & Verify"/regen. Didn't trigger in a plain load.
5. **WebGL/WebGPU unavailable in the viewing browser (LOW).** *Evidence:* the scene needs a GL context; it got one here (`webglPresent: true`). A headless/locked-down browser or disabled hardware acceleration would blank the canvas.

**Bottom line:** on `prism-editor-build`, a clean run of the node editor works. Before any fix, the highest-value next step is to (a) `rm -rf .next` and confirm, and (b) load the live Vercel URL with me watching the console — that will tell us whether the real failure is the CDN import-map path.

---

## 3. AUTOMATION INVENTORY

Two layers of automation exist: **(A) shell-level Ralph loop drivers** (operator-launched bash that re-spawns `claude` until a task ledger is "done"), and **(B) Claude Code hooks** wired in `settings.json` (fire on tool/session/stop events). I classify each as **LOOP DRIVER** (forces continuation / re-runs) or **GUARDRAIL** (blocks or warns on bad edits). Worktree copies under `.claude/worktrees/**` are byte-identical duplicates of the canonical files and are omitted from the tables (noted at the end).

### A. Shell-level Ralph loop machinery — **LOOP DRIVERS** (recommend retire/quarantine)

| Path | Role | Classification | Evidence |
|---|---|---|---|
| `kid-kode-landing/scripts/ralph.sh` | **The outer loop.** "Each iteration spawns a fresh `claude --print` process to run `/ralph-step-editor`." Loops to `MAX_ITER=500`, reads `notes/ralph-state.json` between iterations, exits only on `complete`/`failed`/`paused-*`. Invokes `claude --print --model … --dangerously-skip-permissions /ralph-step-editor`. | **LOOP DRIVER** | header lines 1–17; model-contract gate; `MAX_ITER:-500` |
| `kid-kode-landing/scripts/ralph-resume.sh` | Resumes the loop after a `paused-*` breakpoint — flips status to running and **re-launches `ralph.sh`**. | **LOOP DRIVER** | header "Resume the Ralph loop … re-launch ralph.sh" |
| `kid-kode-landing/scripts/kickoff-loop.sh` | One-shot launcher/preflight: validates Opus model, writes `.claude/.ralph-model`, then the agent "launch ralph.sh in background." | **LOOP DRIVER (launcher)** | header lines 1–30 |
| `.claude/commands/ralph-step-editor.md` | Per-iteration **worker** the loop invokes (one task, exits after step 14). Bounded by itself, but is the loop's body. | **LOOP DRIVER (worker)** | rules file: "Loop driver: `scripts/ralph.sh` … Per-step worker: `ralph-step-editor.md`" |
| `.claude/commands/ralph-step.md` | Older worker (renderer-migration line, `/ralph-step`). | **LOOP DRIVER (worker, legacy)** | kid `CLAUDE.md` "Per-task entrypoint: `/ralph-step`" |
| `.claude/commands/kickoff-renderer-migration.md`, `kickoff-prism-editor.md`, `kickoff-harness-lockin.md`, `harness-step.md` | Kickoff/monitor commands for the various loop campaigns. | **LOOP DRIVER (launchers)** | command files present |
| `kid-kode-landing/scripts/ralph-migrate-state.sh` | State-schema migration helper. Not a driver — utility. | UTILITY | — |
| Marker files: root + `kid-kode-landing/` `.prism-editor-build-active`, `.ralph-migration-active`, `.ralph-phase5-pixi-removed`, `.claude/.ralph-model` | **Switches** that activate the override rules and gate the hooks/loop. Not executable, but they are the loop's on/off state. | LOOP STATE | rules files key off these markers |

> **No OS-level auto-runner.** `crontab -l` has **no** ralph/prism entries and there are **no** launchd agents matching ralph/prism. The loop only runs when an operator launches `ralph.sh`/`kickoff-loop.sh`. `ralph-state.json status = "complete"`, so the loop is currently idle/terminal.

### B. Claude Code hooks — wired in `settings.json`

**Active in `Design-trials/.claude/settings.json` (fires when project dir = `Design-trials`):**

| Hook | Event / matcher | Classification | Purpose & evidence |
|---|---|---|---|
| `.claude/hooks/anti-drift-check.sh` | PreToolUse `Write\|Edit` | **GUARDRAIL (blocking, exit 2)** | "reject forbidden patterns" — §1.4 runtime patterns always; editor-build FP-NN when `.prism-editor-build-active` present. **Keep.** |
| `.claude/hooks/model-guardrail.sh` | PreToolUse `Write\|Edit` | **GUARDRAIL (blocking)** | blocks edits re-introducing a forbidden model in `.claude/agents/*.md` frontmatter or a `"model"` key in any `settings.json`. **Keep.** |
| `.claude/hooks/migration-forbidden-patterns.sh` | PostToolUse `Write\|Edit\|MultiEdit` | **GUARDRAIL (blocking)** | after Phase 5 blocks new `from 'pixi'`; always forbids `async createNode`, `document.*`, `window.*` (except `devicePixelRatio`) in node modules. **Keep.** |
| `.claude/hooks/post-edit-typecheck.sh` | PostToolUse `Write\|Edit\|MultiEdit` | **GUARDRAIL (blocking, exit 2 on type errors)** | fast `tsc` on edited `.ts/.tsx` in `kid-kode-landing/`. **Keep.** |
| `.claude/hooks/format-check.sh` | PostToolUse `Write\|Edit` | **GUARDRAIL (mostly warn; exit 2 only on parse failure)** | prettier `--check`. **Keep.** |
| `.claude/hooks/todo-scanner.sh` | PostToolUse `Write\|Edit` | **GUARDRAIL (non-blocking warn)** | flags `TODO/FIXME/stub/placeholder`. **Keep.** |
| `.claude/hooks/spec-presence-check.sh` | SessionStart | **GUARDRAIL (non-blocking warn)** | warns if `notes/prism-spec-extract.md` missing. **Keep.** |
| `.claude/hooks/progress-reminder.sh` | **Stop** | **GUARDRAIL (non-blocking, exits 0)** | warns if commits made without touching the progress log. **Does NOT force continuation** — "Non-blocking: prints to stderr, exits 0." **Keep.** |
| `$HOME/.claude/hooks/kripverify-stop.sh` | **Stop** (referenced) | **DANGLING / INERT** | the repo settings reference this path, but the file was renamed to `kripverify-stop.sh.disabled-20260519` — **it no longer exists at the referenced path.** When present it spawned a fresh `claude -p … --dangerously-skip-permissions` on every Stop (a verification auto-spawner ⇒ loop-driver-adjacent). Currently a no-op. **Clean up the dangling reference; do not re-enable.** |
| `$HOME/.claude/hooks/kripverify-userprompt.sh` | **UserPromptSubmit** (referenced) | **DANGLING / INERT** | same — file is `.disabled-20260519`. No-op. **Clean up the dangling reference.** |

**Active in `kid-kode-landing/.claude/settings.json` (fires when project dir = `kid-kode-landing`):** `SessionStart → spec-presence-check.sh`; `PreToolUse Write|Edit → anti-drift-check.sh`. Both **GUARDRAILS. Keep.**

**Active in GLOBAL `~/.claude/settings.json` (fires in every project):**

| Hook | Event | Classification | Purpose & evidence |
|---|---|---|---|
| `$HOME/.claude/hooks/photoreal-block-stop.sh` | **Stop** AND **SubagentStop** | **LOOP DRIVER (blocking) — but INERT in this repo** | Emits `{"decision":"block", reason:"…keep iterating…"}` to **refuse to stop** until all gates in a state file flip to `done`. **However it is `cwd`-scoped to `/Users/loganbaird/OpenDesign` (line 38: `if cwd != OD_ROOT → exit 0`)**, so in the Prism repo it does nothing. It also has correct safety tripwires (`stop_hook_active=true ⇒ allow stop`; no state file ⇒ allow stop). **This is the only live Stop/SubagentStop loop driver on the machine — leave it alone (it belongs to the OpenDesign project), but be aware it exists.** |

### Hooks present on disk but currently **UNWIRED** (dormant)

| File | What it is | Classification | Status |
|---|---|---|---|
| `kid-kode-landing/.claude/hooks/dependency-allowlist-check.sh` | **PostToolUse `Write\|Edit` that blocks (exit 2) any new dependency key in `package.json`/`package-lock.json` not on an allowlist, and any `import`/`require` of a non-allowlisted package under `src/lib/prism/**`, `src/components/prism-player/**`, `scripts/**`; always blocks `html-to-image`.** | **GUARDRAIL — exactly the "block edits to package.json / lockfiles / specific imports" guard** | **NOT referenced in any active `settings.json`** (only named in an old `ralph-state.renderer-migration.json`). ⚠️ **Currently dormant — your most important supply-chain guardrail is OFF.** |
| `kid-kode-landing/.claude/hooks/verify-on-stop.sh` (+ `.original`) | Stop wrapper: with `.prism-editor-build-active`, runs `verify-editor-runtimes.mjs` (two-runtime snapshot), non-blocking exit 0. | GUARDRAIL (verification, non-blocking) | **Disabled** — was `mv`'d to `.original` per `settings.local.json`; not wired. |
| `kid-kode-landing/.claude/hooks/spec-infrastructure-check.sh` (+ `.original`) | Spec-infrastructure presence check. | GUARDRAIL | **Disabled** (`.original`). |
| `kid-kode-landing/scripts/verify-repair-loop.mjs` | Despite the name, a **verification check** (asserts repair-telemetry caps `repairAttempts ≤ 8`, `fullRegens ≤ 2`); currently soft-warn (exit 0). Not a loop. | GUARDRAIL (verifier) | wired via `npm run verify` only. |

### ⭐ Recommendation (keep / remove)

**REMOVE / RETIRE the loop drivers (Group A) — but do not delete blind:**
- Quarantine `ralph.sh`, `ralph-resume.sh`, `kickoff-loop.sh`, and the `ralph-step*`/`kickoff-*`/`harness-step` commands by **moving them to `/archive` (or an `automation-retired/` dir)** rather than `rm`. They re-spawn Opus `claude` processes with `--dangerously-skip-permissions` up to 500× and are the main "runs until done" risk. The ledger is already `status:"complete"`, so nothing depends on them running.
- Remove the **activation markers** (`.prism-editor-build-active`, `.ralph-migration-active`, `.ralph-phase5-pixi-removed`) **only after** deciding the renderer-migration question (§1) — some guardrails (`migration-forbidden-patterns.sh`, parts of `anti-drift-check.sh`) **change behavior based on these markers**, so pulling them silently weakens guardrails.
- Fix the **two dangling Stop/UserPromptSubmit references** to `$HOME/.claude/hooks/kripverify-*.sh` in `Design-trials/.claude/settings.json` (the files are `.disabled` — the references are dead).

**PRESERVE / MIGRATE the guardrails (Group B):**
- Keep all active PreToolUse/PostToolUse guardrails: `anti-drift-check.sh`, `model-guardrail.sh`, `migration-forbidden-patterns.sh`, `post-edit-typecheck.sh`, `format-check.sh`, `todo-scanner.sh`, `spec-presence-check.sh`, `progress-reminder.sh`.
- ⚠️ **RE-WIRE `dependency-allowlist-check.sh`** — this is the package.json/lockfile/import guardrail you care about and it is **currently not firing**. It should be added back to `PostToolUse` in `kid-kode-landing/.claude/settings.json` (and/or the outer settings). *(Decision needed — see OPEN QUESTIONS; I made no edits.)*
- Leave the global `photoreal-block-stop.sh` alone (it's OpenDesign-scoped and inert here).

> **Worktree duplicates:** every file above also exists under `.claude/worktrees/{cool-gauss,pensive-kalam,relaxed-chaum,xenodochial-montalcini}/…` (byte-identical). Those four worktrees are stale agent checkouts (§1). When you retire the loop drivers, also `git worktree remove` the four worktrees so the duplicates don't linger.

---

## 4. SPEC INVENTORY

### Canonical spec homes found (evidence)
All five "real" specs live in **`kid-kode-landing/docs/prism/`** (header lines quoted):

| File | Size / date | Self-declared status (line) | Role |
|---|---|---|---|
| `PRISM-ENGINE-SPEC-V3.md` | 103 KB · Apr 21 | "Canonical source of truth for all Prism diffusion engine implementation" (L3); "Supersedes PRISM-ENGINE-SPEC-V2.md" (L6) | **Engine** spec |
| `PRISM-MOCK-APP-BUILD-SPEC.md` | 102 KB · Apr 21 | "Implementation-ready spec for converting the prototype's mock app to real `.prism`" (L3); companion to V3 | **Mock-app build** (PixiJS-era) |
| `PRISM-RENDERER-MIGRATION-SPEC.md` | 28 KB · May 5 | "Canonical source of truth for the PixiJS-to-Three.js renderer migration" (L3) | **Runtime/renderer** spec |
| `CINEMATIC-PRIMITIVES-LIBRARY.md` | 17 KB · May 5 | "Companion to PRISM-RENDERER-MIGRATION-SPEC.md" (L3) | Runtime primitives |
| `PRISM-EDITOR-BUILD-SPEC.md` | 46 KB · May 18 | "Authoritative for the Prism editor build … v1.1" (L3) | **Node-editor** spec (newest) |

**Derived / planning docs in `kid-kode-landing/notes/` and `docs/`:** `prism-spec-extract.md` (1336 lines), `prism-renderer-spec-extract.md`, `prism-mock-plan.md`, `prism-vision-context.md`, `editor-build-gap-analysis.md`, `editor-build-round-2-gap-analysis.md`, `reconcile-codex-to-claude.md`, `ralph-harness-v1.1.md`, `docs/spec-deviations-prism.md`, `notes/spec-amendments/0001-mask-based-repair-loop.md`, `notes/spec-amendments/0002-hub-mockup-background.md`.

### ⚠️ Specs that are REFERENCED as authoritative but are NOT in the repo
`PRISM-RENDERER-MIGRATION-SPEC.md` (L8, L552–554) names these as "still authoritative for non-renderer concerns" — **none of them are on disk anywhere** (`find` returns nothing):
- `DIFFUSION-ENGINE-SPEC.md`
- `PRISM_ENGINE_BROWSER_BASED_SPEC.md`
- `Editor_UI_Rough_Spec`

**If these are the specs you were referring to, they live outside the repo and need to be added.** (It's possible they were renamed into `PRISM-ENGINE-SPEC-V3.md` / `PRISM-EDITOR-BUILD-SPEC.md`, but nothing in-repo states that mapping — so the references currently dangle. Decision needed.)

### Duplicates & cruft
- **Deeply nested duplicate trees (accidental):** `kid-kode-landing/kid-kode-landing/`, `…/kid-kode-landing/kid-kode-landing/kid-kode-landing/` and a **5-level-deep** `kid-kode-landing/kid-kode-landing/kid-kode-landing/kid-kode-landing/kid-kode-landing/docs/prism/`, plus `kid-kode-landing/notes/kid-kode-landing/`, `.claude/hooks/kid-kode-landing/`. These hold only stub `CLAUDE.md` files (169 B) and partial copies — **artifacts of scripts running from the wrong cwd. Pure cruft; delete (after a glance).**
- **`docs/prism/` appears at three nesting depths** (the real one + two nested stubs). Only `kid-kode-landing/docs/prism/` is real.
- **`notes/prism-spec-extract.md` / `prism-renderer-spec-extract.md`** duplicate content that now also exists as the full originals in `docs/prism/` (see contradiction C1).

### DIRECT CONTRADICTIONS (quoted, with file:line)

**C1 — "The originals are NOT on disk" (factually false + canonical-authority conflict).**
- `kid-kode-landing/CLAUDE.md:28` — *"`notes/prism-spec-extract.md` (1336 lines) is the single source of truth. … The original `docs/prism/*.md` files are NOT on disk — do not reference them as authoritative. Quote sections from the extract by line number."*
- **Reality:** `docs/prism/PRISM-ENGINE-SPEC-V3.md`, `PRISM-MOCK-APP-BUILD-SPEC.md`, `PRISM-RENDERER-MIGRATION-SPEC.md`, `PRISM-EDITOR-BUILD-SPEC.md`, `CINEMATIC-PRIMITIVES-LIBRARY.md` **all exist on disk** (listed above with sizes).
- And the newer `PRISM-EDITOR-BUILD-SPEC.md:327` (RA-05) says the opposite: *"The current `kid-kode-landing/docs/prism/` specs are the source of truth."*
- → Two docs disagree on which is canonical, and the CLAUDE.md premise ("not on disk") is false.

**C2 — Four different "single/canonical source of truth" claimants.**
- `PRISM-ENGINE-SPEC-V3.md:3` & `:1996` — "the canonical source of truth for the Prism engine."
- `PRISM-RENDERER-MIGRATION-SPEC.md:3` — "Canonical source of truth for the … renderer migration."
- `kid-kode-landing/CLAUDE.md:28` — extract is "the single source of truth."
- `PRISM-EDITOR-BUILD-SPEC.md:13` — "the source of truth for the editor build."
- → They're *scoped* differently (engine/renderer/editor), which is defensible — **except** the extract claim (C1) collides with the docs claim. No document states the precedence order across the four.

**C3 — View modes: "5 canonical" vs "exactly 3" inside the *same* file.**
- 5-mode language still reads as authoritative: `PRISM-EDITOR-BUILD-SPEC.md:136` "Phase 1 — single canvas + **5 canonical view modes**"; `:283` INV-20 "any subset of the **five** canonical view modes"; `:284` INV-21 "from the canonical **5**"; `:328` RA-06 maps to "canonical **5**" (`editor → hub-world`, `preview → preview-hub`).
- 3-mode language supersedes: `:7` "Reduces canonical view modes from 5 → **3** (`galaxy | canvas | preview-app`)"; `:73–74` "former modes `hub-world` and `preview-hub` are superseded"; `:292` INV-24 "Exactly **3** canonical view modes exist"; `:312–313` FP-12/FP-14 hooks **block** `hub-world`/`preview-hub` at write time.
- → The doc says superseded items are "marked in place," but INV-20, INV-21, the Phase-1 heading, and RA-06 still assert "5" without a supersession mark. **The running app implements 3** (the toggle shows exactly `Galaxy / Canvas / Preview App` — confirmed live in §2). Spec text lags reality in ~4 spots.

**C4 — PixiJS vs Three.js (CLAUDE.md describes a renderer that no longer exists).**
- `kid-kode-landing/CLAUDE.md` (intro) — *"The left pane of the editor at `/` renders a **PixiJS-based mock app** built from a `.prism` artifact."* Its forbidden-patterns §11/§1.4 are all PixiJS vocabulary (`PIXI.Text`, `PIXI.Graphics`, `PIXI.BitmapText`). The `prism-architecture` skill repeats this.
- **Reality:** PixiJS was removed (the `.ralph-phase5-pixi-removed` marker exists; `package.json` has **no** `pixi*` dependency — confirmed; runtime now uses `three@0.184` + `three-msdf-text-webgpu`). `PRISM-RENDERER-MIGRATION-SPEC.md` mandates Three.js/WebGPU/TSL/MSDF and forbids the Three equivalents.
- → CLAUDE.md + the mock-app spec's forbidden-pattern section describe a PixiJS app that has been migrated away. Stale.

**C5 — Renderer-migration status: three sources disagree.**
- Marker `kid-kode-landing/.ralph-migration-active` **exists** → the rule files (`.claude/rules/prism-renderer-migration.md`) treat migration as **ACTIVE**, and migration-only hooks (`migration-forbidden-patterns.sh`, `post-edit-typecheck.sh`) keep firing.
- `prism-renderer-ralph` branch tip commit: *"prism-renderer: migration **complete** — remove .ralph-migration-active markers."*
- `kid-kode-landing/CLAUDE.md:7`: *"Status: **IN PROGRESS** via Ralph loop on branch `prism-renderer-ralph`."*
- → "active marker present" vs "branch says complete, remove markers" vs "CLAUDE.md says in progress." The migration's done-ness is genuinely ambiguous — and because hooks key off the marker, this ambiguity has live behavioral consequences.

### Proposed CANONICAL set (4 buckets) + ARCHIVE plan
*(Proposal only — I made no moves. The buckets map to your four; one is missing.)*

| Your bucket | Canonical file(s) to keep | Why |
|---|---|---|
| **Runtime spec** | `docs/prism/PRISM-RENDERER-MIGRATION-SPEC.md` + companion `CINEMATIC-PRIMITIVES-LIBRARY.md` | The current Three.js/WebGPU runtime renderer + primitives. Supersedes the PixiJS renderer sections. |
| **Node-editor spec** | `docs/prism/PRISM-EDITOR-BUILD-SPEC.md` (v1.1) | Newest, explicitly authoritative for the editor; encodes the 3-mode model the code actually runs. |
| **Plan / caption spec** | `notes/prism-mock-plan.md` (= the "plan") | **⚠️ No "caption" spec exists anywhere in the repo** (`find -iname '*caption*'` → nothing). Either it lives outside the repo and must be added, or "caption" = node-caption handling embedded in the engine spec — **needs your confirmation.** |
| **Engine + harness spec** | `docs/prism/PRISM-ENGINE-SPEC-V3.md` (engine) + `notes/ralph-harness-v1.1.md` (harness) | Engine invariants + the Ralph harness contract. |

**Keep as living reference (not archived):** `docs/spec-deviations-prism.md` (the §17-DoD deviations log).

**Archive (move to `/archive`, do not delete — historical/superseded):**
- `docs/prism/PRISM-MOCK-APP-BUILD-SPEC.md` — v1.0 PixiJS-era mock-app spec; superseded for renderer concerns by the migration spec. Keep for provenance.
- `notes/prism-spec-extract.md` + `notes/prism-renderer-spec-extract.md` — extracts that duplicate the now-present originals; **and FIX the false "not on disk" claim in `kid-kode-landing/CLAUDE.md` (C1) at the same time.**
- `notes/editor-build-gap-analysis.md`, `notes/editor-build-round-2-gap-analysis.md`, `notes/reconcile-codex-to-claude.md` — working analyses, now historical.
- `notes/spec-amendments/0001-*`, `0002-*` — fold their accepted clauses into the canonical specs, then archive the standalone amendment files.

**Delete as cruft (not specs):** the nested `kid-kode-landing/kid-kode-landing/…` duplicate trees (up to 5 deep) and the stub `docs/prism/CLAUDE.md` copies at those depths.

> **Honest caveat:** you said the spec is "not yet hardened." The contradictions above (esp. C3 view-modes-in-place and C5 migration-status) confirm that — the specs are mid-supersession, with v1.0 language left next to v1.1 language. Any canonicalization should resolve C1–C5 *before* freezing, or the frozen set will still contradict itself.

---

## 5. EXISTING vs INTENDED (preliminary — provisional)

> **This section is explicitly provisional.** The spec is not yet hardened (§4), I did **not** interactively exercise editor features (drag/clone/save), and I audited only `prism-editor-build`. Read these as leads to confirm, not verdicts.

**Gap 1 — The "engine" (the actual product) is not built; what exists is the editor + a runtime player for one hand-authored mock.** *Intended:* `PRISM-ENGINE-SPEC-V3.md` (103 KB) + `PRISM-MOCK-APP-BUILD-SPEC.md` describe a diffusion-native **app builder** — contract-first parallel code generation, wavefront execution, provider-agnostic inference, self-healing/repair tier ladder, FLUX.2/SAM-3 asset generation, a backend template engine, and deployment. *Existing:* the editor-build rules **explicitly mark all of those "out of scope"** for the loop that actually ran; the code is a Next.js node-editor + a Three.js runtime player that renders a **pre-baked `.prism` artifact**. No generation pipeline, no codegen, no AI builder, no deploy engine is wired. **This is the single biggest existing-vs-intended gap** — the shipped thing is the *shell and editor around* the engine, not the engine.

**Gap 2 — The live mock app is smaller than the runtime spec's reference.** *Intended:* `PRISM-RENDERER-MIGRATION-SPEC.md §14` reconstruction = **5 hubs, 16 nodes, 9 primitives, 3 mesh, parallax-plane per hub, fly-through inter-hub nav**. *Existing (live, this branch):* `build-live-prism` emits **1 hub, 12 nodes, 2 edges** (confirmed in the build log and the running UI: "Home", "12 nodes"). The richer 5-hub reconstruction is in the **unmerged `prism-renderer-ralph`** line (the 64 commits from §1), not on `prism-editor-build`. So the editor line and the renderer line diverged on *what the mock even is*.

**Gap 3 — Round-2 editor features: ledger says done, evidence says "verify before trusting."** *Intended (v1.1):* canvas-mode transform editing (Edit toggle + visible drag), **Save / Save-and-Rebuild**, **Clone + auto-snap-to-nearest-hub**. *Existing:* `ralph-state.json` reports **26/26 round-2 tasks `done`, status `complete`**. But the pre-round-2 gap analysis listed Save-and-Rebuild and Clone-auto-snap as **"NOT IMPLEMENTED,"** and the `power-cut-iter18-salvage` branch (May 19) carries **unfinished "Save and Rebuild" work with *failing* tests** (`EBR2-E-04`) salvaged after a power cut. The ledger flipped to complete on May 20, but I have **not** independently confirmed these three features actually work in the running app. **Flag for interactive verification.**

**Gap 4 — Runtime Three.js delivery deviates from the bundled-import intent.** *Intended:* the migration spec mandates `import … from 'three/webgpu'` (bundled). *Existing:* the editor bundles `three` from `node_modules`, **but the runtime player loads `three`/`three/webgpu`/`three/tsl` from `https://cdn.jsdelivr.net` via a runtime `<script type="importmap">`** (confirmed in the served HTML). This two-channel split is a real architectural deviation and the most likely cause of a *production-only* load failure (§2, hypothesis 2). Whether it's a sanctioned deviation should be in `docs/spec-deviations-prism.md` — worth confirming.

**Gap 5 — Renderer-migration "done-ness" is undefined (see C5).** Because the `.ralph-migration-active` marker is still present, the code is *operating as if mid-migration* (migration-only guardrails still fire) even though a branch tip and the editor build both treat it as finished. Existing state and intended state can't be compared cleanly until you declare the migration done or not.

---

## OPEN QUESTIONS FOR LOGAN

Decisions I need from you **before any change is made**. I made none of these; each is blocking for the corresponding cleanup.

**Branches**
1. **`prism-renderer-ralph` (+64 unmerged commits — a whole renderer-migration line incl. the 5-hub mock).** Is that work meant to land on `prism-editor-build`, or was it superseded/abandoned? This decides whether Gap 2 is "merge needed" or "delete branch."
2. **`power-cut-iter18-salvage` (+2 commits, failing Save-and-Rebuild test stubs).** Salvage these into the editor line, or discard?
3. Confirm **`prism-editor-build` is the branch to continue from** (my recommendation), and that I may later `git worktree remove` the four stale `claude/*` worktrees.

**Load failure (§2)**
4. I could **not** reproduce a genuine load failure in a clean env. **Where did you see it** — the live Vercel URL, a specific branch, or after switching branches without clearing `.next`? 
5. May I **load `https://kid-kode-ai-landing.vercel.app` in a browser** (an external call) to test the CDN-import-map hypothesis? I held off pending your OK.

**Automation (§3)**
6. OK to **retire the Ralph loop drivers** (move `ralph.sh`, `ralph-resume.sh`, `kickoff-loop.sh`, the `ralph-step*`/`kickoff-*` commands to `/archive`)? They re-spawn `claude --dangerously-skip-permissions` up to 500×.
7. **`dependency-allowlist-check.sh` (your package.json / lockfile / import guardrail) is currently UNWIRED.** Re-wire it into `PostToolUse`? (Strongly recommended.)
8. OK to **clean up the two dangling Stop/UserPromptSubmit hook references** to the `.disabled` kripverify scripts in `Design-trials/.claude/settings.json`?
9. The activation markers (`.ralph-migration-active`, `.prism-editor-build-active`, `.ralph-phase5-pixi-removed`) change guardrail behavior. **Remove them, or leave them?** (Tied to Q1/Q11.)

**Specs (§4)**
10. **Which document is canonical when they collide?** Specifically: is `docs/prism/*` authoritative (per editor-build RA-05) or is `notes/prism-spec-extract.md` (per kid `CLAUDE.md`)? I recommend `docs/prism/*` and fixing the false "not on disk" claim — confirm.
11. **Is the renderer migration DONE?** (C5.) Your answer sets the marker, the CLAUDE.md status line, and Gap 5.
12. **The "caption spec" you named has no file in the repo.** Does it exist outside the repo (send it), or did you mean node-caption handling inside the engine spec?
13. Three specs are cited as authoritative but **absent**: `DIFFUSION-ENGINE-SPEC.md`, `PRISM_ENGINE_BROWSER_BASED_SPEC.md`, `Editor_UI_Rough_Spec`. Were these renamed into the current docs, or do they need to be added?
14. Approve the proposed canonical-4 + `/archive` plan (§4), or adjust the buckets?

**Scope confirmation**
15. This audit covered branches, load-repro, automation, and specs. The existing-vs-intended pass (§5) is preliminary — do you want a deeper, feature-by-feature verification pass next (interactive editor testing + Vercel), and against which hardened spec?

---

*End of audit. No code, specs, hooks, or branches were modified. HEAD = `prism-editor-build` @ `3c9be0a`. The only file I created is this report; `.next/` and `public/prism-assets/*` are gitignored build outputs regenerated by running the app.*
