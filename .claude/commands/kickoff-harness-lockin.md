---
description: Kick off the autonomous Prism Harness Lock-In chain. THIS Claude Code session becomes the orchestrator — spawns one Agent subagent per task (HL01–HL15), validates each result, chains through to completion. User stays able to chat with the orchestrator the whole time. KripVerify is the runtime verification gate.
argument-hint: (none)
---

# Kickoff: Prism Harness Lock-In chain (orchestrator)

You are the **Prism Harness Lock-In orchestrator** for THIS Claude Code session. The user pasted `/kickoff-harness-lockin` to enter this role. You autonomously drive the 15-task plan to completion by spawning ONE Agent subagent per task, serially. You stay interactive — the user can ask questions during the chain and you respond between worker spawns.

## Project context (read once)

- **Plan**: `/Users/loganbaird/.claude/plans/1-sounds-good-lets-jolly-frog.md`. Read it once at startup.
- **State file**: `kid-kode-landing/notes/ralph-state.json` (symlink → `ralph-state.harness-lockin.json`). 15 HL tasks, status `running`, branch `prism-main`.
- **Per-task contract**: `.claude/commands/harness-step.md`. Workers follow steps 1–13. Step 14 is "return JSON report to orchestrator" — see worker prompt template below.
- **Spec**: `kid-kode-landing/docs/prism/PRISM-RENDERER-MIGRATION-SPEC.md` + `kid-kode-landing/notes/spec-amendments/0002-hub-mockup-background.md`.
- **KripVerify**: `kv` MCP server registered in `.mcp.json`. Workers natively have `kv_*` tools (kv_navigate, kv_screenshot, kv_evaluate, kv_check_console, kv_check_network, kv_dev_server_status, kv_restart_dev_server, kv_click, kv_type, kv_wait_for, kv_findings_path, kv_verify).
- **Drift hooks**: anti-drift, post-edit-typecheck, migration-forbidden-patterns, format-check, todo-scanner are PreToolUse/PostToolUse. kripverify-userprompt + kripverify-stop are UserPromptSubmit/Stop. All active in every Agent subagent. **HL01 lands two more (verify-coderef-modules, validate-live-graph) — once HL01 commits, every subsequent worker has them too.**

## Step 1 — boot

Read the plan + state.json. Confirm `status == 'running'` and at least one task is in `pending` or `in-progress`. Print a short status to the user:

```
Prism Harness Lock-In — orchestrator online.
Status: running. Tasks: <pending count> pending, <in-progress count> in-progress, <done count> done.
Up next: <first task id> — <title>.
Spawning the worker now. I'll stay reachable for questions between tasks.
```

If state shows `complete`, tell the user the chain is already finished and recommend the production URL. Do not spawn anything.

If state shows `failed`, read the failed task's notes and surface to the user. Ask whether to retry, refine, or abort.

## Step 2 — chain loop

Repeat until terminal:

1. **Read fresh state.json**. Find the first task where `status in ('pending', 'in-progress') AND attemptCount < maxAttemptsPerTask`. If none: declare complete (or failed if any task is `failed`); break loop.

2. **Spawn an Agent subagent** with `subagent_type: "general-purpose"` and the worker prompt (see template below). Substitute `<TASK_ID>` and `<TASK_TITLE>` from state.json.

3. **Wait for return** (the Agent tool blocks). While waiting you cannot respond to user; that's expected — user messages queue and arrive when the Agent returns.

4. **Parse the worker's report** (must be a single JSON object — see template). Validate:
   - Re-read state.json: the task's `status` should now be `"done"`.
   - `git log --oneline -1` should show a `harness: <TASK_ID> -` commit.
   - The reported `commit` SHA matches HEAD.

5. **On validation pass**: tell user one line: `✅ <TASK_ID> done — commit <sha7>. Up next: <next task id>.` Loop.

6. **On validation fail** (worker reported failure OR state.json doesn't show done OR no new commit): tell the user the failure mode + worker's `blockers` field. Use `AskUserQuestion` to ask: retry the task, refine the task description, or abort the chain. Do NOT silently retry without consent.

## Step 3 — terminal

When state flips to `complete`: read final state, summarize:
- Total iterations across all tasks
- Per-task commit shas (`git log prism-main --since=<chain start ISO> --oneline`)
- Latest KripVerify findings (`.kripverify/findings/latest.json`)
- Production URL: https://kid-kode-ai-landing-git-prism-main-logans-projects-e51c822e.vercel.app/
- Recommended next steps (typically: open the production URL and visually confirm)

When state flips to `failed`: read the failed task's notes + the Agent's last `blockers` field. Surface to user; ask for guidance.

## Worker prompt template (Agent subagent input)

When spawning each Agent subagent in step 2.2, use this prompt verbatim, substituting `<TASK_ID>` and `<TASK_TITLE>`:

> You are a Prism Harness Lock-In worker. Execute exactly ONE task and return a structured JSON report. Do NOT continue to additional tasks — the orchestrator drives the chain.
>
> **Working directory**: `/Users/loganbaird/Prototype_Prism/Design-trials/`. **Branch**: `prism-main`.
>
> **Plan**: `/Users/loganbaird/.claude/plans/1-sounds-good-lets-jolly-frog.md` (the harness-lockin section).
> **Per-task contract**: read `.claude/commands/harness-step.md`. Follow steps 1–13 only. Skip step 14 (orchestrator drives next-task spawning).
>
> **Your task**: `<TASK_ID>` — `<TASK_TITLE>`. Full spec, haltCheck, verificationCommands, tddRequired, kvVerify, kvAsserts in `kid-kode-landing/notes/ralph-state.json` under `tasks[]`.
>
> **Verification gates** (ALL must pass before marking the task done):
>
> 1. Every command in `task.verificationCommands` exits 0.
> 2. If `task.kvVerify === true`:
>    - `kv_dev_server_status()` — restart via `kv_restart_dev_server` if not ready
>    - `kv_navigate({ url: 'http://127.0.0.1:<port>/' })`
>    - `kv_wait_for({ selector: 'canvas', timeout_ms: 30000 })`
>    - For each entry in `task.kvAsserts`: `kv_evaluate({ js: assertion })`, confirm truthy
>    - `kv_check_console({ level: 'error' })` — assert empty
>    - `kv_check_console` filtering for `'has been deprecated'` — assert empty
>    - `kv_screenshot({ full_page: true })` — saved to `.kripverify/findings/`
> 3. Spawn `spec-reviewer` subagent on HEAD; address all MUST FIX items (up to 2 review-fix cycles). If still has MUST FIX after 2 cycles, leave task in-progress.
>
> If any gate fails after up to 3 internal fix attempts, do NOT mark done. Leave task `in-progress`, return failure report.
>
> **After all gates pass**:
> - Commit implementation as `harness: <TASK_ID> - <title>`.
> - Update state.json: `task.status='done'`, `task.commit=<sha>`, `task.verifiedAt=<iso>`, append `history[]` entry, update `convergence.lastProductiveIteration` + `lastProductiveCommit`, update `checkpoint`.
> - Append a multi-paragraph progress entry to `kid-kode-landing/notes/prism-mock-progress.md` under the harness lock-in section.
> - Push `git push origin prism-main`.
>
> **Drift rules** (do NOT bypass):
> - Tests committed BEFORE impl when `tddRequired === true` (immutable through verify).
> - All hooks run; if a hook blocks an edit, fix the edit, never bypass.
> - Never push --force. Never use `--no-verify`.
> - Never edit committed test files during impl.
>
> **Final return**: respond with ONLY this JSON object (no extra text, no markdown fences):
>
> `{"task":"<TASK_ID>","status":"done"|"in-progress"|"failed","commit":"<sha or null>","kvVerifierStatus":"clean"|"warning"|"error"|"n/a","attemptCount":<n>,"summary":"<2–3 sentence outcome>","blockers":"<empty string if done, else short reason>"}`

## User interaction rules

- 2–5 lines per status update to the user. No multi-paragraph recaps mid-chain.
- If the user asks "what's HL0X doing right now?" while a worker runs: you can't read worker activity in real-time, but you CAN tell them the task title + verification gates expected. After the worker returns, give a more complete summary.
- If the user says "stop" / "pause": don't spawn the next worker. Tell them the chain halts; they can resume by re-pasting `/kickoff-harness-lockin` in a fresh chat.
- If the user gives mid-chain feedback affecting an upcoming task (e.g., "make HL07 also do X"): use `Edit` to append a note to that task's `notes` field in state.json BEFORE spawning its worker.
- Don't echo worker thinking. Just relay outcomes.

## Begin

Start with step 1 (boot). The first task is HL01 (spec-compliance hooks — verify-coderef-modules.sh + validate-live-graph.sh). Stay reachable.
